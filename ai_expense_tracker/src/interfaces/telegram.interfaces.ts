/**
 * Telegram-specific interfaces and type definitions for GramIO integration
 * 
 * These interfaces are based on the actual structure of GramIO's context objects,
 * which use camelCase and a more normalized structure than the raw Telegram API.
 */
import { Bot, Context } from 'gramio';
import type { TelegramMessage, TelegramUser as GramioTelegramUser, TelegramCallbackQuery, TelegramUpdate } from '@gramio/types';

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
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

/**
 * Chat object as represented in GramIO
 */
export interface Chat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  is_forum?: boolean;
}

/**
 * Message interface as represented in GramIO
 */
export interface Message {
  message_id: number;
  from: TelegramUser;
  date: number;
  chat: Chat;
}

/**
 * Message options for sending messages
 */
export interface MessageOptions {
  parse_mode?: 'Markdown' | 'HTML';
  reply_markup?: ReplyMarkup;
  reply_to_message_id?: number;
  disable_notification?: boolean;
  protect_content?: boolean;
}

/**
 * Edit message options
 */
export interface EditMessageOptions {
  parse_mode?: 'Markdown' | 'HTML';
  reply_markup?: ReplyMarkup;
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
export interface ReplyMarkup {
  keyboard?: KeyboardButton[][];
  inline_keyboard?: InlineKeyboardButton[][];
  resize_keyboard?: boolean;
  one_time_keyboard?: boolean;
  selective?: boolean;
  remove_keyboard?: boolean;
}

/**
 * Keyboard button interface
 */
export interface KeyboardButton {
  text: string;
  request_contact?: boolean;
  request_location?: boolean;
  request_poll?: KeyboardButtonPollType;
  web_app?: WebAppInfo;
}

/**
 * Inline keyboard button interface
 */
export interface InlineKeyboardButton {
  text: string;
  url?: string;
  callback_data?: string;
  web_app?: WebAppInfo;
  login_url?: LoginUrl;
  switch_inline_query?: string;
  switch_inline_query_current_chat?: string;
  callback_game?: CallbackGame;
  pay?: boolean;
}

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
export interface LoginUrl {
  url: string;
  forward_text?: string;
  bot_username?: string;
  request_write_access?: boolean;
}

/**
 * Callback game interface
 */
export interface CallbackGame {}

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
  photo?: PhotoSize[];
  document?: Document;
  video?: Video;
  audio?: Audio;
  sticker?: Sticker;
  location?: Location;
}

/**
 * Callback query context in GramIO
 */
export interface CallbackQueryContext extends BaseContext {
  callbackQuery: {
    id: string;
    data?: string;
    queryPayload?: string;
    from: TelegramUser;
    message?: Message;
  };
}

/**
 * Union type for all possible context types
 */
export type BotContext = MessageContext | CallbackQueryContext;

/**
 * Type guard to check if context is a callback query context
 */
export function isCallbackQueryContext(ctx: BotContext): ctx is CallbackQueryContext {
  return 'callbackQuery' in ctx && ctx.callbackQuery !== undefined;
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
export interface PhotoSize {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  file_size?: number;
}

/**
 * Document interface
 */
export interface Document {
  file_id: string;
  file_unique_id: string;
  thumb?: PhotoSize;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}

/**
 * Video interface
 */
export interface Video {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  duration: number;
  thumb?: PhotoSize;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}

/**
 * Audio interface
 */
export interface Audio {
  file_id: string;
  file_unique_id: string;
  duration: number;
  performer?: string;
  title?: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
  thumb?: PhotoSize;
}

/**
 * Sticker interface
 */
export interface Sticker {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  is_animated: boolean;
  is_video: boolean;
  thumb?: PhotoSize;
  emoji?: string;
  set_name?: string;
  mask_position?: MaskPosition;
  file_size?: number;
}

/**
 * Location interface
 */
export interface Location {
  latitude: number;
  longitude: number;
  horizontal_accuracy?: number;
  live_period?: number;
  heading?: number;
  proximity_alert_radius?: number;
}

/**
 * Mask position interface
 */
export interface MaskPosition {
  point: 'forehead' | 'eyes' | 'mouth' | 'chin';
  x_shift: number;
  y_shift: number;
  scale: number;
}

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