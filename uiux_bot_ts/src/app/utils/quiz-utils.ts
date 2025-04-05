import { Bot } from 'grammy';
import { getChildLogger } from './logger';
import { incrementQuizCount } from './persistence';
import { quizRepository } from './quiz-repository';
import { sanitizeHtmlForTelegram } from './telegram-utils';
import claudeClient from '../api/claude-client';
import { BotContext } from '../bot/handlers/types';
import { getSupabaseClient } from '../../database/supabase-client';

const logger = getChildLogger('quiz-utils');

// Define QuizData interface locally since it's not exported from claude-client
interface QuizData {
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
  option_explanations?: string[];
}

// Arrays of learning tips specific to whether the user got the answer right or wrong
const correctAnswerTips = [
  "💭 Remember: Good UI/UX design always centers on user needs and expectations.",
  "💭 Great job! Usability is the foundation of good design - intuitive interfaces lead to happy users.",
  "💭 Excellent! Consistency in design patterns helps users build mental models about how your interface works.",
  "💭 Well done! White space is a design element, not empty space - use it intentionally.",
  "💭 Perfect! Color psychology can significantly impact how users perceive your interface.",
  "💭 Correct! Accessibility isn't optional - it expands your audience and improves everyone's experience.",
  "💭 Right! Prototype early and often - validate your ideas before committing to full development.",
  "💭 Spot on! User feedback is gold - collect it regularly and implement improvements based on it.",
  "💭 Great thinking! Visual hierarchy guides users through your interface in the correct order.",
  "💭 Excellent choice! Responsive design isn't just about different devices - it's about context of use.",
  "💭 Well done! Good microcopy can make or break the user experience.",
  "💭 Perfect understanding! Design systems help maintain consistency and speed up your workflow.",
  "💭 Correct approach! Data visualization should make complex information instantly understandable.",
  "💭 Right track! The best interfaces are the ones users don't even notice they're using.",
  "💭 Nicely done! A/B testing helps you make design decisions based on evidence, not assumptions."
];

const incorrectAnswerTips = [
  "💭 Keep learning! Good UI/UX design always centers on user needs and expectations.",
  "💭 Don't worry! Understanding cognitive load is key to creating interfaces users can navigate easily.",
  "💭 Keep at it! User research should inform design decisions from the very beginning.",
  "💭 You'll get there! Affordances help users understand how to interact with your interface.",
  "💭 Next time! Typography isn't just about aesthetics - it affects readability and comprehension.",
  "💭 Keep going! Error prevention is better than error handling in interface design.",
  "💭 You're learning! Progressive disclosure helps manage complexity by revealing information gradually.",
  "💭 Stay curious! Information architecture provides the foundation for intuitive navigation.",
  "💭 Keep trying! Hick's Law tells us that more choices lead to longer decision times.",
  "💭 Practice makes perfect! Gestalt principles explain how users perceive visual relationships.",
  "💭 Keep growing! Interaction design focuses on creating engaging interfaces with well-thought-out behaviors.",
  "💭 You'll improve! Fitts's Law reminds us that important controls should be easily clickable.",
  "💭 Next challenge! Dark patterns might work short-term but damage user trust permanently.",
  "💭 Keep practicing! Microinteractions add delight and improve perceived performance.",
  "💭 You're developing! Design thinking helps solve complex problems by focusing on user needs."
];

/**
 * Get a random learning tip based on whether the answer was correct
 * @param isCorrect Whether the user's answer was correct
 * @returns A random learning tip appropriate for the result
 */
export function getRandomLearningTip(isCorrect: boolean): string {
  const tips = isCorrect ? correctAnswerTips : incorrectAnswerTips;
  return `<i>${tips[Math.floor(Math.random() * tips.length)]}</i>`;
}

/**
 * Format quiz question and options with consistent emojis and formatting
 * @param quiz - Quiz data from Claude
 * @returns Formatted quiz question and options
 */
