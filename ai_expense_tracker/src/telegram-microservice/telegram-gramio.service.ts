import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot, Context, InlineKeyboard } from 'gramio';
import { MessageContext, CallbackQueryContext } from 'gramio';
import { TELEGRAM_MESSAGES } from './telegram.messages';
import { TelegramMessageService } from './telegram.message.service';
import { TelegramMicroserviceService } from './telegram-microservice.service';
import { PaymentMethod } from '../interfaces/common.interfaces';
import { ExpenseService } from '../expense/expense.service';
import { UserService } from '../user/user.service';

interface SessionData {
  state: string;
  data: Record<string, any>;
}

type BotContext = Context<Bot> & {
  session?: SessionData;
  reply: (text: string, options?: any) => Promise<any>;
  message?: {
    text?: string;
  };
  callbackQuery?: {
    data: string;
    id: string;
  };
  from?: {
    id: number;
  };
  chat?: {
    id: number;
  };
  answerCallbackQuery: (options?: { text?: string }) => Promise<any>;
};

@Injectable()
export class TelegramGramioService implements OnModuleInit {
  private bot: Bot;
  private readonly logger = new Logger(TelegramGramioService.name);
  private sessions: Map<number, SessionData> = new Map();

  constructor(
    private readonly configService: ConfigService,
    private readonly telegramMessageService: TelegramMessageService,
    private readonly telegramMicroserviceService: TelegramMicroserviceService,
    private readonly expenseService: ExpenseService,
    private readonly userService: UserService,
  ) {
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) {
      throw new Error('TELEGRAM_BOT_TOKEN is not set!');
    }
    
