import { Injectable } from '@nestjs/common';

@Injectable()
export class ConfigService {
  private readonly config: { [key: string]: string };

  constructor() {
    this.config = {
      TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
      MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/expense-tracker',
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
    };
  }

  get(key: string): string {
    return this.config[key];
  }

  isTelegramBotConfigured(): boolean {
    return !!this.config.TELEGRAM_BOT_TOKEN;
  }

  isOpenAIConfigured(): boolean {
    return !!this.config.OPENAI_API_KEY;
  }
} 