export function formatQuiz(quiz: QuizData): { 
  question: string; 
  options: Array<{ text: string }>;
} {
  // Ensure quiz has required fields
  const safeQuiz = {
    question: quiz.question || "What is a key principle of UI/UX design?",
    options: Array.isArray(quiz.options) ? quiz.options : [
      "Visual aesthetics only",
      "User-centered design", 
      "Technical implementation",
      "Complex interfaces"
    ],
    correctIndex: typeof quiz.correctIndex === 'number' ? quiz.correctIndex : 1
  };

  // Add emoji to the question to make it more engaging
  const enhancedQuestion = sanitizeHtmlForTelegram(`🧠 ${safeQuiz.question}`);
  
  // Convert string options to InputPollOption format and enhance with emojis
  const enhancedOptions = safeQuiz.options.map((option: string, index: number) => {
    // Match each option with an appropriate emoji based on content
    let emoji = '✨';
    if (/color|palette|hue|contrast|saturation/i.test(option)) {
      emoji = '🎨';
    } else if (/user|customer|audience|person|client/i.test(option)) {
      emoji = '👤';
    } else if (/click|tap|swipe|interaction|navigate/i.test(option)) {
      emoji = '🖱️';
    } else if (/principle|theory|concept|rule|guideline/i.test(option)) {
      emoji = '📚';
    } else if (/figma|sketch|adobe|tool|software/i.test(option)) {
      emoji = '🛠️';
    } else if (/design|interface|layout/i.test(option)) {
      emoji = '📱';
    } else if (/test|research|data|analyze/i.test(option)) {
      emoji = '🔍';
    } else if (index === safeQuiz.correctIndex) {
      // Add a subtle but different emoji for the correct answer
      emoji = '💡';
    } else if (index === 0) {
      emoji = '🔸';
    } else if (index === 1) {
      emoji = '🔹';
    } else if (index === 2) {
      emoji = '📌';
    } else if (index === 3) {
      emoji = '🔖';
    }
    
    return { text: sanitizeHtmlForTelegram(`${emoji} ${option}`) };
  });
  
  return {
    question: enhancedQuestion,
    options: enhancedOptions
  };
}

/**
 * Format quiz explanation with consistent styling and emojis
 * Ensure it doesn't exceed Telegram's character limit for poll explanations
 * @param quizData - Quiz data from Claude
 * @returns Formatted explanation HTML string
 */
export function formatQuizExplanation(quizData: QuizData): string {
  // Telegram has a strict limit for poll explanations
  const MAX_EXPLANATION_LENGTH = 120; // Be extra cautious with the limit
  
  // Keep poll explanation very minimal - just one line
  let formattedExplanation = '<b>📚 Answer to see full explanation</b>';
  
  return sanitizeHtmlForTelegram(formattedExplanation);
}

/**
 * Get a detailed explanation suitable for a follow-up message
 * This can be longer and more comprehensive since it's not in the poll
 * @param quizData - Quiz data
 * @returns Detailed HTML explanation
 */
