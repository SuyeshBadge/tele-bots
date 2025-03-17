import { Injectable } from '@nestjs/common';
import { TELEGRAM_MESSAGES } from './telegram.messages';

type MessageKey = keyof typeof TELEGRAM_MESSAGES;
type MessageValue = typeof TELEGRAM_MESSAGES[MessageKey];

@Injectable()
export class TelegramMessageService {
  formatMessage(messageKey: MessageKey, params: Record<string, string> = {}): string {
    const message = TELEGRAM_MESSAGES[messageKey];
    
    // Handle non-string messages (like button arrays)
    if (typeof message !== 'string') {
      return String(message);
    }
    
    // Handle string messages with parameter replacement
    return Object.entries(params).reduce(
      (acc, [key, value]) => acc.replace(`{${key}}`, value),
      message
    );
  }
} 