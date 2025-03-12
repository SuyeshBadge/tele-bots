/**
 * Simple test script for GramIO functionality
 * 
 * Run with: npx ts-node src/telegram/try-gramio.ts
 */

import { Bot } from 'gramio';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Create a bot instance
const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN || '');

// Listen for /start command
bot.command('start', (ctx: any) => {
  ctx.reply(
    '*Welcome to AI Expense Tracker!*\n\nI help you track expenses effortlessly.',
    { parse_mode: 'Markdown' }
  );
});

// Listen for /help command
bot.command('help', (ctx: any) => {
  ctx.reply(
    '<b>How I Can Help You</b>\n\nI can help you track expenses, income, and more!',
    { parse_mode: 'HTML' }
  );
});

// Listen for text messages
bot.on('message', (ctx: any) => {
  // Only process text messages
  if (!ctx.message?.text) return;
  
  const text = ctx.message.text;
  
  if (text.toLowerCase().includes('expense')) {
    ctx.reply(
      '💸 *Let\'s record your expense*\n\nPlease enter the amount you spent:',
      { parse_mode: 'Markdown' }
    );
  } else if (text.toLowerCase().includes('income')) {
    ctx.reply(
      '💵 *Let\'s record your income*\n\nPlease enter the amount:',
      { parse_mode: 'Markdown' }
    );
  } else {
    ctx.reply('Type "expense" or "income" to get started!');
  }
});

// Start the bot
bot.start()
  .then(() => console.log('Bot started successfully!'))
  .catch(err => console.error('Failed to start bot:', err));

console.log('Starting bot...'); 