export function getDetailedQuizExplanation(quizData: QuizData): string {
  // Start with a header
  let detailedExplanation = '<b>📚 Detailed Explanation 📚</b>\n\n';
  
  // Add the main explanation with emoji
  if (quizData.explanation && quizData.explanation.trim() !== '') {
    // Clean up any "Correct!" prefixes that might confuse users
    let explanation = quizData.explanation
      .replace(/^Correct!/i, '')
      .replace(/^✅\s*Correct!/i, '')
      .trim();
      
    // Don't use the poll placeholder text from formatQuizExplanation
    if (explanation === 'Answer to see full explanation') {
      explanation = 'This question tests your understanding of UI/UX principles.';
    }
      
    // Add emoji based on explanation content
    let emoji = '💡';
    if (/better|best|optimal|preferred|recommended/i.test(explanation)) {
      emoji = '✅';
    } else if (/principle|concept|theory/i.test(explanation)) {
      emoji = '📘';
    } else if (/user|customer|audience/i.test(explanation)) {
      emoji = '👥';
    } else if (/design|layout|interface/i.test(explanation)) {
      emoji = '🎨';
    } else if (/research|testing|data/i.test(explanation)) {
      emoji = '🔬';
    } else if (/important|critical|essential/i.test(explanation)) {
      emoji = '⭐';
    }
    
  } else {
    // Fallback explanation if none provided
    detailedExplanation += '💡 <b>Main point:</b> This tests your understanding of key UI/UX principles.\n\n';
  }
  
  // Add option-specific explanations if available
  if (quizData.option_explanations && quizData.option_explanations.length > 0 &&
      quizData.options && quizData.options.length > 0) {
    
    detailedExplanation += '<b>🔍 Option details:</b>\n\n';
    
    // Make sure we're iterating through arrays of the same length
    const optionsLength = Math.min(quizData.options.length, quizData.option_explanations.length);
    
    // First, let's validate that the correct option index is valid
    const correctIndex = typeof quizData.correctIndex === 'number' && 
                         quizData.correctIndex >= 0 && 
                         quizData.correctIndex < optionsLength 
                         ? quizData.correctIndex : 0;
    
    // Make sure the correct answer always has an explanation
    if (!quizData.option_explanations[correctIndex] || quizData.option_explanations[correctIndex].trim() === '') {
      quizData.option_explanations[correctIndex] = `This is the correct approach for ${quizData.question || 'this UI/UX concept'}`;
    }
    
    // Show each option with its explanation
    for (let i = 0; i < optionsLength; i++) {
      const option = sanitizeHtmlForTelegram(quizData.options[i] || '');
      
      // Skip empty options
      if (!option || option.trim() === '') continue;
      
      let explanation = quizData.option_explanations[i] || '';
      explanation = explanation
        .replace(/^Correct!/i, '')
        .replace(/^✅\s*Correct!/i, '')
        .trim();
      
      // If explanation is empty, generate a simple one
      if (!explanation || explanation.trim() === '') {
        explanation = i === correctIndex 
          ? `This is the correct approach for ${quizData.question || 'this UI/UX concept'}`
          : `This option is not optimal for ${quizData.question || 'this UI/UX concept'}`;
      }
      
      // Format according to correctness
      if (i === correctIndex) {
        detailedExplanation += `✅ <b>${option}</b>: ${explanation}\n\n`;
      } else {
        detailedExplanation += `❌ <b>${option}</b>: ${explanation}\n\n`;
      }
    }
  }
  
  // Add a learning tip (using a correct answer tip since this is general documentation)
  detailedExplanation += correctAnswerTips[0];
  
  return sanitizeHtmlForTelegram(detailedExplanation);
}

/**
 * Track that a quiz was delivered to a user
 * @param userId User ID the quiz was delivered to
 * @param pollId Poll ID of the delivered quiz
 */
