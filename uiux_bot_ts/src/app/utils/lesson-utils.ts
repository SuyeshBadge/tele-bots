import { BotContext } from '../bot/handlers/types';
import { getChildLogger } from './logger';
import { getSubscriber, incrementLessonCount, getSentVideoIds, recordSentVideo } from './persistence';
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
      logger.error('Failed to generate new lesson');
      await ctx.reply("❌ Sorry, I couldn't generate a lesson right now. Please try again later.");
      return;
    }

    // Get an image for the lesson
    let imageUrl = null;
    try {
      // Import dynamically to avoid circular dependencies
      const { getImageForLesson } = await import('../api/image-manager');
      const imageDetails = await getImageForLesson(lesson.theme);
      if (imageDetails && imageDetails.url) {
        // Prioritize remote URLs for Telegram
        imageUrl = imageDetails.url;
      }
    } catch (error) {
      logger.error(`Error getting image for lesson: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Send the lesson content using unified function
    try {
      await sendLessonToRecipient(ctx, lesson, imageUrl || undefined);
      
      // Increment lesson count
      await incrementLessonCount(userId);
      
      // Send quiz after lesson
      await sendQuiz(ctx, userId, lesson.theme);
    } catch (error) {
      logger.error(`Error sending lesson to recipient: ${error instanceof Error ? error.message : String(error)}`);
      await ctx.reply("❌ Sorry, there was an error sending the lesson. Please try again later.");
    }
  } catch (error) {
    logger.error(`Error in sendLesson: ${error instanceof Error ? error.message : String(error)}`);
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
    
    // Generate lesson using OpenAI with recent themes to avoid
    const lessonSections = await openaiClient.generateLesson(recentThemes, recentQuizzes);
    if (!lessonSections) {
      throw new Error('Failed to generate lesson sections');
    }
    
    // Format content
    const formattedContent = formatLessonContent(lessonSections);
    
    // Format vocabulary
    const formattedVocabulary = formatVocabulary(lessonSections.vocabulary);
    
    // Create the lesson with the correct schema
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
    try {
      const savedLesson = await lessonRepository.saveLesson(lesson);
      logger.info(`Successfully saved lesson with ID ${lesson.id}`);
      return savedLesson;
    } catch (error) {
      logger.error(`Failed to save lesson to database: ${error instanceof Error ? error.message : String(error)}`);
      throw error; // Re-throw to be caught by outer catch
    }
  } catch (error) {
    logger.error(`Error generating new lesson: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * Format lesson content from lesson sections
 */
export function formatLessonContent(sections: LessonSections): string {
  try {
    let content = '';
    
    // Add content points
    if (Array.isArray(sections.contentPoints) && sections.contentPoints.length > 0) {
      content = sections.contentPoints.join('\n\n');
    }
    
    // Add example link if available
    if (sections.example_link) {
      content += `\n\n<b>🔍 Real-World Example:</b>\n<a href="${sections.example_link.url}">${sections.example_link.url}</a>\n${sections.example_link.description}`;
    }
    
    return content;
  } catch (error) {
    logger.error(`Error formatting lesson content: ${error instanceof Error ? error.message : String(error)}`);
    return '';
  }
}

/**
 * Format vocabulary terms
 */
export function formatVocabulary(vocabularyTerms: Array<{ term: string; definition: string; example: string }>): string {
  try {
    if (!vocabularyTerms || vocabularyTerms.length === 0) {
      return '';
    }
    
    return '<b>📚 Key Vocabulary</b>\n\n' + 
      vocabularyTerms
        .map(item => `<b>${item.term}</b>: ${item.definition}\n<i>Example:</i> ${item.example}`)
        .join('\n\n');
  } catch (error) {
    logger.error(`Error formatting vocabulary: ${error instanceof Error ? error.message : String(error)}`);
    return '';
  }
}

/**
 * Send lesson content to user
 * @deprecated Use sendLessonToRecipient instead
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
      lesson.videoQuery.forEach(async (query) => {
        const video = await youtubeClient.searchTutorialVideo(query);
        if (video) {
          await ctx.reply(`🎥 Related Tutorial Video\n\n<b>${video.title}</b>\n\nWatch this helpful video to learn more about ${lesson.theme}:
          \n<i> Duration: ${video.duration}</i>\n\n${video.url}`, {
          parse_mode: 'HTML',
        });
        }
      });
    }
  } catch (error) {
    logger.error('Error sending lesson content:', error);
    throw error;
  }
}

/**
 * Send lesson content - flexible method for both requested and scheduled lessons
 * @param recipient - Either BotContext or { bot, chatId } for direct API calls
 * @param lesson - The lesson data to send
 * @param imageUrl - Optional image URL to send with the lesson
 */
async function sendLessonToRecipient(
  recipient: BotContext | { bot: any; chatId: number },
  lesson: LessonData,
  imageUrl?: string
): Promise<void> {
  try {
    const isContext = 'reply' in recipient;
    const bot = isContext ? (recipient as BotContext).api : (recipient as { bot: any; chatId: number }).bot.api;
    const chatId = isContext ? (recipient as BotContext).chat?.id : (recipient as { bot: any; chatId: number }).chatId;
    
    if (!chatId) {
      throw new Error('Could not determine chat ID for sending lesson');
    }
    
    // Send title and main content together
    const formattedContent = `📚 <b>${lesson.title}</b>\n\n${lesson.content}`;
    
    if (imageUrl) {
      // Send with image if available
      await bot.sendPhoto(chatId, imageUrl, {
        caption: formattedContent,
        parse_mode: 'HTML'
      });
    } else {
      // Send without image
      await bot.sendMessage(chatId, formattedContent, {
        parse_mode: 'HTML'
      });
    }
    
    // Send vocabulary if exists
    if (lesson.hasVocabulary) {
      await bot.sendMessage(chatId, lesson.vocabulary, {
        parse_mode: 'HTML'
      });
    }
    
    // Get and send related video if available
    if (lesson.videoQuery) {
      for (const query of lesson.videoQuery) {
        try {
          const video = await youtubeClient.searchTutorialVideo(query);
          if (video) {
            await bot.sendMessage(chatId, 
              `🎥 Related Tutorial Video\n\n<b>${video.title}</b>\n\nWatch this helpful video to learn more about ${lesson.theme}:\n<i>Duration: ${video.duration}</i>\n\n${video.url}`,
              { parse_mode: 'HTML' }
            );
          }
        } catch (error) {
          logger.error(`Error sending video for query ${query}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
  } catch (error) {
    logger.error(`Error sending lesson to recipient: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

/**
 * Try multiple approaches to find and send a relevant video
 * @param recipient - The recipient (context or bot+chatId)
 * @param theme - The lesson theme
 * @param isContext - Whether recipient is a context
 */
async function sendVideoWithFallbacks(
  recipient: BotContext | { bot: any, chatId: number | string },
  theme: string,
  isContext: boolean
): Promise<boolean> {
  try {
    // Get user ID from recipient
    const userId = isContext 
      ? (recipient as BotContext).from?.id 
      : parseInt(String((recipient as { bot: any, chatId: number | string }).chatId));
    
    if (!userId) {
      logger.error('Cannot determine user ID for sending video');
      return false;
    }
    
    // Get list of previously sent video IDs for this user
    const sentVideoIds = await getSubscriber(userId) 
      ? await getSentVideoIds(userId)
      : [];
    
    // List of search terms to try in order
    const searchTerms = [
      theme,
      `${theme} design`,
      `${theme} UI UX`,
      "UI UX design basics",
      "design principles",
      "user experience fundamentals"
    ];
    
    // Try each search term until we find a video
    for (const term of searchTerms) {
      try {
        // Try to get multiple videos
        const videos = await youtubeClient.searchTutorialVideos([term], sentVideoIds, 3);
        
        if (videos.length > 0) {
          // Pick the first video that hasn't been sent
          const video = videos[0];
          
          // Extract video ID from URL
          const videoIdMatch = video.url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
          const videoId = videoIdMatch ? videoIdMatch[1] : null;
          
          if (videoId) {
            // Send the video
            const videoMessage = `🎥 Related Tutorial Video\n\n<b>${video.title}</b>\n\nWatch this helpful video to learn more about ${theme}:
            \n<i>Duration: ${video.duration}</i>\n\n${video.url}`;
            
            if (isContext) {
              await (recipient as BotContext).reply(
                sanitizeHtmlForTelegram(videoMessage),
                { parse_mode: 'HTML' }
              );
            } else {
              const { bot, chatId } = recipient as { bot: any, chatId: number | string };
              await bot.api.sendMessage(
                chatId,
                sanitizeHtmlForTelegram(videoMessage),
                { parse_mode: 'HTML' }
              );
            }
            
            // Record that we sent this video
            await recordSentVideo(userId, videoId, theme);
            
            logger.info(`Successfully sent video for term: ${term}, video ID: ${videoId}`);
            return true;
          }
        }
      } catch (error) {
        logger.error(`Error trying video fallback term "${term}": ${error instanceof Error ? error.message : String(error)}`);
        // Continue to next term
      }
    }
    
    logger.warn(`Couldn't find any suitable videos after trying all fallback terms for theme: ${theme}`);
    return false;
  } catch (error) {
    logger.error(`Error in sendVideoWithFallbacks: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

// Export other utility functions as needed
export { generateNewLesson, sendLessonContent, sendLessonToRecipient }; 