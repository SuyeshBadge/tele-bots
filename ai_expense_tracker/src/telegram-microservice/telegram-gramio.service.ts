import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot, format, code, bold, italic, Context } from 'gramio';
import { TELEGRAM_MESSAGES } from './telegram.messages';
import { TelegramMessageService } from './telegram.message.service';
import { TelegramMicroserviceService } from './telegram-microservice.service';
import { PaymentMethod } from '../interfaces/common.interfaces';
import {
  BotContext,
  MessageContext,
  CallbackQueryContext,
  CallbackAction,
  CallbackQueryData,
  parseCallbackData,
  isMessageContext,
  isCallbackQueryContext
} from '../interfaces/telegram.interfaces';
import {
  SessionData,
  ExpenseSessionData,
  IncomeSessionData,
  SummaryData,
  CategorySummary,
  SessionState
} from '../interfaces/common.interfaces';
import { 
  CreateExpenseDto, 
  CreateIncomeDto 
} from '../interfaces/models.interfaces';
import { TelegramUser, Message } from '../interfaces/telegram.interfaces';
import type { Context as GramioContext } from 'gramio';
import type { TelegramMessage as GramioTelegramMessage, TelegramUser as GramioTelegramUser, TelegramCallbackQuery, TelegramUpdate } from '@gramio/types';
import { ExpenseService } from '../expense/expense.service';
import { UserService } from '../user/user.service';
import { Expense } from '../interfaces/models.interfaces';
import type { APIMethodParams, APIMethodReturn } from 'gramio';