async function trackQuizDelivery(userId: number, pollId: string): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    
    // Record that the quiz was delivered and not answered yet
    const { error } = await supabase
      .from('quiz_deliveries')
      .upsert({
        poll_id: pollId,
        user_id: userId,
        delivered_at: new Date().toISOString(),
        answered: false
      });
    
    if (error) {
      logger.error(`Error tracking quiz delivery: ${error.message}`);
    } else {
      logger.info(`Tracked quiz delivery: poll ${pollId} to user ${userId}`);
    }
  } catch (error) {
    logger.error(`Error in trackQuizDelivery: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Send quiz directly to user with BotContext
 * @param ctx - Bot context
 * @param userId - User ID to send quiz to
 * @param quizData - Quiz data from Claude
 * @param theme - Theme of the lesson
 */
export async function sendFormattedQuiz(
  ctx: BotContext, 
  userId: number, 
  quizData: QuizData, 
  theme: string
): Promise<void> {
  try {
    // Format the quiz
    const { question, options } = formatQuiz(quizData);
    
    // Format the explanation
    const formattedExplanation = formatQuizExplanation(quizData);
    
    // Send the quiz as a poll
    const poll = await ctx.api.sendPoll(
      userId,
      question,
      options,
      {
        is_anonymous: false,
        type: 'quiz',
        correct_option_id: quizData.correctIndex,
        explanation: formattedExplanation,
        explanation_parse_mode: 'HTML'
      }
    );
    
    // Save the quiz to the database for later reference
    if (poll.poll) {
      await quizRepository.saveQuiz({
        pollId: poll.poll.id,
        lessonId: theme,
        quizId: `quiz-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        correctOption: quizData.correctIndex,
        question: quizData.question,
        options: quizData.options,
        explanation: formattedExplanation, // Save the formatted explanation
        option_explanations: quizData.option_explanations || [],
        theme: theme,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
      });
      
      // Track that this quiz was delivered to the user
      await trackQuizDelivery(userId, poll.poll.id);
      
      // Update quiz count for this user
      await incrementQuizCount(userId);
      
      logger.info(`Quiz sent to user ${userId} for theme ${theme}`);
    }
  } catch (error) {
    logger.error(`Error sending formatted quiz: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

/**
 * Alternative version that accepts a Bot instance instead of BotContext
 * Used for scheduled lessons where we don't have a context
 */
export async function sendFormattedQuizWithBot(
  bot: Bot<BotContext>,
  userId: number,
  quizData: QuizData,
  theme: string
): Promise<void> {
  try {
    // Format the quiz
    const { question, options } = formatQuiz(quizData);
    
    // Format the explanation
    const formattedExplanation = formatQuizExplanation(quizData);
    
    // Send the quiz as a poll
    const poll = await bot.api.sendPoll(
      userId,
      question,
      options,
      {
        is_anonymous: false,
        type: 'quiz',
        correct_option_id: quizData.correctIndex,
        explanation: formattedExplanation,
        explanation_parse_mode: 'HTML'
      }
    );
    
    // Save the quiz to the database for later reference
    if (poll.poll) {
      await quizRepository.saveQuiz({
        pollId: poll.poll.id,
        lessonId: theme,
        quizId: `quiz-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        correctOption: quizData.correctIndex,
        question: quizData.question,
        options: quizData.options,
        explanation: formattedExplanation, // Save the formatted explanation
        option_explanations: quizData.option_explanations || [],
        theme: theme,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
      });
      
      // Track that this quiz was delivered to the user
      await trackQuizDelivery(userId, poll.poll.id);
      
      // Update quiz count for this user
      await incrementQuizCount(userId);
      
      logger.info(`Quiz sent to user ${userId} for theme ${theme}`);
    }
  } catch (error) {
    logger.error(`Error sending formatted quiz: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

/**
 * Send a reminder to a user about an unanswered quiz
 * @param bot - Telegram bot instance
 * @param userId - User ID to send reminder to
 * @param quizInfo - Information about the unanswered quiz
 * @returns Boolean indicating if reminder was sent successfully
 */
export async function sendQuizReminder(
  bot: Bot<BotContext>,
  userId: number,
  quizInfo: {
    pollId: string;
    question: string;
    theme: string;
    createdAt: string;
  }
): Promise<boolean> {
  try {
    // Create a friendly time string since quiz was sent
    const quizTime = new Date(quizInfo.createdAt);
    const now = new Date();
    const minutesAgo = Math.floor((now.getTime() - quizTime.getTime()) / (1000 * 60));
    
    let timeString: string;
    if (minutesAgo < 60) {
      timeString = `${minutesAgo} minutes ago`;
    } else if (minutesAgo < 120) {
      timeString = `about an hour ago`;
    } else {
      const hoursAgo = Math.floor(minutesAgo / 60);
      timeString = `about ${hoursAgo} hours ago`;
    }
    
    // Format a friendly reminder message
    const message = sanitizeHtmlForTelegram(`
<b>🔔 Quiz Reminder 🔔</b>

<i>I noticed you haven't completed the quiz about <b>${quizInfo.theme}</b> that I sent ${timeString}.</i>

The quiz asked: <b>${quizInfo.question}</b>

<b>Why answer?</b>
✅ Test your knowledge
✅ Reinforce what you learned
✅ Get immediate feedback

Just scroll back in our chat to find the quiz, or type /lesson to get a new lesson and quiz if you prefer!

<i>Keep growing your UI/UX skills!</i>
`);
    
    // Send the reminder
    await bot.api.sendMessage(userId, message, {
      parse_mode: 'HTML'
    });
    
    logger.info(`Sent quiz reminder to user ${userId} for poll ${quizInfo.pollId}`);
    return true;
  } catch (error) {
    logger.error(`Error sending quiz reminder: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
} 