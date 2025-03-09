import { Injectable } from '@nestjs/common';
import { getLogger } from '../utils/logger';
import { TELEGRAM_MESSAGES } from './telegram.messages';
import { MessageService } from '../common/messages/message.service';

@Injectable()
export class TelegramMessageService {
  private logger = getLogger('TelegramMessageService');

  constructor(private readonly messageService: MessageService) {}

  /**
   * Format a Telegram message by replacing variables with values
   * 
   * @param messageKey - The key of the message in TELEGRAM_MESSAGES
   * @param variables - Object containing variable names and values
   * @returns Formatted message with variables replaced
   */
  formatMessage(messageKey: keyof typeof TELEGRAM_MESSAGES, variables: Record<string, any> = {}): string {
    try {
      const template = TELEGRAM_MESSAGES[messageKey];
      if (!template) {
        this.logger.warn(`Message template not found for key: ${messageKey}`);
        return '';
      }
      
      // Handle both string templates and button arrays
      if (typeof template === 'string') {
        return this.messageService.format(template, variables);
      } else {
        // Just return an empty string if we accidentally got a button array
        this.logger.warn(`Template for key ${messageKey} is not a string`);
        return '';
      }
    } catch (error) {
      this.logger.error(`Error formatting telegram message: ${messageKey}`, error);
      return TELEGRAM_MESSAGES.GENERIC_ERROR;
    }
  }

  /**
   * Format an amount for display in Telegram messages
   * 
   * @param amount - Numeric amount to format
   * @param currency - Currency code (default: INR)
   * @returns Formatted currency string
   */
  formatAmount(amount: number, currency: string = 'INR'): string {
    return this.messageService.formatCurrency(amount, currency);
  }

  /**
   * Get a greeting message for the user based on time of day
   * 
   * @param name - User's name
   * @returns Time-appropriate greeting
   */
  getGreeting(name: string): string {
    return this.messageService.getGreeting(name);
  }

  /**
   * Format a category to include an appropriate emoji
   * 
   * @param category - Expense or income category
   * @returns Category with emoji
   */
  formatCategory(category: string): string {
    const emoji = this.messageService.getCategoryEmoji(category);
    return `${emoji} ${category}`;
  }

  /**
   * Format a percentage value for budget usage
   * 
   * @param value - Percentage value (0-100)
   * @returns Formatted percentage string with appropriate emoji
   */
  formatBudgetPercentage(value: number): string {
    let emoji = '✅';
    
    if (value >= 100) {
      emoji = '🚨';
    } else if (value >= 80) {
      emoji = '⚠️';
    } else if (value >= 50) {
      emoji = '📊';
    }
    
    return `${emoji} ${this.messageService.formatPercentage(value, 1)}`;
  }

  /**
   * Generate a message for budget usage
   * 
   * @param category - Budget category
   * @param percentage - Percentage used
   * @param amount - Amount left
   * @returns Formatted budget usage message
   */
  getBudgetUsageMessage(category: string, percentage: number, amount: number): string {
    if (percentage >= 100) {
      return `🚨 You've exceeded your ${this.formatCategory(category)} budget by ${this.formatAmount(Math.abs(amount))}.`;
    }
    
    if (percentage >= 80) {
      return `⚠️ You've used ${this.messageService.formatPercentage(percentage, 1)} of your ${this.formatCategory(category)} budget. ${this.formatAmount(amount)} remaining.`;
    }
    
    return `📊 You've used ${this.messageService.formatPercentage(percentage, 1)} of your ${this.formatCategory(category)} budget. ${this.formatAmount(amount)} remaining.`;
  }

  /**
   * Generate a congratulatory message for staying under budget
   * 
   * @param category - Budget category
   * @param savedAmount - Amount saved
   * @returns Congratulatory message
   */
  getUnderBudgetMessage(category: string, savedAmount: number): string {
    const emoji = this.messageService.getAchievementEmoji('under_budget');
    return `${emoji} Congratulations! You stayed under your ${this.formatCategory(category)} budget by ${this.formatAmount(savedAmount)} this month.`;
  }

  /**
   * Format a Telegram keyboard button with emoji
   * 
   * @param text - Button text
   * @param type - Button type for emoji selection
   * @returns Formatted button text with emoji
   */
  formatButton(text: string, type: 'category' | 'action' | 'setting' = 'category'): string {
    if (type === 'category') {
      const emoji = this.messageService.getCategoryEmoji(text);
      return `${emoji} ${text}`;
    }
    
    if (type === 'action') {
      const actionEmojis: Record<string, string> = {
        'cancel': '🚫',
        'done': '✅',
        'skip': '⏭️',
        'back': '⬅️',
        'next': '➡️',
        'yes': '👍',
        'no': '👎',
      };
      
      const emoji = actionEmojis[text.toLowerCase()] || '';
      return emoji ? `${emoji} ${text}` : text;
    }
    
    if (type === 'setting') {
      const settingEmojis: Record<string, string> = {
        'budget': '💰',
        'reminder': '⏰',
        'notifications': '🔔',
        'profile': '👤',
      };
      
      const emoji = settingEmojis[text.toLowerCase()] || '⚙️';
      return `${emoji} ${text}`;
    }
    
    return text;
  }
} 