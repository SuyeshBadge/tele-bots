import { BotContext } from './types';
import { getChildLogger } from '../../utils/logger';
import { logActivity } from '../../utils/logger';
import { activeQuizzes, progressRepository } from './session';
import { getSubscriber } from '../../utils/persistence';
import { incrementQuizCount } from '../../utils/persistence';
import * as claudeClient from '../../api/claude-client';

const logger = getChildLogger('quiz-handlers');

/**
 * Handle poll answer
 */
export async function onPollAnswer(ctx: BotContext): Promise<void> {
  try {
    // Add null checks for poll_answer
    if (!ctx.update.poll_answer) {
      logger.warn('Received poll_answer event with undefined poll_answer data');
      return;
    }

    // Get user data and poll information
    const userId = ctx.update.poll_answer.user?.id;
    const pollId = ctx.update.poll_answer.poll_id;
    const selectedOption = ctx.update.poll_answer.option_ids?.[0];
    
    // Validate essential data
    if (!userId || !pollId || selectedOption === undefined) {
      logger.warn(`Missing essential poll answer data: userId=${userId}, pollId=${pollId}, selectedOption=${selectedOption}`);
      return;
    }
    
    // Check if we have the quiz data
    const quizData = await activeQuizzes.get(pollId);

    if (!quizData) {
      logger.warn(`No quiz data found for poll ${pollId} answer from user ${userId}`);
      return;
    }

    // Get user data
    const userData = await getSubscriber(userId);

    if (!userData) {
      logger.warn(`Received poll answer with missing user data for user ${userId}, poll ${pollId}`);
      return;
    }

    // Determine if the answer is correct
    const isCorrect = selectedOption === quizData.correctOption;

    // Save the quiz result
    await progressRepository.saveQuizResult(userId, {
      isCorrect,
      lessonId: quizData.lessonId,
      quizId: quizData.quizId,
      timestamp: new Date().toISOString()
    });

    // Get the text for the options
    const userChoice = quizData.options[selectedOption];
    const correctAnswer = quizData.options[quizData.correctOption];

    // Extract explanation
    const explanation = quizData.explanation || 
      (quizData.option_explanations && quizData.option_explanations[quizData.correctOption]) || 
      ""; 

    // Create feedback message
    let feedbackHeader: string;
    let feedbackSent = false;
    
    if (isCorrect) {
      // Choose a random congratulatory header
      const correctHeaders = [
        "🎉 *Amazing Job!* 🎉",
        "✨ *Design Genius!* ✨",
        "🌟 *UI/UX Superstar!* 🌟",
        "🏆 *Perfect Answer!* 🏆", 
        "💯 *Absolutely Correct!* 💯",
        "🔥 *On Fire!* 🔥",
        "⭐ *Brilliant Choice!* ⭐"
      ];
      feedbackHeader = correctHeaders[Math.floor(Math.random() * correctHeaders.length)];
    } else {
      // Choose a random encouraging header
      const incorrectHeaders = [
        "🤔 *Learning Opportunity!* 🤔",
        "💡 *Design Insight!* 💡",
        "🧠 *Growth Mindset!* 🧠",
        "🔍 *Design Explorer!* 🔍",
        "🚀 *Progress Moment!* 🚀",
        "🌱 *Design Journey!* 🌱",
        "🧩 *Puzzle Piece!* 🧩"
      ];
      feedbackHeader = incorrectHeaders[Math.floor(Math.random() * incorrectHeaders.length)];
    }
    
    // Add user's choice and correctness with more engaging formatting
    let feedbackMessage = `${feedbackHeader}\n\n`;
    
    // Add user's choice and correctness with more engaging formatting
    feedbackMessage += isCorrect
      ? `✅ You selected: *${userChoice}*\n\n`
      : `🔍 You selected: *${userChoice}*\n✅ Correct answer: *${correctAnswer}*\n\n`;
    
    // Use appropriate option explanation instead of trying to format all explanations
    if (isCorrect && quizData.option_explanations && quizData.option_explanations[quizData.correctOption]) {
      // For correct answers, use the explanation for the CORRECT option (not selectedOption)
      feedbackMessage += `${quizData.option_explanations[quizData.correctOption]}\n\n`;
      
      logActivity('explanation_included', userId, 'Correct option explanation included in quiz feedback', {
        explanationLength: quizData.option_explanations[quizData.correctOption].length
      });
    } else if (!isCorrect) {
      // For incorrect answers, show explanation for the correct option only
      if (quizData.option_explanations && quizData.option_explanations[quizData.correctOption]) {
        // Get the correct option explanation
        let correctExplanation = quizData.option_explanations[quizData.correctOption];
        
        // If the user's answer is incorrect, we need to modify any "Correct!" prefixes
        // to avoid confusing the user
        if (!isCorrect) {
          // Replace "Correct!" with "The correct answer is:" to avoid confusion
          correctExplanation = correctExplanation
            .replace(/^Correct!/i, "The correct answer is:")
            .replace(/^✅\s*Correct!/i, "The correct answer is:");
        }
        
        feedbackMessage += `${correctExplanation}\n\n`;
        
        logActivity('explanation_included', userId, 'Correct option explanation included for incorrect answer', {
          explanationLength: quizData.option_explanations[quizData.correctOption].length
        });
      }
    } else if (explanation && explanation.trim()) {
      // Fallback to general explanation if no option-specific explanation is available
      feedbackMessage += `${explanation}\n\n`;
      
      logActivity('explanation_included', userId, 'General explanation included in quiz feedback', {
        explanationLength: explanation.length
      });
    } else {
      // Last resort fallback explanation
      const fallbackExplanation = isCorrect 
        ? `The answer "${correctAnswer}" is correct for this question about ${quizData.theme || 'UI/UX design'}.` 
        : `The correct answer is "${correctAnswer}" for this question about ${quizData.theme || 'UI/UX design'}.`;
      
      feedbackMessage += `${fallbackExplanation}\n\n`;
      
      logActivity('fallback_explanation_used', userId, 'Used fallback explanation due to missing explanation data', {
        isCorrect,
        questionTheme: quizData.theme
      });
    }

    // Add more personalized and motivating conclusion
    if (isCorrect) {
      // More varied and encouraging correct answer messages
      const correctConclusions = [
        "💪 You're building impressive UI/UX skills with each question you answer!",
        "🚀 Keep this momentum going - you're mastering UI/UX concepts beautifully!",
        "🎯 This shows your growing expertise in design principles. Excellent work!",
        "⚡ Your design knowledge is really shining through. Keep it up!",
        "🧠 Your understanding of UI/UX concepts is impressive and growing stronger!"
      ];
      feedbackMessage += correctConclusions[Math.floor(Math.random() * correctConclusions.length)];
    } else {
      // More varied and supportive incorrect answer messages
      const incorrectConclusions = [
        "🌱 Every question is a stepping stone to mastery - you're on a great path!",
        "💡 The best designers learn from every experience - you're doing exactly that!",
        "🧩 Each challenge builds your design thinking - keep exploring and learning!",
        "🚀 Design expertise comes from practice and exploration - you're on the right track!",
        "🔄 Learning is an iterative process - just like good design itself!"
      ];
      feedbackMessage += incorrectConclusions[Math.floor(Math.random() * incorrectConclusions.length)];
    }
    
    // Add design quote for extra motivation (occasionally)
    if (Math.random() > 0.7) { // 30% chance to add a quote
      const designQuotes = [
        "\n\n💬 *\"Design is not just what it looks like and feels like. Design is how it works.\"* - Steve Jobs",
        "\n\n💬 *\"Good design is obvious. Great design is transparent.\"* - Joe Sparano",
        "\n\n💬 *\"Simplicity is the ultimate sophistication.\"* - Leonardo da Vinci",
        "\n\n💬 *\"Design is intelligence made visible.\"* - Alina Wheeler",
        "\n\n💬 *\"Design is not a single object or dimension. Design is messy and complex.\"* - Natasha Jen"
      ];
      feedbackMessage += designQuotes[Math.floor(Math.random() * designQuotes.length)];
    }

    await incrementQuizCount(userId);

    // Send the enhanced feedback
    try {
      await ctx.api.sendMessage(
        userId,  // Explicitly use the userId as the chat_id
        feedbackMessage,
        { parse_mode: 'Markdown' }
      );
      feedbackSent = true;
    } catch (feedbackError) {
      logger.error(`Error sending primary feedback: ${feedbackError instanceof Error ? feedbackError.message : String(feedbackError)}`);
    }
    
    // ENSURE EXPLANATION IS SENT: Always send a direct explanation message
    // Only send this if the primary feedback wasn't sent or for complex explanations
    if (!feedbackSent || (quizData.option_explanations && quizData.option_explanations.length > 0 && quizData.option_explanations.some(e => e.length > 100))) {
      try {
        // Send a clear explanation only if needed
        let directExplanation: string;
        
        if (isCorrect) {
          directExplanation = `✅ *Why this answer is correct:*\n\n`;
        } else {
          directExplanation = `🔍 *Why the correct answer is "${quizData.options[quizData.correctOption]}":*\n\n`;
        }
        
        // Use the most detailed explanation available
        if (quizData.option_explanations && quizData.option_explanations[quizData.correctOption]) {
          // Always explain the correct answer
          let finalExplanation = quizData.option_explanations[quizData.correctOption];
          
          // If the user's answer is incorrect, modify any "Correct!" prefix
          if (!isCorrect) {
            finalExplanation = finalExplanation
              .replace(/^Correct!/i, "")
              .replace(/^✅\s*Correct!/i, "");
          }
          
          directExplanation += finalExplanation;
        } else if (quizData.explanation) {
          // Fall back to general explanation
          let finalExplanation = quizData.explanation;
          
          // If the user's answer is incorrect, modify any "Correct!" prefix
          if (!isCorrect) {
            finalExplanation = finalExplanation
              .replace(/^Correct!/i, "")
              .replace(/^✅\s*Correct!/i, "");
          }
          
          directExplanation += finalExplanation;
        } else {
          // Last resort
          directExplanation += `This answer relates to best practices in ${quizData.theme || 'UI/UX design'}.`;
        }
        
        // Send direct explanation with explicit chat ID
        await ctx.api.sendMessage(userId, directExplanation, { parse_mode: 'Markdown' });
      } catch (directExplError) {
        logger.error(`Error sending direct explanation: ${directExplError instanceof Error ? directExplError.message : String(directExplError)}`);
        
        // Last resort: try plain text with no formatting
        try {
          await ctx.api.sendMessage(userId, `Explanation: ${quizData.explanation || 'This question tests your knowledge of important UI/UX principles.'}`);
        } catch (finalError) {
          logger.error(`FINAL ERROR sending explanation: ${finalError instanceof Error ? finalError.message : String(finalError)}`);
        }
      }
    }
    
    // Clean up
    await activeQuizzes.delete(pollId);
    logger.info(`Quiz processed for poll ${pollId}, user ${userId}`);
  } catch (error) {
    logger.error(`Error processing poll answer: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Send a quiz to a user
 * @param ctx Bot context
 * @param userId User ID to send quiz to
 * @param theme Theme of the quiz
 */
export async function sendQuiz(ctx: BotContext, userId: number, theme: string): Promise<void> {
  try {
    logActivity('quiz_generation_started', userId, 'Starting to generate or retrieve quiz', {
      theme
    });
    
    // Generate quiz - this now uses cached data if available
    const startTime = Date.now();
    const quiz = await claudeClient.generateQuiz(theme);
    const elapsedTime = Date.now() - startTime;
    const fromCache = elapsedTime < 100; // Likely from cache if it took less than 100ms
    
    logActivity('quiz_generated', userId, `Quiz ${fromCache ? 'retrieved from cache' : 'generated'}`, {
      theme,
      questionLength: quiz.question.length,
      optionsCount: quiz.options.length,
      generationTimeMs: elapsedTime,
      fromCache,
      hasOptionExplanations: !!quiz.option_explanations && quiz.option_explanations.length > 0
    });
    
    // Add emoji to the question to make it more engaging
    const enhancedQuestion = `🧠 ${quiz.question} 🧠`;
    
    // Convert string options to InputPollOption format and enhance with emojis
    const enhancedOptions = quiz.options.map(option => {
      if (/color|palette|hue|contrast|saturation/i.test(option)) {
        return { text: `🎨 ${option}` };
      } else if (/user|customer|audience|person|client/i.test(option)) {
        return { text: `👤 ${option}` };
      } else if (/click|tap|swipe|interaction|navigate/i.test(option)) {
        return { text: `🖱️ ${option}` };
      } else if (/principle|theory|concept|rule|guideline/i.test(option)) {
        return { text: `📚 ${option}` };
      } else if (/figma|sketch|adobe|tool|software/i.test(option)) {
        return { text: `🛠️ ${option}` };
      } else {
        return { text: `✨ ${option}` };
      }
    });
    
    logActivity('sending_quiz', userId, 'Sending quiz to user');
    
    // Send the quiz as a poll
    const poll = await ctx.api.sendPoll(
      userId,
      enhancedQuestion,
      enhancedOptions,
      {
        is_anonymous: false,
        type: 'quiz',
        correct_option_id: quiz.correctIndex,
        explanation: `The correct answer will be revealed after you make your choice.`,
        explanation_parse_mode: 'HTML'
      }
    );
    
    // Store quiz data for later, including option explanations
    if (poll.poll) {
      // Generate unique IDs if not available
      const lessonId = `lesson-${Date.now()}`;
      const quizId = `quiz-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      
      await activeQuizzes.set(poll.poll.id, {
        correctOption: quiz.correctIndex,
        options: quiz.options,
        question: quiz.question,
        theme: theme,
        explanation: quiz.explanation || undefined, // Store general explanation for correct answer
        option_explanations: quiz.option_explanations, // Store explanations for each option
        lessonId: lessonId, // Use the generated lessonId
        quizId: quizId // Use the generated quizId
      });
      
      logActivity('quiz_tracking_stored', userId, 'Quiz data stored for answer tracking', {
        pollId: poll.poll.id,
        hasExplanations: !!quiz.option_explanations,
        explanationCount: quiz.option_explanations?.length || 0,
        hasGeneralExplanation: !!quiz.explanation
      });
    }
    
  } catch (error) {
    logger.error(`Error sending quiz: ${error instanceof Error ? error.message : String(error)}`);
    logActivity('quiz_error', userId, 'Error occurred while sending quiz', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    // Send fallback message if quiz fails
    await ctx.reply(
      "🧠 *Time to Test Your Knowledge!* 🧠\n\n" +
      "I wanted to send you a quiz, but encountered a technical issue.\n\n" +
      "💡 Take a moment to reflect on what you've learned in this lesson.\n" +
      "🤔 Try to identify 3 key points you can apply to your next design project!",
      { parse_mode: 'Markdown' }
    );
  }
} 