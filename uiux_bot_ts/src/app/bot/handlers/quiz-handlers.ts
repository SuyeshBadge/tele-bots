import { BotContext } from './types';
import { getChildLogger } from '../../utils/logger';
import { logActivity } from '../../utils/logger';
import { activeQuizzes, progressRepository } from './session';
import { getSubscriber } from '../../utils/persistence';
import { incrementQuizCount } from '../../utils/persistence';
import * as claudeClient from '../../api/claude-client';
import { formatQuiz, sendFormattedQuiz, formatQuizExplanation, getDetailedQuizExplanation, getRandomLearningTip } from '../../utils/quiz-utils';
import { sanitizeHtmlForTelegram } from '../../utils/telegram-utils';
import { getSupabaseClient } from '../../../database/supabase-client';

// Import QuizData type from the types file 
import { QuizData } from './types';
import { quizRepository } from '@app/utils/quiz-repository';

const logger = getChildLogger('quiz-handlers');

/**
 * Handle poll answer
 */
export async function onPollAnswer(ctx: BotContext): Promise<void> {
  try {
    const pollAnswer = ctx.update.poll_answer;
    if (!pollAnswer) {
      return;
    }
    
    const pollId = pollAnswer.poll_id;
    
    // Check if user exists
    if (!pollAnswer.user) {
      logger.warn(`Poll answer with no user data for poll ${pollId}`);
      return;
    }
    
    const userId = pollAnswer.user.id;
    
    // Get quiz data from active quizzes storage
    const quizData = await activeQuizzes.get(pollId);
    if (!quizData) {
      logger.warn(`No quiz data found for poll ${pollId}`);
      return;
    }
    
    // Get the selected option
    if (pollAnswer.option_ids.length === 0) {
      logger.info(`User ${userId} did not select any option for poll ${pollId}`);
      return;
    }
    
    const selectedOption = pollAnswer.option_ids[0];
    
    // Check if the answer is correct
    const isCorrect = selectedOption === quizData.correctOption;
    
    // Mark quiz as answered in the database
    await markQuizAsAnswered(userId, pollId, isCorrect);
    
    // Log quiz response activity
    logActivity('quiz_answered', userId, `User answered quiz ${isCorrect ? 'correctly' : 'incorrectly'}`, {
      isCorrect,
      selectedOption,
      correctOption: quizData.correctOption,
      pollId,
      theme: quizData.theme,
      questionLength: quizData.question.length
    });
    
    // Get the text for the options
    const userChoice = quizData.options[selectedOption];
    const correctAnswer = quizData.options[quizData.correctOption];

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
      
    try {
      // Ensure we have valid quiz data
      const validatedQuizData = {
        question: quizData.question || "UI/UX Quiz Question",
        options: Array.isArray(quizData.options) ? quizData.options : [],
        correctIndex: quizData.correctOption,
        explanation: quizData.explanation || `The correct answer is "${correctAnswer}"`,
        option_explanations: Array.isArray(quizData.option_explanations) ? quizData.option_explanations : []
      };
      
      // Ensure there are enough explanations (at least for the selected option and correct option)
      while (validatedQuizData.option_explanations.length < validatedQuizData.options.length) {
        validatedQuizData.option_explanations.push("");
      }
      
      // Create a simple, focused explanation just for the selected option
      let selectedOptionExplanation = "";
      
      // Get the selected option's text and add proper emoji
      const optionText = sanitizeHtmlForTelegram(validatedQuizData.options[selectedOption] || "");
      
      // Get explanation for the selected option
      let explanation = validatedQuizData.option_explanations[selectedOption] || "";
      explanation = explanation
        .replace(/^Correct!/i, '')
        .replace(/^✅\s*Correct!/i, '')
        .trim();
      
      // If the explanation is empty or doesn't exist, use a fallback
      if (!explanation || explanation.trim() === '') {
        if (isCorrect) {
          explanation = `This is the correct approach for ${quizData.question || 'this UI/UX concept'}`;
        } else {
          // If incorrect and no explanation, explain why correct answer is better
          const correctExplanation = validatedQuizData.option_explanations[validatedQuizData.correctIndex] || 
                                    validatedQuizData.explanation || 
                                    `The correct answer is "${correctAnswer}"`;
          explanation = `This option is not optimal. ${correctExplanation}`;
        }
      }
      
      // Format the explanation
      selectedOptionExplanation = `<b>📚 Answer Explanation 📚</b>\n\n`;
      
      if (isCorrect) {
        selectedOptionExplanation += `✅ <b>You selected:</b> ${optionText}\n\n<b>Explanation:</b> ${explanation}\n\n`;
      } else {
        selectedOptionExplanation += `❌ <b>You selected:</b> ${optionText}\n\n<b>Explanation:</b> ${explanation}\n\n`;
        selectedOptionExplanation += `✅ <b>Correct answer:</b> ${validatedQuizData.options[validatedQuizData.correctIndex]}\n\n`;
      }
      
      // Add a learning tip
      selectedOptionExplanation += getRandomLearningTip(isCorrect);
      
      // Send the focused explanation
      await ctx.api.sendMessage(userId, sanitizeHtmlForTelegram(selectedOptionExplanation), { 
        parse_mode: 'HTML'
      });
      
      feedbackSent = true;
      
    } catch (feedbackError) {
      logger.error(`Error sending detailed explanation: ${feedbackError instanceof Error ? feedbackError.message : String(feedbackError)}`);
      
      // If the HTML formatting failed, try with simple Markdown as fallback
      try {
        await ctx.reply(feedbackMessage, { 
          parse_mode: 'Markdown'
        });
        
        feedbackSent = true;
        
      } catch (markdownError) {
        logger.error(`Error sending Markdown feedback: ${markdownError instanceof Error ? markdownError.message : String(markdownError)}`);
        
        // Last resort: try plain text with no formatting
        try {
          await ctx.reply(`Explanation: ${quizData.explanation || 'This question tests your knowledge of important UI/UX principles.'}`);
          
          feedbackSent = true;
          
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
export async function sendQuiz(ctx: BotContext, userId: number, lessonId: string): Promise<void> {
  try {
    logActivity('quiz_generation_started', userId, 'Starting to generate or retrieve quiz', {
      lessonId
    });
    
    // Generate quiz - this now uses cached data if available
    const startTime = Date.now();

    const quiz = await quizRepository.getQuizByLessonId(lessonId);
    const elapsedTime = Date.now() - startTime;
    const fromCache = elapsedTime < 100; // Likely from cache if it took less than 100ms
    
    logActivity('quiz_generated', userId, `Quiz ${fromCache ? 'retrieved from cache' : 'generated'}`, {
      lessonId,
      questionLength: quiz?.question.length || 0,
      optionsCount: quiz?.options.length || 0,
      generationTimeMs: elapsedTime,
      fromCache,
      hasOptionExplanations: !!quiz?.option_explanations && quiz?.option_explanations.length > 0
    });
    
    // Use the new utility function to send consistently formatted quiz
    if (quiz) {
      await sendFormattedQuiz(ctx, userId, quiz, lessonId);
    } else {
      logger.error('Quiz data is null, skipping quiz send');
    }
    
    logActivity('quiz_sent', userId, 'Quiz successfully sent to user', {
      lessonId,
      fromCache
    });
    
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

/**
 * Mark a quiz as answered in the database
 * @param userId User ID who answered
 * @param pollId Poll ID that was answered
 * @param isCorrect Whether the answer was correct
 */
async function markQuizAsAnswered(userId: number, pollId: string, isCorrect: boolean): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    
    const { error } = await supabase
      .from('quiz_deliveries')
      .update({
        answered: true,
        answered_at: new Date().toISOString(),
        answer_correct: isCorrect
      })
      .match({ poll_id: pollId, user_id: userId });
      
    if (error) {
      logger.error(`Error marking quiz as answered: ${error.message}`);
    } else {
      logger.info(`Marked quiz ${pollId} as answered by user ${userId}, correct: ${isCorrect}`);
    }
  } catch (error) {
    logger.error(`Error in markQuizAsAnswered: ${error instanceof Error ? error.message : String(error)}`);
  }
} 