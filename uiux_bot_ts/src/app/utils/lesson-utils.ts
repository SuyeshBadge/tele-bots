import { BotContext } from '../bot/handlers/types';
import { getChildLogger } from './logger';
import { getSubscriber, incrementLessonCount, getSentVideoIds, recordSentVideo } from './persistence';
import { lessonRepository } from './lesson-repository';
import { LessonData } from './lesson-types';
import claudeClient from '../api/claude-client';
import { LessonSections } from '../api/claude-client';
import * as imageManager from '../api/image-manager';
import * as youtubeClient from '../api/youtube-client';
import { sendQuiz } from '../bot/handlers/quiz-handlers';
import { sanitizeHtmlForTelegram } from './telegram-utils';
import batchProcessor from '../api/batch-processor';

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
    
    // Try to get a lesson from the on-demand pool that hasn't been sent to this user
    logger.info('Trying to get lesson from on-demand pool');
    let lesson = await batchProcessor.getAvailableLessonFromPool('on-demand', userId);
    
    if (!lesson) {
      // If no lesson found in the pool, generate a new one
      logger.warn('No lesson available in on-demand pool, generating one dynamically');
      lesson = await generateNewLesson();
    }
    
    if (!lesson) {
      logger.error('Failed to get or generate a lesson');
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
        imageUrl = imageDetails.url;
      }
    } catch (error) {
      logger.error(`Error getting image for lesson: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Send the lesson content
    try {
      await sendLessonToRecipient(ctx, lesson, imageUrl || undefined);
      
      // Record that this lesson was delivered to this user
      await lessonRepository.trackLessonDelivery(userId, lesson.id, 'on-demand');
      
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
 * Generate a new lesson using Claude
 */
async function generateNewLesson(): Promise<LessonData | null> {
  try {
    logger.info('Generating lesson content with Claude API');
    
    // Get recent themes from the last month
    const recentThemes = await lessonRepository.getRecentThemes();
    const recentQuizzes = await lessonRepository.getRecentQuizzes();
    
    // Generate lesson using Claude with recent themes to avoid
    const lessonSections = await claudeClient.generateLesson(recentThemes, recentQuizzes);
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
      videoQuery: lessonSections.videoQuery,
      pool_type: 'on-demand',
      is_used: true,
      used_at: new Date().toISOString()
    };
    
    // Save to database
    try {
      const savedLesson = await lessonRepository.saveLesson(lesson);
      logger.info(`Successfully saved lesson with ID ${lesson.id}`);
      
      // Check if the pool needs refilling and schedule it if needed
      await batchProcessor.checkAndRefillPoolIfNeeded('on-demand');
      
      return savedLesson;
    } catch (error) {
      logger.error(`Failed to save lesson to database: ${error instanceof Error ? error.message : String(error)}`);
      throw error; // Re-throw to be caught by outer catch
    }
  } catch (error) {
    logger.error(`Error generating new lesson: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

/**
 * Format lesson content from lesson sections
 */
export function formatLessonContent(sections: LessonSections | {contentPoints: string[], example_link?: {url: string, description: string}}): string {
  try {
    let content = '';
    
    // Add content points
    if (Array.isArray(sections.contentPoints) && sections.contentPoints.length > 0) {
      // Ensure each content point has proper spacing and preserves emojis
      content = sections.contentPoints
        .filter(point => point && point.trim() !== '')
        .map(point => {
          // Make sure each point has an emoji at the beginning
          if (!point.match(/^\p{Emoji}/u)) {
            return `🔹 ${point}`;
          }
          return point;
        })
        .join('\n\n');
    } else {
      // Fallback content if no content points are available
      content = "🔹 UI/UX design focuses on creating interfaces that are both visually appealing and functional.\n\n" +
                "🔸 User research and testing are essential for creating effective designs.\n\n" +
                "📱 Responsive design ensures a good experience across different devices.";
    }
    
    // Add example link if available
    if (sections.example_link) {
      content += `\n\n<b>🔍 Real-World Example:</b>\n<a href="${sections.example_link.url}">${sections.example_link.url}</a>\n${sections.example_link.description}`;
    }
    
    return content;
  } catch (error) {
    logger.error(`Error formatting lesson content: ${error instanceof Error ? error.message : String(error)}`);
    // Return fallback content in case of error
    return "🔹 UI/UX design focuses on creating interfaces that are both visually appealing and functional.\n\n" +
           "🔸 User research and testing are essential for creating effective designs.\n\n" +
           "📱 Responsive design ensures a good experience across different devices.";
  }
}

/**
 * Format vocabulary terms
 */
export function formatVocabulary(vocabularyTerms: Array<{ term: string; definition: string; example: string }>): string {
  try {
    if (!vocabularyTerms || vocabularyTerms.length === 0) {
      // Return empty string if no vocabulary terms
      return '';
    }
    
    // Format vocabulary terms with proper HTML for Telegram
    return '<b>📚 Key Vocabulary</b>\n\n' + 
      vocabularyTerms
        .filter(item => item && item.term && item.definition)
        .map(item => {
          // Ensure proper formatting with bold terms and italicized examples
          const term = item.term.trim();
          const definition = item.definition.trim();
          const example = item.example ? item.example.trim() : '';
          
          let formatted = `<b>${term}</b>: ${definition}`;
          if (example) {
            formatted += `\n<i>Example:</i> ${example}`;
          }
          
          return formatted;
        })
        .join('\n\n');
  } catch (error) {
    logger.error(`Error formatting vocabulary: ${error instanceof Error ? error.message : String(error)}`);
    
    // Return fallback content in case of error
    return '<b>📚 Key Vocabulary</b>\n\n' +
           '<b>User Experience (UX)</b>: The overall experience of a person using a product or service.\n<i>Example:</i> How easily a user can complete a task on a website.\n\n' +
           '<b>User Interface (UI)</b>: The visual elements users interact with in a product.\n<i>Example:</i> Buttons, menus, and layout of a mobile app.';
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
    
    // Ensure lesson has required fields
    const safeLesson = {
      title: lesson.title || "UI/UX Design Principles",
      content: lesson.content || "🔹 UI/UX design focuses on creating intuitive interfaces.",
      hasVocabulary: lesson.hasVocabulary && lesson.vocabulary ? true : false,
      vocabulary: lesson.vocabulary || "",
      videoQuery: Array.isArray(lesson.videoQuery) ? lesson.videoQuery : [],
      theme: lesson.theme || "UI/UX Design",
      example_link: lesson.example_link
    };
    
    // Send title and main content together - sanitize for Telegram
    const formattedContent = sanitizeHtmlForTelegram(`📚 <b>${safeLesson.title}</b>\n\n${safeLesson.content}`);
    
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
    if (safeLesson.hasVocabulary && safeLesson.vocabulary) {
      await bot.sendMessage(chatId, sanitizeHtmlForTelegram(safeLesson.vocabulary), {
        parse_mode: 'HTML'
      });
    }
    
    // Send example link if available in a separate message for better visibility
    if (safeLesson.example_link && safeLesson.example_link.url) {
      const exampleMessage = `<b>🔍 Real-World Example:</b>\n<a href="${safeLesson.example_link.url}">${safeLesson.example_link.url}</a>\n${safeLesson.example_link.description || ""}`;
      await bot.sendMessage(chatId, sanitizeHtmlForTelegram(exampleMessage), {
        parse_mode: 'HTML',
        disable_web_page_preview: false
      });
    }
    
    // Get and send related video if available
    if (safeLesson.videoQuery && safeLesson.videoQuery.length > 0) {
      for (const query of safeLesson.videoQuery) {
        try {
          const video = await youtubeClient.searchTutorialVideo(query);
          if (video) {
            const videoMessage = sanitizeHtmlForTelegram(
              `🎥 <b>Related Tutorial Video</b>\n\n<b>${video.title}</b>\n\nWatch this helpful video to learn more about ${safeLesson.theme}:\n<i>Duration: ${video.duration}</i>\n\n${video.url}`
            );
            
            await bot.sendMessage(chatId, videoMessage, { 
              parse_mode: 'HTML',
              disable_web_page_preview: false
            });
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

/**
 * Send a scheduled lesson to all subscribers
 */
async function getScheduledLesson(): Promise<LessonData | null> {
  try {
    logger.info('Getting scheduled lesson');
    
    // Try to get a lesson from the scheduled pool
    logger.info('Trying to get lesson from scheduled pool');
    const poolLesson = await batchProcessor.getAvailableLessonFromPool('scheduled');
    
    if (poolLesson) {
      logger.info(`Using lesson from scheduled pool: ${poolLesson.id}`);
      
      // Mark the lesson as used
      await batchProcessor.markLessonAsUsed(poolLesson.id);
      
      return poolLesson;
    }
    
    // If no lesson available in pool, fall back to on-demand generation
    // This should be rare if the pool system is working properly
    logger.warn('No lesson available in scheduled pool, trying on-demand pool');
    
    // Try on-demand pool as a fallback
    const onDemandLesson = await batchProcessor.getAvailableLessonFromPool('on-demand');
    
    if (onDemandLesson) {
      logger.info(`Using lesson from on-demand pool as fallback: ${onDemandLesson.id}`);
      
      // Mark the lesson as used
      await batchProcessor.markLessonAsUsed(onDemandLesson.id);
      
      return onDemandLesson;
    }
    
    // If still no lesson, fall back to dynamic generation
    logger.warn('No lesson available in any pool, generating one dynamically');
    const newLesson = await generateNewLesson();
    
    // If we've dynamically generated a lesson, make sure it works with the scheduled pool
    if (newLesson) {
      // Set pool type to scheduled and ensure it's marked as used
      newLesson.pool_type = 'scheduled';
      newLesson.is_used = true;
      newLesson.used_at = new Date().toISOString();
      
      // Save the updated lesson
      await lessonRepository.saveLesson(newLesson);
      
      // Also update pool stats since we're using this lesson
      await lessonRepository.decrementPoolAvailableCount('scheduled');
    }
    
    return newLesson;
  } catch (error) {
    logger.error(`Error getting scheduled lesson: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

// Export utility functions that aren't already exported individually
export {
  sendLessonToRecipient,
  getScheduledLesson
} 