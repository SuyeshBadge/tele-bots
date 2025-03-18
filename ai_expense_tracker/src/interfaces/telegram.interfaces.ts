/**
 * Telegram-specific interfaces and type definitions for GramIO integration
 * 
 * These interfaces are based on the actual structure of GramIO's context objects,
 * which use camelCase and a more normalized structure than the raw Telegram API.
 */
import { Bot, Context } from 'gramio';
import type { 
  TelegramMessage as GramioTelegramMessage, 
  TelegramUser as GramioTelegramUser, 
  TelegramCallbackQuery as GramioTelegramCallbackQuery, 
  TelegramUpdate as GramioTelegramUpdate,
  TelegramChat as GramioTelegramChat,
  TelegramMessageEntity as GramioTelegramMessageEntity,
  TelegramInlineKeyboardMarkup,
  TelegramKeyboardButton as GramioTelegramKeyboardButton,
  TelegramInlineKeyboardButton as GramioTelegramInlineKeyboardButton,
  TelegramLoginUrl as GramioTelegramLoginUrl,
  TelegramCallbackGame as GramioTelegramCallbackGame,
  TelegramPhotoSize as GramioTelegramPhotoSize,
  TelegramDocument as GramioTelegramDocument,
  TelegramVideo as GramioTelegramVideo,
  TelegramAudio as GramioTelegramAudio,
  TelegramSticker as GramioTelegramSticker,
  TelegramLocation as GramioTelegramLocation,
  TelegramMaskPosition as GramioTelegramMaskPosition
} from '@gramio/types';

/**
 * Reference to GramIO's Bot Context type
 * Used primarily for documentation, not directly in code
 */
export type GramioContext = Context<Bot>;

/**
 * User object as represented in GramIO
 */
export interface TelegramUser extends GramioTelegramUser {}

/**
 * Chat object as represented in GramIO
 */
export interface Chat extends GramioTelegramChat {}

/**
 * Message interface as represented in GramIO
 */
export interface Message extends GramioTelegramMessage {}

/**
 * Message options for sending messages
 */
export interface MessageOptions {
  parse_mode?: 'Markdown' | 'HTML';
  reply_markup?: TelegramInlineKeyboardMarkup;
  reply_to_message_id?: number;
  disable_notification?: boolean;
  protect_content?: boolean;
}

/**
 * Edit message options
 */
export interface EditMessageOptions {
  parse_mode?: 'Markdown' | 'HTML';
  reply_markup?: TelegramInlineKeyboardMarkup;
  disable_web_page_preview?: boolean;
}

/**
 * Answer callback query options
 */
export interface AnswerCallbackQueryOptions {
  text?: string;
  show_alert?: boolean;
  url?: string;
  cache_time?: number;
}

/**
 * Reply markup interface
 */
export interface ReplyMarkup extends TelegramInlineKeyboardMarkup {}

/**
 * Keyboard button interface
 */
export interface KeyboardButton extends GramioTelegramKeyboardButton {}

/**
 * Inline keyboard button interface
 */
export interface InlineKeyboardButton extends GramioTelegramInlineKeyboardButton {}

/**
 * Keyboard button poll type interface
 */
export interface KeyboardButtonPollType {
  type?: string;
}

/**
 * Web app info interface
 */
export interface WebAppInfo {
  url: string;
}

/**
 * Login URL interface
 */
export interface LoginUrl extends GramioTelegramLoginUrl {}

/**
 * Callback game interface
 */
export interface CallbackGame extends GramioTelegramCallbackGame {}

/**
 * Base context interface shared across all context types
 * Includes methods provided by GramIO
 */
export interface BaseContext extends Context<Bot> {
  id: number;
  from?: TelegramUser;
  chat?: Chat;
  createdAt: number;
  api: {
    sendMessage(chatId: number | string, text: string, options?: MessageOptions): Promise<Message>;
    editMessageText(chatId: number | string, messageId: number, text: string, options?: EditMessageOptions): Promise<Message>;
    deleteMessage(chatId: number | string, messageId: number): Promise<boolean>;
    answerCallbackQuery(callbackQueryId: string, options?: AnswerCallbackQueryOptions): Promise<boolean>;
  };
  // Add convenience methods that use the api property
  send(text: string, options?: MessageOptions): Promise<Message>;
  reply(text: string, options?: MessageOptions): Promise<Message>;
  editMessageText(text: string, options?: EditMessageOptions): Promise<Message>;
  deleteMessage(messageId: number): Promise<boolean>;
  answerCallbackQuery(options?: AnswerCallbackQueryOptions): Promise<boolean>;
}

/**
 * Message context in GramIO
 */
export interface MessageContext extends BaseContext {
  text?: string;
  caption?: string;
  photo?: GramioTelegramPhotoSize[];
  document?: GramioTelegramDocument;
  video?: GramioTelegramVideo;
  audio?: GramioTelegramAudio;
  sticker?: GramioTelegramSticker;
  location?: GramioTelegramLocation;
}

/**
 * Callback query context in GramIO
 */
export interface CallbackQueryContext extends BaseContext {
  update: GramioTelegramUpdate & {
    callback_query: GramioTelegramCallbackQuery;
  };
  callbackQuery: GramioTelegramCallbackQuery;
}

/**
 * Union type for all possible context types
 */
export type BotContext = MessageContext | CallbackQueryContext;

/**
 * Type guard to check if context is a callback query context
 */
export function isCallbackQueryContext(ctx: BotContext): ctx is CallbackQueryContext {
  return 'update' in ctx && 'callback_query' in ctx.update;
}

/**
 * Type guard to check if context is a message context
 */
export function isMessageContext(ctx: BotContext): ctx is MessageContext {
  return 'text' in ctx || 'caption' in ctx || 'photo' in ctx || 'document' in ctx || 'video' in ctx;
}

/**
 * Photo size interface
 */
export interface PhotoSize extends GramioTelegramPhotoSize {}

/**
 * Document interface
 */
export interface Document extends GramioTelegramDocument {}

/**
 * Video interface
 */
export interface Video extends GramioTelegramVideo {}

/**
 * Audio interface
 */
export interface Audio extends GramioTelegramAudio {}

/**
 * Sticker interface
 */
export interface Sticker extends GramioTelegramSticker {}

/**
 * Location interface
 */
export interface Location extends GramioTelegramLocation {}

/**
 * Mask position interface
 */
export interface MaskPosition extends GramioTelegramMaskPosition {}

/**
 * Callback action type
 */
export type CallbackAction = 'add_expense' | 'view_expenses' | 'cancel';

/**
 * Callback query data interface
 */
export interface CallbackQueryData {
  action: CallbackAction;
  data?: any;
}

/**
 * Parse callback data from string
 */
export function parseCallbackData(data: string): CallbackQueryData {
  try {
    return JSON.parse(data);
  } catch (error) {
    return { action: data as CallbackAction };
  }
} 