    this.bot = new Bot(token);
    this.setupBot();
  }

  private setupBot() {
    // Add middleware to handle sessions
    this.bot.use(async (ctx: Context<Bot>, next) => {
      const chatId = (ctx as any).chat?.id;
      if (chatId) {
        (ctx as BotContext).session = this.sessions.get(chatId) || { state: '', data: {} };
      }
      await next();
      if (chatId && (ctx as BotContext).session) {
        this.sessions.set(chatId, (ctx as BotContext).session);
      }
    });

    // Command handlers
    this.setupCommands();

    // Message handlers
    this.setupMessageHandlers();

    // Callback query handlers
    this.setupCallbackHandlers();
  }

  private setupCommands() {
    this.bot.command('start', (ctx) => this.handleStart(ctx as unknown as BotContext));
    this.bot.command('help', (ctx) => this.handleHelp(ctx as unknown as BotContext));
    this.bot.command('menu', (ctx) => this.showMainMenu(ctx as unknown as BotContext));
  }

  private setupMessageHandlers() {
    this.bot.on('message', async (ctx: MessageContext<Bot>) => {
      const botCtx = ctx as unknown as BotContext;
      if (!botCtx.message?.text) return;

      if (botCtx.session?.state) {
        await this.handleStateMessage(botCtx);
        return;
      }

      await this.showMainMenu(botCtx);
    });
  }

  private setupCallbackHandlers() {
    this.bot.on('callback_query', async (ctx: CallbackQueryContext<Bot>) => {
      this.logger.log('Received callback query event');
      
      try {
        const data = ctx.queryPayload;
        this.logger.log(`Processing callback with data: ${data}`);
        
        // Always answer callback query first
        this.logger.log('Attempting to answer callback query');
        await ctx.answerCallbackQuery();
        this.logger.log('Successfully answered callback query');

        // Create a context object with the necessary properties
        const botCtx = {
          session: this.sessions.get(ctx.message.chat.id) || { state: '', data: {} },
          reply: async (text: string, options?: any) => ctx.message.reply(text, options),
          chat: ctx.message.chat,
          from: ctx.from,
          answerCallbackQuery: () => ctx.answerCallbackQuery()
        } as unknown as BotContext;

        if (typeof data !== 'string') {
          this.logger.warn('Invalid callback data type');
          return;
        }

        switch (data) {
          case 'record_expense':
            this.logger.log('Starting expense flow');
            await this.startExpenseFlow(botCtx);
            break;
          case 'record_income':
            this.logger.log('Starting income flow');
            await this.startIncomeFlow(botCtx);
            break;
          case 'view_summary':
            this.logger.log('Showing summary');
            await this.showSummary(botCtx);
            break;
          case 'settings':
            this.logger.log('Showing settings');
            await this.showSettings(botCtx);
            break;
          case 'cancel':
            this.logger.log('Canceling operation');
            await this.cancelOperation(botCtx);
            break;
          case 'main_menu':
            this.logger.log('Showing main menu');
            await this.showMainMenu(botCtx);
            break;
          case 'help':
            this.logger.log('Showing help');
            await this.handleHelp(botCtx);
            break;
          default:
            if (data.startsWith('category_')) {
              this.logger.log(`Handling category selection: ${data}`);
              await this.handleCategorySelection(botCtx, data.replace('category_', ''));
            } else {
              this.logger.warn(`Unhandled callback data: ${data}`);
            }
        }

        // Save session if it was modified
        if (botCtx.session) {
          this.sessions.set(ctx.message.chat.id, botCtx.session);
        }
      } catch (error) {
        this.logger.error('Error handling callback query:', error);
        try {
          await ctx.message.reply('Sorry, something went wrong. Please try again.');
        } catch (replyError) {
          this.logger.error('Error sending error message:', replyError);
        }
      }
    });
  }

  async onModuleInit() {
    try {
      await this.bot.start({
        dropPendingUpdates: true
      });
      this.logger.log('Bot started successfully');
    } catch (error) {
      this.logger.error('Failed to start bot:', error);
      throw error;
    }
  }

  private async handleStart(ctx: BotContext) {
    const keyboard = new InlineKeyboard()
      .text('💸 Record Expense', 'record_expense').text('💵 Record Income', 'record_income').row()
      .text('📊 View Summary', 'view_summary').text('⚙️ Settings', 'settings').row()
      .text('❓ Help', 'help');

    await ctx.reply('Welcome to AI Expense Tracker! Choose an option:', {
      reply_markup: keyboard
    });
  }

  private async handleHelp(ctx: BotContext) {
    const keyboard = new InlineKeyboard()
      .text('🏠 Back to Menu', 'main_menu');

    await ctx.reply(
      'Here\'s how I can help:\n\n' +
      '• Use /start to begin\n' +
      '• Record expenses and income\n' +
      '• View your financial summary\n' +
      '• Manage categories and settings',
      { reply_markup: keyboard }
    );
  }

  private async startExpenseFlow(ctx: BotContext) {
    this.logger.log('Starting expense flow for user');
    if (!ctx.session) {
      this.logger.warn('No session found in context');
      return;
    }

    this.logger.log('Current session state:', ctx.session.state);
    ctx.session.state = 'AWAITING_EXPENSE_DESCRIPTION';
    ctx.session.data = {};
    this.logger.log('Updated session state:', ctx.session.state);

    const keyboard = new InlineKeyboard()
      .text('❌ Cancel', 'cancel');

    try {
      await ctx.reply(
        '💸 What did you spend money on?\n\n' +
        'Please describe your expense (e.g., "Coffee at Starbucks")',
        { reply_markup: keyboard }
      );
      this.logger.log('Successfully sent expense prompt');
    } catch (error) {
      this.logger.error('Error sending expense prompt:', error);
      throw error;
    }
  }

  private async handleStateMessage(ctx: BotContext) {
    if (!ctx.message?.text || !ctx.session) return;

    switch (ctx.session.state) {
      case 'AWAITING_EXPENSE_DESCRIPTION':
        await this.handleExpenseDescription(ctx, ctx.message.text);
        break;
      case 'AWAITING_EXPENSE_AMOUNT':
        await this.handleExpenseAmount(ctx, ctx.message.text);
        break;
    }
  }

  private async handleExpenseDescription(ctx: BotContext, text: string) {
    if (!ctx.session) return;

    if (text.length < 2) {
      await ctx.reply('Please provide a longer description.');
      return;
    }

    ctx.session.data.description = text;
    ctx.session.state = 'AWAITING_EXPENSE_AMOUNT';

    const keyboard = new InlineKeyboard()
      .text('❌ Cancel', 'cancel');

    await ctx.reply(
      `Description: ${text}\n\n` +
      'Now, please enter the amount:',
      { reply_markup: keyboard }
    );
  }

  private async handleExpenseAmount(ctx: BotContext, text: string) {
    if (!ctx.session) return;

    const amount = parseFloat(text.replace(/[^0-9.]/g, ''));

    if (isNaN(amount) || amount <= 0) {
      await ctx.reply('Please enter a valid amount (e.g., 100 or 99.95)');
      return;
    }

    ctx.session.data.amount = amount;
    ctx.session.state = 'AWAITING_CATEGORY';

    const keyboard = new InlineKeyboard()
      .text('🍔 Food', 'category_Food').text('🛒 Groceries', 'category_Groceries').row()
      .text('🚇 Transport', 'category_Transport').text('🏠 Utilities', 'category_Utilities').row()
      .text('❓ Other', 'category_Other');

    await ctx.reply(
      `Amount: ₹${amount}\n\n` +
      'Please select a category:',
      { reply_markup: keyboard }
    );
  }

  private async handleCategorySelection(ctx: BotContext, category: string) {
    if (!ctx.session) return;

    const { description, amount } = ctx.session.data;

    try {
      await this.telegramMicroserviceService.createExpense({
        userId: ctx.from?.id.toString() || '',
        amount,
        category,
        description,
        date: new Date(),
        paymentMethod: PaymentMethod.CASH
      });

      // Reset session
      ctx.session.state = '';
      ctx.session.data = {};

      const keyboard = new InlineKeyboard()
        .text('💸 Record Another', 'record_expense').row()
        .text('📊 View Summary', 'view_summary').row()
        .text('🏠 Main Menu', 'main_menu');

      await ctx.reply(
        '✅ Expense saved successfully!\n\n' +
        `Description: ${description}\n` +
        `Amount: ₹${amount}\n` +
        `Category: ${category}`,
        { reply_markup: keyboard }
      );
    } catch (error) {
      this.logger.error('Error saving expense:', error);
      await ctx.reply('Sorry, there was an error saving your expense. Please try again.');
    }
  }

  private async showMainMenu(ctx: BotContext) {
    const keyboard = new InlineKeyboard()
      .text('💸 Record Expense', 'record_expense').text('💵 Record Income', 'record_income').row()
      .text('📊 View Summary', 'view_summary').text('⚙️ Settings', 'settings').row()
      .text('❓ Help', 'help');

    await ctx.reply('Choose an option:', { reply_markup: keyboard });
  }

  private async cancelOperation(ctx: BotContext) {
    if (!ctx.session) return;

    ctx.session.state = '';
    ctx.session.data = {};

    await this.showMainMenu(ctx);
  }

  private async startIncomeFlow(ctx: BotContext) {
    await ctx.reply('Income recording coming soon!');
  }

  private async showSummary(ctx: BotContext) {
    await ctx.reply('Summary view coming soon!');
  }

  private async showSettings(ctx: BotContext) {
    await ctx.reply('Settings coming soon!');
  }
}