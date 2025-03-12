/**
 * Standalone script to run the GramIO Telegram service for testing
 * 
 * Run with: npx ts-node src/telegram/run-gramio-service.ts
 */

import * as dotenv from 'dotenv';
import { Bot } from 'gramio';
import { TELEGRAM_MESSAGES } from './telegram.messages';

// Load environment variables
dotenv.config();

// Create bot instance
const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.error('TELEGRAM_BOT_TOKEN is not set. Please check your .env file.');
  process.exit(1);
}

// Create a bot instance
const bot = new Bot(token);

// Listen for /start command
bot.command('start', (ctx: any) => {
  ctx.reply(
    '*Welcome to AI Expense Tracker!*\n\nI help you track expenses effortlessly.',
    { 
      parse_mode: 'Markdown',
      reply_markup: {
        keyboard: TELEGRAM_MESSAGES.WELCOME_BUTTONS.map(row => 
          row.map(text => ({ text }))
        ),
        resize_keyboard: true
      }
    }
  );
});

// Listen for /expense command
bot.command('expense', (ctx: any) => {
  ctx.reply(
    '💸 *Let\'s record your expense*\n\nPlease enter the amount you spent:',
    { parse_mode: 'Markdown' }
  );
});

// Listen for /income command
bot.command('income', (ctx: any) => {
  ctx.reply(
    '💵 *Let\'s record your income*\n\nPlease enter the amount:',
    { parse_mode: 'Markdown' }
  );
});

// Handle text messages for button clicks
bot.on('message', (ctx: any) => {
  if (!ctx.message?.text) return;
  
  const text = ctx.message.text;
  
  switch (text) {
    case '💸 Record Expense':
      ctx.reply(
        '💸 *Let\'s record your expense*\n\nPlease enter the amount you spent:',
        { parse_mode: 'Markdown' }
      );
      break;
      
    case '💵 Record Income':
      ctx.reply(
        '💵 *Let\'s record your income*\n\nPlease enter the amount:',
        { parse_mode: 'Markdown' }
      );
      break;
      
    case '📊 View Summary':
      ctx.reply(
        '📊 *Financial Summary*\n\nThis is a placeholder for your financial summary.',
        { parse_mode: 'Markdown' }
      );
      break;
      
    case '⚙️ Settings':
      ctx.reply(
        '⚙️ *Settings*\n\nSettings are not implemented yet.',
        { parse_mode: 'Markdown' }
      );
      break;
  }
});

// Start the bot
bot.start()
  .then(() => console.log('GramIO test bot started successfully!'))
  .catch((error) => console.error('Error starting bot:', error));

console.log('Starting GramIO test bot...'); 