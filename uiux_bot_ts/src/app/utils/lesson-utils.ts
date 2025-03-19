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
      logger.error(`Error getting image for lesson: ${error}`);
    }

    // Send the lesson content using unified function
    await sendLessonToRecipient(ctx, lesson, imageUrl || undefined);
    
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
export function formatLessonContent(sections: LessonSections): string {
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
}

/**
 * Format vocabulary terms
 */
export function formatVocabulary(vocabularyTerms: Array<{ term: string; definition: string; example: string }>): string {
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

/**
 * Send lesson content - flexible method for both requested and scheduled lessons
 * @param recipient - Either BotContext or { bot, chatId } for direct API calls
 * @param lesson - The lesson data to send
 * @param imageUrl - Optional image URL to include with the message
 */
async function sendLessonToRecipient(
  recipient: BotContext | { bot: any, chatId: number | string }, 
  lesson: LessonData | LessonSections,
  imageUrl?: string
): Promise<void> {
  try {
    const isContext = 'reply' in recipient;
    
    // Format the content based on lesson type
    let formattedContent: string;
    let formattedVocabulary: string = '';
    let title: string;
    let theme: string;
    let videoQuery: string | undefined;
    
    // Handle different lesson data structures
    if ('content' in lesson) {
      // It's a LessonData object
      formattedContent = lesson.content;
      title = lesson.title;
      theme = lesson.theme;
      videoQuery = lesson.videoQuery;
      
      if (lesson.hasVocabulary) {
        formattedVocabulary = lesson.vocabulary;
      }
    } else {
      // It's a LessonSections object
      formattedContent = formatLessonContent(lesson);
      formattedVocabulary = formatVocabulary(lesson.vocabulary);
      title = lesson.title;
      theme = lesson.theme;
      videoQuery = lesson.videoQuery;
    }
    
    // Combine title and main content
    const mainContentWithTitle = `${sanitizeHtmlForTelegram(title)}\n\n${sanitizeHtmlForTelegram(formattedContent)}`;
    
    // 1. Send the title and main content with image if available
    if (imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'))) {
      // Check if combined content exceeds Telegram's caption limit (1024 characters)
      if (mainContentWithTitle.length <= 1024) {
        // If it fits, send image with combined title and content as caption
        if (isContext) {
          await (recipient as BotContext).replyWithPhoto(
            imageUrl,
            {
              caption: mainContentWithTitle,
              parse_mode: 'HTML'
            }
          );
        } else {
          const { bot, chatId } = recipient as { bot: any, chatId: number | string };
          await bot.api.sendPhoto(
            chatId, 
            imageUrl, 
            {
              caption: mainContentWithTitle,
              parse_mode: 'HTML'
            }
          );
        }
      } else {
        // If too long, send image with just the title
        if (isContext) {
          await (recipient as BotContext).replyWithPhoto(
            imageUrl,
            {
              caption: sanitizeHtmlForTelegram(title),
              parse_mode: 'HTML'
            }
          );
          
          // Then send the main content separately
          await (recipient as BotContext).reply(
            sanitizeHtmlForTelegram(formattedContent),
            { parse_mode: 'HTML' }
          );
        } else {
          const { bot, chatId } = recipient as { bot: any, chatId: number | string };
          await bot.api.sendPhoto(
            chatId, 
            imageUrl, 
            {
              caption: sanitizeHtmlForTelegram(title),
              parse_mode: 'HTML'
            }
          );
          
          // Then send the main content separately
          await bot.api.sendMessage(
            chatId,
            sanitizeHtmlForTelegram(formattedContent),
            { parse_mode: 'HTML' }
          );
        }
      }
    } else {
      // No image, just send text
      if (isContext) {
        await (recipient as BotContext).reply(
          mainContentWithTitle,
          { parse_mode: 'HTML' }
        );
      } else {
        const { bot, chatId } = recipient as { bot: any, chatId: number | string };
        await bot.api.sendMessage(
          chatId,
          mainContentWithTitle,
          { parse_mode: 'HTML' }
        );
      }
    }
    
    // 2. Send vocabulary separately if available
    if (formattedVocabulary && formattedVocabulary.length > 0) {
      if (isContext) {
        await (recipient as BotContext).reply(
          sanitizeHtmlForTelegram(formattedVocabulary),
          { parse_mode: 'HTML' }
        );
      } else {
        const { bot, chatId } = recipient as { bot: any, chatId: number | string };
        await bot.api.sendMessage(
          chatId,
          sanitizeHtmlForTelegram(formattedVocabulary),
          { parse_mode: 'HTML' }
        );
      }
    }
    
    // 3. Get and send related video if available
    if (videoQuery) {
      try {
        // Get user ID from recipient
        const userId = isContext 
          ? (recipient as BotContext).from?.id 
          : parseInt(String((recipient as { bot: any, chatId: number | string }).chatId));
        
        if (!userId) {
          logger.error('Cannot determine user ID for sending video');
          return;
        }
        
        // Get list of previously sent video IDs for this user
        const sentVideoIds = await getSubscriber(userId) 
          ? await getSentVideoIds(userId)
          : [];
        
        // Try with the original video query
        const video = await youtubeClient.searchTutorialVideo(videoQuery, sentVideoIds);
        if (video) {
          // Extract video ID from URL
          const videoIdMatch = video.url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
          const videoId = videoIdMatch ? videoIdMatch[1] : null;
          
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
          if (videoId) {
            await recordSentVideo(userId, videoId, theme);
            logger.info(`Recorded sent video ID: ${videoId} for user ${userId}`);
          }
        } else {
          // If no video found with the specific query, try more aggressive fallbacks
          await sendVideoWithFallbacks(recipient, theme, isContext);
        }
      } catch (videoError) {
        logger.error(`Error sending video: ${videoError instanceof Error ? videoError.message : String(videoError)}`);
        // Still try fallbacks even after error
        try {
          await sendVideoWithFallbacks(recipient, theme, isContext);
        } catch (fallbackError) {
          logger.error(`Error sending fallback video: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`);
        }
      }
    } else {
      // No videoQuery provided, try using the theme directly with fallbacks
      try {
        await sendVideoWithFallbacks(recipient, theme, isContext);
      } catch (videoError) {
        logger.error(`Error sending fallback video: ${videoError instanceof Error ? videoError.message : String(videoError)}`);
      }
    }
    
  } catch (error) {
    logger.error('Error sending lesson content:', error);
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
        const videos = await youtubeClient.searchTutorialVideos(term, sentVideoIds, 3);
        
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