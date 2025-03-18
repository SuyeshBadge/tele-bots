import { BotContext } from '../bot/handlers/types';
import { getChildLogger } from './logger';
import { getSubscriber, incrementLessonCount } from './persistence';
import { lessonRepository } from './lesson-repository';
import { LessonData } from './lesson-types';
import * as openaiClient from '../api/openai-client';
import { LessonSections } from '../api/openai-client';
import * as imageManager from '../api/image-manager';
import * as youtubeClient from '../api/youtube-client';
import { sendQuiz } from '../bot/handlers/quiz-handlers';
import { sanitizeHtmlForTelegram } from './telegram-utils';

const logger = getChildLogger('lesson-utils');

/**
 * Core function to send a lesson to a user
 */
export async function sendLesson(ctx: BotContext, userId: number): Promise<void> {
  try {
    logger.info(`Sending lesson to user ${userId}`);
    
    // Get user data to check their lesson history
    const userData = await getSubscriber(userId);
    if (!userData) {
      await ctx.reply(
        "❌ Please use /start to subscribe to the bot first.",
        { parse_mode: 'Markdown' }
      );
      return;
    }
    

    
    // If no lesson found, generate a new one
    const lesson = await generateNewLesson();
    
    if (!lesson) {
      await ctx.reply("❌ Sorry, I couldn't generate a lesson right now. Please try again later.");
      return;
    }

    // Send the lesson content
    await sendLessonContent(ctx, lesson);
    
    // Increment lesson count
    await incrementLessonCount(userId);
    
    // Send quiz after lesson
    await sendQuiz(ctx, userId, lesson.theme);
    
  } catch (error) {
    logger.error('Error sending lesson:', error);
    await ctx.reply("❌ Sorry, there was an error sending the lesson. Please try again later.");
  }
}

/**
 * Generate a new lesson using OpenAI
 */
async function generateNewLesson(): Promise<LessonData | null> {
  try {
    logger.info('Generating new lesson');
    
    // Get recent themes from the last month
    const recentThemes = await lessonRepository.getRecentThemes();
    const recentQuizzes = await lessonRepository.getRecentQuizzes();
    logger.info(`Found ${recentThemes.length} recent themes to avoid`);
    
    // Generate lesson using OpenAI with recent themes to avoid
    const lessonSections = await openaiClient.generateLesson(recentThemes, recentQuizzes);
    
    // Format content
    const formattedContent = formatLessonContent(lessonSections);
    
    // Format vocabulary
    const formattedVocabulary = formatVocabulary(lessonSections.vocabulary);
    
    // Create the lesson
    const lesson: LessonData = {
      id: `lesson-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      title: lessonSections.title,
      theme: lessonSections.theme,
      content: formattedContent,
      vocabulary: formattedVocabulary,
      hasVocabulary: lessonSections.vocabulary.length > 0,
      createdAt: new Date().toISOString(),
      quizQuestion: lessonSections.quizQuestion,
      quizOptions: lessonSections.quizOptions,
      quizCorrectIndex: lessonSections.correctOptionIndex,
      explanation: lessonSections.explanation,
      optionExplanations: lessonSections.optionExplanations,
      example_link: lessonSections.example_link,
      videoQuery: lessonSections.videoQuery
    };
    
    // Save to database
    const savedLesson = await lessonRepository.saveLesson(lesson);
    
    return savedLesson;
  } catch (error) {
    logger.error('Error generating new lesson:', error);
    return null;
  }
}

/**
 * Format lesson content from lesson sections
 */
function formatLessonContent(sections: LessonSections): string {
  let content = '';
  
  // Add content points
  if (Array.isArray(sections.contentPoints) && sections.contentPoints.length > 0) {
    content = sections.contentPoints.join('\n\n');
  }  
  return content;
}

/**
 * Format vocabulary terms
 */
function formatVocabulary(vocabularyTerms: Array<{ term: string; definition: string; example: string }>): string {
  if (!vocabularyTerms || vocabularyTerms.length === 0) {
    return '';
  }
  
  return '<b>📚 Key Vocabulary</b>\n\n' + 
    vocabularyTerms
      .map(item => `<b>${item.term}</b>: ${item.definition}\n<i>Example:</i> ${item.example}`)
      .join('\n\n');
}

/**
 * Send lesson content to user
 */
async function sendLessonContent(ctx: BotContext, lesson: LessonData): Promise<void> {
  try {
    // Send title and main content together
    const formattedContent = `📚 <b>${lesson.title}</b>\n\n${lesson.content}`;
    await ctx.reply(sanitizeHtmlForTelegram(formattedContent), { parse_mode: 'HTML' });

      // Send real world example
      if (lesson.example_link) {
        await ctx.reply(`🔍 Real-World Example:\n<a href="${lesson.example_link.url}">${lesson.example_link.url}</a>\n${lesson.example_link.description}`, { parse_mode: 'HTML' });
      }

    
    // Send vocabulary if exists
    if (lesson.hasVocabulary) {
      await ctx.reply(sanitizeHtmlForTelegram(lesson.vocabulary), { parse_mode: 'HTML' });
    }
    
    // Get and send related video if available
    if (lesson.videoQuery) {
      const video = await youtubeClient.searchTutorialVideo(lesson.videoQuery);
      if (video) {
        await ctx.reply(`🎥 Related Tutorial Video\n\n<b>${video.title}</b>\n\nWatch this helpful video to learn more about ${lesson.theme}:
          \n<i> Duration: ${video.duration}</i>\n\n${video.url}`, {
          parse_mode: 'HTML',
        });
      }
    }
  } catch (error) {
    logger.error('Error sending lesson content:', error);
    throw error;
  }
}

// Export other utility functions as needed
export { generateNewLesson, sendLessonContent }; 