@Injectable()
export class TelegramGramioService implements OnModuleInit {
  private bot: Bot;
  private readonly logger = new Logger(TelegramGramioService.name);
  private userStates: Map<number, any> = new Map();
  private authorizedUsers: Set<string> = new Set();
  private readonly telegramBotToken: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly telegramMessageService: TelegramMessageService,
    private readonly telegramMicroserviceService: TelegramMicroserviceService,
    private readonly expenseService: ExpenseService,
    private readonly userService: UserService,
  ) {
    this.telegramBotToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN') || '';
    
    if (!this.telegramBotToken) {
      this.logger.error('TELEGRAM_BOT_TOKEN is not set!');
    } else {
      this.bot = new Bot(this.telegramBotToken);
      this.logger.log('GramIO bot initialized with token');
    }
  }

  async onModuleInit() {
    try {
      this.logger.log('Initializing Telegram GramIO bot');
      await this.loadAuthorizedUsers();
      this.setupHandlers();
      await this.bot.start({
        dropPendingUpdates: true
      });
      this.logger.log('GramIO bot started successfully and is ready to respond!');
    } catch (error) {
      this.logger.error(`Failed to initialize Telegram GramIO bot: ${error.message}`, error.stack);
    }
  }

  private async loadAuthorizedUsers() {
    try {
      this.logger.log('Loading authorized users...');
      
      // For development environment, allow all users
      if (this.configService.get<string>('NODE_ENV') === 'development') {
        this.logger.log('Development mode: Authorization check disabled - all users will be allowed');
      }
    } catch (error) {
      this.logger.error(`Failed to load authorized users: ${error.message}`, error.stack);
    }
  }

  private async isUserAuthorized(userId: string): Promise<boolean> {
    // In development mode, authorize all users
    if (this.configService.get<string>('NODE_ENV') === 'development') {
      if (!this.authorizedUsers.has(userId)) {
        this.logger.log(`Authorizing new user ${userId} for development`);
        this.authorizedUsers.add(userId);
      }
      return true;
    }
    
    // In production, check if user is authorized
    return this.authorizedUsers.has(userId);
  }

  private getUserSession(chatId: number, userId: string): SessionData {
    // Get or create user session
    if (!this.userStates.has(chatId)) {
      this.userStates.set(chatId, {
        userId,
        state: '',
        data: {}
      });
    }
    return this.userStates.get(chatId)!;
  }
  
  private updateUserSession(chatId: number, session: SessionData): void {
    this.userStates.set(chatId, session);
  }

  private setupHandlers() {
    this.logger.log('Setting up bot handlers...');
    
    try {
      this.bot
        .command("start", ctx => this.handleStartCommand(ctx as unknown as BotContext))
        .command("help", ctx => this.handleHelpCommand(ctx as unknown as BotContext))
        .on("message", ctx => this.handleMessage(ctx as unknown as BotContext))
        .on("callback_query", ctx => this.handleCallbackQuery(ctx as unknown as BotContext));
      
      this.logger.log('Bot handlers set up successfully');
    } catch (error) {
      this.logger.error(`Failed to set up bot handlers: ${error.message}`, error.stack);
    }
  }

  private async handleStartCommand(ctx: BotContext) {
    try {
      const userId = ctx.from?.id.toString() || '';
      this.logger.log(`/start command received from user ${userId}`);
      
      // Check if user is authorized
      if (await this.isUserAuthorized(userId)) {
        this.logger.log(`Authorized user ${userId} sent /start, showing main menu`);
        await this.showMainMenu(ctx);
      } else {
        this.logger.log(`Unauthorized user ${userId} sent /start, showing get started prompt`);
        await this.handleGetStarted(ctx);
      }
      this.logger.log(`Welcome message sent to user ${userId}`);
    } catch (error) {
      this.logger.error(`Error handling /start command: ${error.message}`, error.stack);
      await this.handleError(ctx);
    }
  }

  private async handleHelpCommand(ctx: BotContext) {
    try {
      const userId = ctx.from?.id.toString() || 'unknown';
      this.logger.log(`/help command received from user ${userId}`);
      
      if (isMessageContext(ctx)) {
        await ctx.send(
          String(format`${bold('💁‍♂️ How I Can Help You')}\n\n${code('I make tracking your finances super easy:')}\n\n• ${bold('Record')} your expenses and income\n• ${bold('Track')} your spending by category\n• ${bold('View')} financial summaries and insights\n• ${bold('Manage')} your budget effectively\n\n${code('Commands you can use:')}\n• /start - Start the bot\n• /help - Show this help message\n• /menu - Show the main menu`),
          { 
            parse_mode: 'Markdown',
            reply_markup: {
              keyboard: [
                [{ text: '🏠 Main Menu' }]
              ],
              resize_keyboard: true
            }
          }
        );
      }
      this.logger.log(`Help message sent to user ${userId}`);
    } catch (error) {
      this.logger.error(`Error handling /help command: ${error.message}`, error.stack);
      await this.handleError(ctx);
    }
  }

  private async handleMessage(ctx: BotContext) {
    try {
      if (!isMessageContext(ctx) || !ctx.text) {
        this.logger.log('Non-text message received, skipping');
        return;
      }
      
      const text = ctx.text;
      const userId = ctx.from?.id.toString() || '';
      const chatId = ctx.chat?.id || 0;
      
      this.logger.log(`Received message: "${text}" from user ${userId} in chat ${chatId}`);
      
      // Check authorization
      if (!(await this.isUserAuthorized(userId))) {
        if (text === '🚀 Get Started') {
          this.logger.log(`Unauthorized user ${userId} clicked "Get Started" button`);
          await this.handleGetStarted(ctx);
        } else {
          this.logger.warn(`Unauthorized user ${userId} sent message: "${text}"`);
          await ctx.send(TELEGRAM_MESSAGES.UNAUTHORIZED, {
            parse_mode: 'Markdown',
            reply_markup: {
              keyboard: [[{ text: '🚀 Get Started' }]],
              resize_keyboard: true
            }
          });
        }
        return;
      }
      
      // Get user session
      const session = this.getUserSession(chatId, userId);
      this.logger.log(`User ${userId} session state: ${session.state || 'NONE'}`);
      
      // If user is in a conversation state, handle that first
      if (session.state) {
        await this.handleConversationState(ctx, session);
        return;
      }
      
      // Handle button clicks based on text
      switch (text) {
        case '💸 Record Expense':
          this.logger.log(`User ${userId} clicked "Record Expense" button`);
          await this.startExpenseFlow(ctx);
          break;
          
        case '💵 Record Income':
          this.logger.log(`User ${userId} clicked "Record Income" button`);
          await this.startIncomeFlow(ctx);
          break;
          
        case '📊 View Summary':
          this.logger.log(`User ${userId} clicked "View Summary" button`);
          await this.showSummary(ctx);
          break;
          
        case '⚙️ Settings':
          this.logger.log(`User ${userId} clicked "Settings" button`);
          await this.showSettingsMenu(ctx);
          break;
          
        case '❓ Help':
          this.logger.log(`User ${userId} clicked "Help" button`);
          await this.handleHelpCommand(ctx);
          break;
          
        case '🏠 Main Menu':
          this.logger.log(`User ${userId} clicked "Main Menu" button`);
          await this.showMainMenu(ctx);
          break;
          
        case '❌ Cancel':
          this.logger.log(`User ${userId} clicked "Cancel" button`);
          await this.cancelCurrentOperation(ctx);
          break;
          
        case '🚀 Get Started':
          this.logger.log(`User ${userId} clicked "Get Started" button`);
          await this.handleGetStarted(ctx);
          break;
          
        default:
          await this.handleButtonTextFallback(ctx);
      }
    } catch (error) {
      this.logger.error(`Error handling message: ${error.message}`, error.stack);
      await this.handleError(ctx);
    }
  }

  private async handleCallbackQuery(ctx: BotContext) {
    try {
      if (!isCallbackQueryContext(ctx)) {
        this.logger.warn('Invalid callback query context');
        return;
      }

      const data = ctx.callbackQuery.data;
      const message = ctx.callbackQuery.message;

      if (!message) {
        this.logger.warn('No message in callback query');
        return;
      }

      switch (data) {
        case 'add_expense':
          await ctx.bot.api.editMessageText({
            chat_id: message.chat.id,
            message_id: message.message_id,
            text: 'Please enter the expense amount:'
          });
          break;
        case 'view_expenses':
          await ctx.bot.api.editMessageText({
            chat_id: message.chat.id,
            message_id: message.message_id,
            text: 'Here are your expenses:'
          });
          break;
        case 'cancel':
          await ctx.bot.api.deleteMessage({
            chat_id: message.chat.id,
            message_id: message.message_id
          });
          break;
        default:
          this.logger.warn(`Unknown callback query data: ${data}`);
          break;
      }

      await ctx.bot.api.answerCallbackQuery({
        callback_query_id: ctx.callbackQuery.id
      });
    } catch (error) {
      this.logger.error('Error handling callback query:', error);
      throw error;
    }
  }

  private async handleSettingsOption(ctx: BotContext, option: string) {
    const userId = ctx.from?.id.toString() || '';
    this.logger.log(`User ${userId} selected setting: ${option}`);
    
    switch (option) {
      case 'categories':
        await ctx.send(String(format`${bold('Category Management')}\n\nThis feature is coming soon!`));
        break;
        
      case 'currency':
        await ctx.send(String(format`${bold('Currency Settings')}\n\nThis feature is coming soon!`));
        break;
        
      case 'export':
        await ctx.send(String(format`${bold('Data Export')}\n\nThis feature is coming soon!`));
        break;
        
      case 'notifications':
        await ctx.send(String(format`${bold('Notification Settings')}\n\nThis feature is coming soon!`));
        break;
        
      default:
        this.logger.warn(`Unknown settings option: ${option}`);
        await ctx.send('Unknown settings option');
    }
  }

  private async handleConversationState(ctx: BotContext, sessionData: SessionData) {
    const userId = ctx.from?.id.toString() || '';
    const chatId = ctx.chat?.id || 0;
    
    if (!isMessageContext(ctx) || !ctx.text) {
      this.logger.warn(`Expected text message for conversation state handling from user ${userId}`);
      return;
    }
    
    const text = ctx.text;
    
    if (text === '❌ Cancel') {
      await this.cancelCurrentOperation(ctx);
      return;
    }
    
    switch (sessionData.state) {
      case 'AWAITING_EXPENSE_DESCRIPTION':
        this.logger.log(`User ${userId} providing expense description: "${text}"`);
        await this.handleExpenseDescription(ctx, sessionData, text);
        break;
        
      case 'AWAITING_EXPENSE_AMOUNT':
        this.logger.log(`User ${userId} providing expense amount: "${text}"`);
        await this.handleExpenseAmount(ctx, sessionData, text);
        break;
        
      case 'AWAITING_EXPENSE_CATEGORY':
        this.logger.log(`User ${userId} providing expense category: "${text}"`);
        await this.handleExpenseCategory(ctx, sessionData, text);
        break;
        
      case 'AWAITING_INCOME_DESCRIPTION':
        this.logger.log(`User ${userId} providing income description: "${text}"`);
        await this.handleIncomeDescription(ctx, sessionData, text);
        break;
        
      case 'AWAITING_INCOME_AMOUNT':
        this.logger.log(`User ${userId} providing income amount: "${text}"`);
        await this.handleIncomeAmount(ctx, sessionData, text);
        break;
        
      default:
        this.logger.warn(`Unknown conversation state for user ${userId}: ${sessionData.state}`);
        await this.handleButtonTextFallback(ctx);
    }
  }

  private async handleButtonTextFallback(ctx: BotContext) {
    const userId = ctx.from?.id.toString() || '';
    this.logger.log(`Showing fallback menu to user ${userId} for unrecognized input`);
    
    await ctx.reply(
      'I don\'t understand that command. Please use the buttons below:',
      { 
        reply_markup: {
          keyboard: [
            [{ text: '💸 Record Expense' }, { text: '💵 Record Income' }],
            [{ text: '📊 View Summary' }, { text: '⚙️ Settings' }],
            [{ text: '❓ Help' }]
          ],
          resize_keyboard: true
        }
      }
    );
    this.logger.log(`Fallback menu sent to user ${userId}`);
  }

  private async handleError(ctx: BotContext) {
    try {
      const userId = ctx.from?.id.toString() || '';
      this.logger.log(`Sending error message to user ${userId}`);
      
      await ctx.reply(
        String(format`${bold('❌ Something Went Wrong')}\n\n${code('I encountered an error processing your request.')}\n\nPlease try again or return to the main menu to restart.`),
        { 
          parse_mode: 'Markdown',
          reply_markup: {
            keyboard: [
              [{ text: '🏠 Main Menu' }]
            ],
            resize_keyboard: true
          }
        }
      );
      this.logger.log(`Error message sent to user ${userId}`);
    } catch (error) {
      this.logger.error(`Error in handleError: ${error.message}`, error.stack);
      try {
        await ctx.reply('Error occurred. Please restart the bot with /start.');
      } catch {
        this.logger.error('Failed to send even the basic error message');
      }
    }
  }

  private async showMainMenu(ctx: BotContext) {
    const userId = ctx.from?.id.toString() || '';
    this.logger.log(`Showing main menu to user ${userId}`);
    
    await ctx.reply(
      String(format`${bold('Welcome to AI Expense Tracker')} 🤖\n\n${code('Choose an option below to get started:')}\n\n• Record expenses quickly and easily\n• Track your income sources\n• View spending summaries and insights`),
      { 
        parse_mode: 'Markdown',
        reply_markup: {
          keyboard: [
            [{ text: '💸 Record Expense' }, { text: '💵 Record Income' }],
            [{ text: '📊 View Summary' }, { text: '⚙️ Settings' }],
            [{ text: '❓ Help' }]
          ],
          resize_keyboard: true
        }
      }
    );
    
    this.logger.log(`Main menu sent to user ${userId}`);
  }

  private async handleGetStarted(ctx: BotContext) {
    const userId = ctx.from?.id.toString() || '';
    const chatId = ctx.chat?.id || 0;
    const firstName = ctx.from?.first_name || '';
    
    this.logger.log(`User ${userId} (${firstName}) starting onboarding process`);
    
    try {
      // Add to authorized users
      this.authorizedUsers.add(userId);
      this.logger.log(`User ${userId} added to authorized users`);
      
      // Create a session
      const session = this.getUserSession(chatId, userId);
      session.state = '';
      session.data = {};
      this.updateUserSession(chatId, session);
      this.logger.log(`Session initialized for new user ${userId}`);
      
      // Show welcome message with main menu
      await ctx.reply(
        String(format`Welcome, ${bold(firstName)}! I'm your AI Expense Tracker. I'll help you manage your finances effortlessly.`),
        { parse_mode: 'Markdown' }
      );
      
      // Show the main menu
      await this.showMainMenu(ctx);
      
      this.logger.log(`Onboarding completed for user ${userId}`);
    } catch (error) {
      this.logger.error(`Error handling Get Started: ${error.message}`, error.stack);
      await this.handleError(ctx);
    }
  }

  private async cancelCurrentOperation(ctx: BotContext) {
    const chatId = ctx.chat?.id || 0;
    const userId = ctx.from?.id.toString() || '';
    
    this.logger.log(`Cancelling current operation for user ${userId}`);
    
    // Reset session state
    const session = this.getUserSession(chatId, userId);
    const prevState = session.state;
    session.state = '';
    session.data = {};
    this.updateUserSession(chatId, session);
    
    this.logger.log(`Session state reset for user ${userId} (was: ${prevState})`);
    
    await ctx.reply(
      'Operation cancelled. What would you like to do next?',
      { 
        parse_mode: 'Markdown',
        reply_markup: {
          keyboard: [
            [{ text: '💸 Record Expense' }, { text: '💵 Record Income' }],
            [{ text: '📊 View Summary' }, { text: '⚙️ Settings' }],
            [{ text: '❓ Help' }]
          ],
          resize_keyboard: true
        }
      }
    );
    
    this.logger.log(`Cancellation confirmed to user ${userId}`);
  }

  private async handleCategorySelection(ctx: BotContext, category: string) {
    const chatId = ctx.chat?.id || 0;
    const userId = ctx.from?.id.toString() || '';
    const session = this.getUserSession(chatId, userId);
    
    this.logger.log(`User ${userId} selected category: ${category}`);
    this.logger.debug(`Current session state: ${JSON.stringify(session, null, 2)}`);
    
    if (!session.data.amount || !session.data.description) {
      this.logger.warn(`Missing expense data for user ${userId}. Session data: ${JSON.stringify(session.data)}`);
      await ctx.reply('Sorry, there was an error processing your expense. Please try again.');
      return;
    }
    
    try {
      const expenseData = {
        userId: session.userId,
        amount: session.data.amount,
        category: category,
        description: session.data.description,
        date: new Date(),
        paymentMethod: PaymentMethod.CASH
      };

      this.logger.debug(`Creating expense with data: ${JSON.stringify(expenseData, null, 2)}`);

      const expense = await this.telegramMicroserviceService.createExpense(expenseData);
      
      this.logger.debug(`Expense created successfully: ${JSON.stringify(expense, null, 2)}`);
      
      // Reset session
      session.state = '';
      session.data = {};
      this.updateUserSession(chatId, session);
      
      // Delete the message with inline keyboard if we're in a callback query context
      if (isCallbackQueryContext(ctx) && ctx.callbackQuery?.message?.message_id) {
        try {
          await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
          this.logger.debug('Successfully deleted message with inline keyboard');
        } catch (error) {
          this.logger.error(`Error deleting message: ${error.message}`);
        }
      }
      
      const successMessage = String(format`${bold('✅ Expense Saved Successfully!')}\n\n${code('Details:')}\n• Description: ${bold(expenseData.description)}\n• Amount: ${bold('₹' + expenseData.amount.toFixed(2))}\n• Category: ${bold(expenseData.category)}\n\nThank you for recording your expense.`);
      
      this.logger.debug(`Sending success message: ${successMessage}`);
      
      await ctx.reply(
        successMessage,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            keyboard: [
              [{ text: '💸 Record Another Expense' }],
              [{ text: '📊 View Summary' }],
              [{ text: '🏠 Main Menu' }]
            ],
            resize_keyboard: true
          }
        }
      );
    } catch (error) {
      this.logger.error(`Error saving expense: ${error.message}`, error.stack);
      await this.handleError(ctx);
    }
  }

  // Add the missing handler methods
  private async startExpenseFlow(ctx: BotContext) {
    const chatId = ctx.chat?.id || 0;
    const userId = ctx.from?.id.toString() || '';
    
    this.logger.log(`Starting expense flow for user ${userId}`);
    
    const session = this.getUserSession(chatId, userId);
    session.state = 'AWAITING_EXPENSE_DESCRIPTION';
    session.data = {};
    this.updateUserSession(chatId, session);
    
    this.logger.log(`Session state updated to AWAITING_EXPENSE_DESCRIPTION for user ${userId}`);
    
    const expenseMessage = String(format`${bold('💸 Record Expense')}\n\n${code('What did you spend money on?')}\n\nPlease describe your expense (e.g., "Coffee at Starbucks" or "Grocery shopping")`);
    await ctx.reply(
      expenseMessage,
      { 
        parse_mode: 'Markdown',
        reply_markup: {
          keyboard: [
            [{ text: '❌ Cancel' }]
          ],
          resize_keyboard: true
        }
      }
    );
  }

  private async startIncomeFlow(ctx: BotContext) {
    const chatId = ctx.chat?.id || 0;
    const userId = ctx.from?.id.toString() || '';
    
    this.logger.log(`Starting income flow for user ${userId}`);
    
    const session = this.getUserSession(chatId, userId);
    session.state = 'AWAITING_INCOME_DESCRIPTION';
    session.data = {};
    this.updateUserSession(chatId, session);
    
    this.logger.log(`Session state updated to AWAITING_INCOME_DESCRIPTION for user ${userId}`);
    
    const incomeMessage = String(format`${bold('💵 Record Income')}\n\n${code('Where did this money come from?')}\n\nPlease describe your income source (e.g., "Salary", "Freelance payment" or "Gift")`);
    await ctx.reply(
      incomeMessage,
      { 
        parse_mode: 'Markdown',
        reply_markup: {
          keyboard: [
            [{ text: '❌ Cancel' }]
          ],
          resize_keyboard: true
        }
      }
    );
  }

  private async showSummary(ctx: BotContext) {
    try {
      const userId = ctx.from?.id.toString() || '';
      this.logger.log(`Generating summary for user ${userId}`);
      
      const summary = await this.telegramMicroserviceService.getUserSummary(userId);
      
      const categoriesText = summary.expenses
        .map(exp => `${exp.category} ${exp.amount.toFixed(2)}`)
        .join('\n');
      
      const summaryMessage = format`
${bold('📊 Financial Summary')}

${code('OVERVIEW')}
💰 ${bold('Total Income')}: ₹${summary.totalIncome.toFixed(2)}
💸 ${bold('Total Expenses')}: ₹${summary.totalExpenses.toFixed(2)}
${summary.totalIncome - summary.totalExpenses >= 0 ? '✅' : '⚠️'} ${bold('Balance')}: ₹${(summary.totalIncome - summary.totalExpenses).toFixed(2)}

${code('SPENDING BY CATEGORY')}
${categoriesText}

${italic('Generated on ' + new Date().toLocaleDateString())}
      `;
      
      await ctx.reply(
        String(summaryMessage),
        { 
          parse_mode: 'Markdown',
          reply_markup: {
            keyboard: [
              [{ text: '💸 Record Expense' }, { text: '💵 Record Income' }],
              [{ text: '🏠 Main Menu' }]
            ],
            resize_keyboard: true
          }
        }
      );
    } catch (error) {
      this.logger.error(`Error showing summary: ${error.message}`, error.stack);
      await this.handleError(ctx);
    }
  }

  private async showSettingsMenu(ctx: BotContext) {
    const userId = ctx.from?.id.toString() || '';
    this.logger.log(`Showing settings menu to user ${userId}`);
    
    const settingsMessage = String(format`${bold('⚙️ Settings')}\n\n${code('Customize your experience:')}\n\n• Manage expense categories\n• Set currency preferences\n• Configure notifications\n• Export your data`);
    await ctx.reply(
      settingsMessage,
      { 
        parse_mode: 'Markdown',
        reply_markup: {
          keyboard: [
            [{ text: '📋 Categories' }, { text: '💲 Currency' }],
            [{ text: '📊 Data Export' }, { text: '🔔 Notifications' }],
            [{ text: '🏠 Main Menu' }]
          ],
          resize_keyboard: true
        }
      }
    );
  }

  private async handleExpenseDescription(ctx: BotContext, sessionData: SessionData, text: string) {
    const chatId = ctx.chat?.id || 0;
    const userId = ctx.from?.id.toString() || '';
    
    this.logger.log(`Processing expense description from user ${userId}: "${text}"`);
    
    sessionData.data.description = text;
    sessionData.state = 'AWAITING_EXPENSE_AMOUNT';
    this.updateUserSession(chatId, sessionData);
    
    await ctx.reply(
      String(format`Got it! Your expense is: ${bold(text)}\n\nNow, please enter the amount:`),
      { 
        parse_mode: 'Markdown',
        reply_markup: {
          keyboard: [
            [{ text: '❌ Cancel' }]
          ],
          resize_keyboard: true
        }
      }
    );
  }

  private async handleExpenseAmount(ctx: BotContext, sessionData: SessionData, text: string) {
    const chatId = ctx.chat?.id || 0;
    const userId = ctx.from?.id.toString() || '';
    
    this.logger.log(`Processing expense amount from user ${userId}: "${text}"`);
    
    const cleanedText = text.replace(/[^\d.,]/g, '').replace(/,/g, '.');
    const amount = parseFloat(cleanedText);
    
    if (isNaN(amount) || amount <= 0) {
      this.logger.warn(`Invalid expense amount from user ${userId}: "${text}"`);
      await ctx.reply(
        'Please enter a valid amount (e.g., 100 or 99.95):',
        {
          reply_markup: {
            keyboard: [
              [{ text: '❌ Cancel' }]
            ],
            resize_keyboard: true
          }
        }
      );
      return;
    }
    
    sessionData.data.amount = amount;
    sessionData.state = 'AWAITING_EXPENSE_CATEGORY';
    this.updateUserSession(chatId, sessionData);
    
    await ctx.reply(
      String(format`${bold('Amount:')} ${code('₹' + amount.toFixed(2))}\n\n${bold('What category does this expense belong to?')}`),
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🍔 Food', callback_data: 'category_Food' },
              { text: '🛒 Groceries', callback_data: 'category_Groceries' }
            ],
            [
              { text: '🚇 Transport', callback_data: 'category_Transport' },
              { text: '🏠 Utilities', callback_data: 'category_Utilities' }
            ],
            [
              { text: '🎬 Entertainment', callback_data: 'category_Entertainment' },
              { text: '👚 Shopping', callback_data: 'category_Shopping' }
            ],
            [
              { text: '💊 Healthcare', callback_data: 'category_Healthcare' },
              { text: '📚 Education', callback_data: 'category_Education' }
            ],
            [
              { text: '❓ Other', callback_data: 'category_Other' }
            ]
          ]
        }
      }
    );
  }

  private async handleExpenseCategory(ctx: BotContext, sessionData: SessionData, text: string) {
    const chatId = ctx.chat?.id || 0;
    const userId = ctx.from?.id.toString() || '';
    
    this.logger.log(`Processing expense category from user ${userId}: "${text}"`);
    
    const category = text.replace(/^[^\w]+\s*/, '');
    
    if (text === '❌ Cancel') {
      await this.cancelCurrentOperation(ctx);
      return;
    }
    
    sessionData.data.category = category;
    
    try {
      const expense = await this.telegramMicroserviceService.createExpense({
        userId: sessionData.userId,
        amount: sessionData.data.amount,
        category: category,
        description: sessionData.data.description,
        date: new Date(),
        paymentMethod: PaymentMethod.CASH
      });
      
      sessionData.state = '';
      sessionData.data = {};
      this.updateUserSession(chatId, sessionData);
      
      await ctx.reply(
        String(format`${bold('✅ Expense Saved Successfully!')}\n\n${code('Details:')}\n• Description: ${bold(sessionData.data.description)}\n• Amount: ${bold('₹' + sessionData.data.amount.toFixed(2))}\n• Category: ${bold(sessionData.data.category)}\n\nThank you for recording your expense.`),
        {
          parse_mode: 'Markdown',
          reply_markup: {
            keyboard: [
              [{ text: '💸 Record Another Expense' }],
              [{ text: '📊 View Summary' }],
              [{ text: '🏠 Main Menu' }]
            ],
            resize_keyboard: true
          }
        }
      );
    } catch (error) {
      this.logger.error(`Error saving expense: ${error.message}`, error.stack);
      await this.handleError(ctx);
    }
  }

  private async handleIncomeDescription(ctx: BotContext, sessionData: SessionData, text: string) {
    const chatId = ctx.chat?.id || 0;
    const userId = ctx.from?.id.toString() || '';
    
    this.logger.log(`Processing income description from user ${userId}: "${text}"`);
    
    sessionData.data.description = text;
    sessionData.state = 'AWAITING_INCOME_AMOUNT';
    this.updateUserSession(chatId, sessionData);
    
    await ctx.reply(
      String(format`Income source: ${bold(text)}\n\nNow, please enter the amount:`),
      { 
        parse_mode: 'Markdown',
        reply_markup: {
          keyboard: [
            [{ text: '❌ Cancel' }]
          ],
          resize_keyboard: true
        }
      }
    );
  }

  private async handleIncomeAmount(ctx: BotContext, sessionData: SessionData, text: string) {
    const chatId = ctx.chat?.id || 0;
    const userId = ctx.from?.id.toString() || '';
    
    this.logger.log(`Processing income amount from user ${userId}: "${text}"`);
    
    const amount = parseFloat(text.replace(/[^0-9.]/g, ''));
    
    if (isNaN(amount) || amount <= 0) {
      this.logger.warn(`Invalid income amount from user ${userId}: "${text}"`);
      await ctx.reply(
        'Please enter a valid amount (e.g., 5000 or 5000.50):',
        {
          reply_markup: {
            keyboard: [
              [{ text: '❌ Cancel' }]
            ],
            resize_keyboard: true
          }
        }
      );
      return;
    }
    
    sessionData.data.amount = amount;
    
    try {
      const income = await this.telegramMicroserviceService.createIncome({
        userId: sessionData.userId,
        amount: amount,
        category: 'Other',
        description: sessionData.data.description,
        date: new Date()
      });
      
      sessionData.state = '';
      sessionData.data = {};
      this.updateUserSession(chatId, sessionData);
      
      await ctx.reply(
        String(format`${bold('✅ Income Saved Successfully!')}\n\n${code('Details:')}\n• Source: ${bold(sessionData.data.description)}\n• Amount: ${bold('₹' + sessionData.data.amount.toFixed(2))}\n\nThank you for recording your income.`),
        {
          parse_mode: 'Markdown',
          reply_markup: {
            keyboard: [
              [{ text: '💵 Record Another Income' }],
              [{ text: '📊 View Summary' }],
              [{ text: '🏠 Main Menu' }]
            ],
            resize_keyboard: true
          }
        }
      );
    } catch (error) {
      this.logger.error(`Error saving income: ${error.message}`, error.stack);
      await this.handleError(ctx);
    }
  }
} 