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
        this.logger.warn(`Message template not found: ${messageKey}`);
        return 'Message not available';
      }

      // Handle both string templates and button arrays
      if (typeof template !== 'string') {
        this.logger.warn(`Template for key ${messageKey} is not a string`);
        return '';
      }

      // Replace all variables in the template
      let result = template;
      for (const [key, value] of Object.entries(variables)) {
        const placeholder = `{${key}}`;
        result = result.replace(new RegExp(placeholder, 'g'), value?.toString() || '');
      }

      // Return the message as is - no conversion
      return result;
    } catch (error) {
      this.logger.error(`Error formatting message: ${error.message}`, error.stack);
      return 'Error displaying message';
    }
  }

  /**
   * Convert markdown syntax to HTML for Telegram
   * @param text - The markdown text to convert
   * @returns The HTML formatted text
   */
  private markdownToHtml(text: string): string {
    // Check if text already contains HTML tags - if so, return it as is
    if (/<[a-z][\s\S]*>/i.test(text)) {
      return text;
    }
    
    return text
      // Bold: *text* -> <b>text</b>
      .replace(/\*(.*?)\*/g, '<b>$1</b>')
      // Italic: _text_ -> <i>text</i>
      .replace(/_(.*?)_/g, '<i>$1</i>')
      // Code: `text` -> <code>text</code>
      .replace(/`(.*?)`/g, '<code>$1</code>')
      // Underline: ~text~ -> <u>text</u> (not common but sometimes used)
      .replace(/~(.*?)~/g, '<u>$1</u>')
      // Strikethrough: ||text|| -> <s>text</s> (not common but sometimes used)
      .replace(/\|\|(.*?)\|\|/g, '<s>$1</s>');
  }

  /**
   * Get consistent emoji for categories and actions
   * This ensures we use the same emojis throughout the application
   * 
   * @param type - The type of emoji to get (category, action, etc.)
   * @param key - The key to get the emoji for
   * @returns The emoji
   */
  getEmoji(type: 'category' | 'action' | 'status', key: string): string {
    const emojiMap = {
      category: {
        'Food': '🍔',
        'Transport': '🚗',
        'Rent': '🏠',
        'Shopping': '🛒',
        'Utilities': '📱',
        'Entertainment': '🎬',
        'Healthcare': '💊',
        'Education': '📚',
        'Salary': '💼',
        'Freelance': '💰',
        'Investment': '📈',
        'Gift': '🎁',
        'Other': '📦'
      },
      action: {
        'expense': '💸',
        'income': '💵',
        'summary': '📊',
        'settings': '⚙️',
        'help': '❓',
        'cancel': '❌',
        'success': '✅',
        'error': '⚠️'
      },
      status: {
        'success': '✅',
        'error': '❌',
        'warning': '⚠️',
        'info': 'ℹ️'
      }
    };

    return emojiMap[type]?.[key] || '';
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

// Telegram Message Service
// Handles formatting and preparing messages for the Telegram bot
// IMPORTANT: All message formatting should follow the guidelines in @tele-bot-formatting.md
// located in the rules directory 