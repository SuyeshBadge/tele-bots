import { BotContext } from './types';
import { getChildLogger } from '../../utils/logger';
import { sendLesson as sendLessonUtil } from '../../utils/lesson-utils';

const logger = getChildLogger('lesson-handlers');

/**
 * Handle the /lesson command
 */
export async function handleLessonCommand(ctx: BotContext): Promise<void> {
  try {
    const userId = ctx.from?.id;
    if (!userId) {
      logger.error('No user ID found in context');
      return;
    }

    await sendLessonUtil(ctx, userId);
  } catch (error) {
    logger.error('Error handling lesson command:', error);
    await ctx.reply('Sorry, there was an error processing your request. Please try again later.');
  }
}

/**
 * Handle the /next command
 */
export async function handleNextCommand(ctx: BotContext): Promise<void> {
  try {
    const userId = ctx.from?.id;
    if (!userId) {
      logger.error('No user ID found in context');
      return;
    }

    await sendLessonUtil(ctx, userId);
  } catch (error) {
    logger.error('Error handling next command:', error);
    await ctx.reply('Sorry, there was an error processing your request. Please try again later.');
  }
} 