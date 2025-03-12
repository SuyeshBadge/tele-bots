/**
 * Telegram-specific interfaces and type definitions for GramIO integration
 * 
 * These interfaces are based on the actual structure of GramIO's context objects,
 * which use camelCase and a more normalized structure than the raw Telegram API.
 */
import { Bot } from 'gramio';
import type { Context } from 'gramio';

/**
 * Reference to GramIO's Bot Context type
 * Used primarily for documentation, not directly in code
 */
export type GramioContext = Context<Bot>;

/**
 * User object as represented in GramIO
 */
export interface TelegramUser {
  id: number;
  firstName: string;
  lastName?: string;
  username?: string;
  languageCode?: string;
}

/**
 * Chat object as represented in GramIO
 */
export interface Chat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  isForum?: boolean;
}

/**
 * Base context interface shared across all context types
 * Includes methods provided by GramIO
 */
export interface BaseContext {
  id: number;
  from?: TelegramUser;
  chat?: Chat;
  createdAt: number;
  
  // Common methods provided by GramIO
  send: (text: string, options?: any) => Promise<any>;
  reply: (text: string, options?: any) => Promise<any>;
  editMessageText: (text: string, options?: any) => Promise<any>;
  deleteMessage: (messageId?: number) => Promise<boolean>;
  answerCallbackQuery: (options?: any) => Promise<boolean>;
}

/**
 * Message context in GramIO
 */
export interface MessageContext extends BaseContext {
  text?: string;
  caption?: string;
  photo?: any[];
  document?: any;
  video?: any;
  audio?: any;
  sticker?: any;
  location?: any;
  // Other message types can be added as needed
}

/**
 * Callback query context in GramIO
 */
export interface CallbackQueryContext extends BaseContext {
  callbackQuery: {
    id: string;
    data?: string;
    from: TelegramUser;
    message?: any;
  };
}

/**
 * Union type for all possible context types
 */
export type BotContext = MessageContext | CallbackQueryContext;

/**
 * Type guard to check if context is a message context
 */
export function isMessageContext(ctx: BotContext): ctx is MessageContext {
  return 'text' in ctx || 'caption' in ctx || 'photo' in ctx || 'document' in ctx || 'video' in ctx;
}

/**
 * Type guard to check if context is a callback query context
 */
export function isCallbackQueryContext(ctx: BotContext): ctx is CallbackQueryContext {
  return 'callbackQuery' in ctx && ctx.callbackQuery !== undefined;
}

/**
 * Different callback actions available in the app
 */
export enum CallbackAction {
  CATEGORY_SELECT = 'category',
  SETTINGS = 'settings',
  SUMMARY = 'summary',
  EXPORT = 'export',
  CURRENCY = 'currency'
}

/**
 * Base callback query data interface
 */
export interface BaseCallbackQueryData {
  action: CallbackAction | string;
}

/**
 * Category selection callback data
 */
export interface CategoryCallbackData extends BaseCallbackQueryData {
  action: CallbackAction.CATEGORY_SELECT;
  categoryName: string;
}

/**
 * Settings callback data
 */
export interface SettingsCallbackData extends BaseCallbackQueryData {
  action: CallbackAction.SETTINGS;
  setting: 'categories' | 'currency' | 'export' | 'notifications';
}

/**
 * Union type for all callback data types
 */
export type CallbackQueryData = 
  | CategoryCallbackData
  | SettingsCallbackData
  | BaseCallbackQueryData;

/**
 * Parse callback_query data string into typed object
 * @param data Callback data string
 * @returns Parsed callback data with proper typing
 */
export function parseCallbackData(data: string): CallbackQueryData {
  try {
    // Handle simple callbacks like 'category_Food'
    if (data.includes('_')) {
      const [action, value] = data.split('_');
      
      if (action === 'category') {
        return {
          action: CallbackAction.CATEGORY_SELECT,
          categoryName: value
        };
      } else if (action === 'settings') {
        return {
          action: CallbackAction.SETTINGS,
          setting: value as SettingsCallbackData['setting']
        };
      }
    }
    
    // For more complex JSON data
    return JSON.parse(data);
  } catch {
    // Fallback for unparseable data
    return { action: data };
  }
} 