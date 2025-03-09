import { Injectable } from '@nestjs/common';
import { getLogger } from '../../utils/logger';

@Injectable()
export class MessageService {
  private logger = getLogger('MessageService');

  /**
   * Format a message template by replacing variables with actual values
   * 
   * @param template - The message template with variables in {variableName} format
   * @param variables - Object containing variable names and values
   * @returns Formatted message with variables replaced
   */
  format(template: string, variables: Record<string, any> = {}): string {
    if (!template) {
      this.logger.warn('No message template provided for formatting');
      return '';
    }

    try {
      // Replace each {variableName} with the corresponding value
      return template.replace(/{([^{}]*)}/g, (match, key) => {
        const value = variables[key];
        
        // Return the value if it exists, otherwise keep the placeholder
        return value !== undefined ? String(value) : match;
      });
    } catch (error) {
      this.logger.error(`Error formatting message template: ${template}`, error);
      return template; // Return the original template on error
    }
  }

  /**
   * Format a currency amount according to user preferences
   * 
   * @param amount - Numeric amount to format
   * @param currency - Currency code (default: USD)
   * @param locale - Locale for formatting (default: en-US)
   * @returns Formatted currency string
   */
  formatCurrency(amount: number, currency: string = 'USD', locale: string = 'en-US'): string {
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency,
      }).format(amount);
    } catch (error) {
      this.logger.error(`Error formatting currency: ${amount} ${currency}`, error);
      return `${currency} ${amount}`;
    }
  }

  /**
   * Format a date according to user preferences
   * 
   * @param date - Date to format
   * @param format - Date format style (default: 'medium')
   * @param locale - Locale for formatting (default: en-US)
   * @returns Formatted date string
   */
  formatDate(date: Date, format: 'short' | 'medium' | 'long' = 'medium', locale: string = 'en-US'): string {
    try {
      return new Intl.DateTimeFormat(locale, {
        dateStyle: format,
      }).format(date);
    } catch (error) {
      this.logger.error(`Error formatting date: ${date}`, error);
      return date.toDateString();
    }
  }

  /**
   * Format a percentage value
   * 
   * @param value - Numeric value to format as percentage
   * @param decimalPlaces - Number of decimal places to include
   * @param locale - Locale for formatting
   * @returns Formatted percentage string
   */
  formatPercentage(value: number, decimalPlaces: number = 0, locale: string = 'en-US'): string {
    try {
      return new Intl.NumberFormat(locale, {
        style: 'percent',
        minimumFractionDigits: decimalPlaces,
        maximumFractionDigits: decimalPlaces,
      }).format(value / 100);
    } catch (error) {
      this.logger.error(`Error formatting percentage: ${value}%`, error);
      return `${value}%`;
    }
  }

  /**
   * Create a personalized greeting based on time of day and user name
   * 
   * @param name - User's name
   * @param date - Current date/time (default: now)
   * @returns Personalized greeting
   */
  getGreeting(name: string, date: Date = new Date()): string {
    const hour = date.getHours();
    let greeting = '';
    let emoji = '';

    if (hour < 12) {
      greeting = 'Good morning';
      emoji = '☀️';
    } else if (hour < 18) {
      greeting = 'Good afternoon';
      emoji = '🌤️';
    } else {
      greeting = 'Good evening';
      emoji = '🌙';
    }

    return `${emoji} ${greeting}, ${name}`;
  }

  /**
   * Get an appropriate emoji for a given expense category
   * 
   * @param category - The expense category
   * @returns Emoji representing the category
   */
  getCategoryEmoji(category: string): string {
    const lowercaseCategory = category.toLowerCase();
    
    const categoryEmojis: Record<string, string> = {
      food: '🍔',
      groceries: '🛒',
      dining: '🍽️',
      restaurant: '🍽️',
      transport: '🚗',
      transportation: '🚗',
      transit: '🚌',
      gas: '⛽',
      entertainment: '🎭',
      shopping: '🛍️',
      utilities: '💡',
      electricity: '⚡',
      water: '💧',
      internet: '🌐',
      phone: '📱',
      rent: '🏠',
      mortgage: '🏡',
      health: '⚕️',
      healthcare: '🏥',
      medical: '💊',
      education: '📚',
      travel: '✈️',
      vacation: '🏖️',
      fitness: '🏋️',
      gym: '💪',
      clothing: '👕',
      gifts: '🎁',
      charity: '❤️',
      subscriptions: '📱',
      streaming: '📺',
      insurance: '🔒',
      taxes: '📝',
      other: '📋',
    };
    
    return categoryEmojis[lowercaseCategory] || '💰';
  }

  /**
   * Get an appropriate emoji for an achievement or milestone
   * 
   * @param achievementType - Type of achievement
   * @param value - Value associated with the achievement (optional)
   * @returns Emoji representing the achievement
   */
  getAchievementEmoji(achievementType: string, value?: number): string {
    const type = achievementType.toLowerCase();
    
    const achievementEmojis: Record<string, string> = {
      streak: '🔥',
      savings: '💰',
      budget: '🎯',
      under_budget: '🏆',
      tracking: '📊',
      milestone: '🎉',
      insight: '💡',
      goal_complete: '✅',
      improvement: '📈',
    };
    
    // For streaks or milestones, add special emojis based on value
    if (type === 'streak' && value) {
      if (value >= 30) return '🔥🔥🔥';
      if (value >= 14) return '🔥🔥';
    }
    
    if (type === 'milestone' && value) {
      if (value >= 1000) return '🎉🏆🎖️';
      if (value >= 500) return '🎉🏆';
      if (value >= 100) return '🎉';
    }
    
    if (type === 'savings' && value) {
      if (value >= 1000) return '💰💰💰';
      if (value >= 500) return '💰💰';
      if (value >= 100) return '💰';
    }
    
    return achievementEmojis[type] || '🌟';
  }

  /**
   * Get an appropriate emoji for a system message type
   * 
   * @param messageType - Type of system message
   * @returns Emoji representing the message type
   */
  getSystemMessageEmoji(messageType: string): string {
    const type = messageType.toLowerCase();
    
    const messageEmojis: Record<string, string> = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️',
      tip: '💡',
      alert: '🔔',
      reminder: '⏰',
      update: '🔄',
      security: '🔒',
      notification: '📣',
    };
    
    return messageEmojis[type] || '';
  }

  /**
   * Add appropriate emojis to a message based on sentiment or context
   * 
   * @param message - The message to enhance with emojis
   * @param sentiment - The sentiment or context of the message
   * @returns Message with appropriate emojis
   */
  addSentimentEmoji(message: string, sentiment: 'positive' | 'negative' | 'neutral' | 'alert' | 'celebratory' = 'neutral'): string {
    if (!message) return message;
    
    // Don't add emoji if message already starts with one
    if (/^[\p{Emoji}]/u.test(message)) {
      return message;
    }
    
    let emoji = '';
    
    switch (sentiment) {
      case 'positive':
        emoji = '👍 ';
        break;
      case 'negative':
        emoji = '😔 ';
        break;
      case 'alert':
        emoji = '⚠️ ';
        break;
      case 'celebratory':
        emoji = '🎉 ';
        break;
      case 'neutral':
      default:
        emoji = '';
    }
    
    return `${emoji}${message}`;
  }
} 