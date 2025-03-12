// Telegram Bot Service
// IMPORTANT: Follow the formatting guidelines in @tele-bot-formatting.md for all messages:
// - Use consistent emojis
// - Keep messages concise
// - Use proper markdown formatting
// - Structure information clearly

import { Injectable, OnModuleInit, Logger, UnauthorizedException } from '@nestjs/common';
import * as TelegramBot from 'node-telegram-bot-api';
import { ConfigService } from '@nestjs/config';
import { ExpenseService } from '../expense/expense.service';
import { IncomeService } from '../income/income.service';
import { UserService } from '../user/user.service';
import { UpiService } from '../upi/upi.service';
import { AuthService } from '../auth/auth.service';
import { ExpenseCategory, PaymentMethod } from '../models/expense.model';
import { IncomeCategory } from '../models/income.model';
import { TelegramMessageService } from './telegram.message.service';
import { TELEGRAM_MESSAGES } from './telegram.messages';

@Injectable()
export class TelegramService implements OnModuleInit {
  private bot: TelegramBot;
  private readonly logger = new Logger(TelegramService.name);
  private userStates: Map<number, { state: string; data: any }> = new Map();
  private authorizedUsers: Set<string> = new Set();

  constructor(
    private readonly configService: ConfigService,
    private readonly expenseService: ExpenseService,
    private readonly incomeService: IncomeService,
    private readonly userService: UserService,
    private readonly upiService: UpiService,
    private readonly authService: AuthService,
    private readonly telegramMessageService: TelegramMessageService,
  ) {}

  onModuleInit() {
    const token = this.configService.get('TELEGRAM_BOT_TOKEN');
    const nodeEnv = this.configService.get('NODE_ENV');
    const useGramIO = this.configService.get('USE_GRAMIO') === 'true';
    
    // Skip if GramIO is enabled (use GramIO service instead)
    if (useGramIO) {
      this.logger.log('Original TelegramService is disabled because GramIO is enabled.');
      return;
    }
    
    // Skip Telegram bot initialization in development mode if token is not valid
    if (nodeEnv === 'development' && (!token || token === 'your_telegram_bot_token_here')) {
      this.logger.warn('Telegram bot skipped in development mode. Set a valid token to enable it.');
      return;
    }
    
    if (!token) {
      this.logger.warn('Telegram bot token not configured. Bot will not start.');
      return;
    }

    // Initialize the bot with polling and parse mode HTML
    this.bot = new TelegramBot(token, { 
      polling: true
    });
    this.logger.log('Telegram bot initialized and started polling with HTML parse mode');
    
    // Load authorized users from the database
    this.loadAuthorizedUsers();
    
    this.setupCommandHandlers();
    this.setupCallbackHandlers();
    this.setupConversationHandlers();
  }
  
  private async loadAuthorizedUsers() {
    try {
      // This is a simplified approach - in a real app, you'd query for users with specific roles
      const allUsers = await this.userService.getAllUsers();
      allUsers.forEach(user => {
        this.authorizedUsers.add(user.telegramId);
      });
      this.logger.log(`Loaded ${this.authorizedUsers.size} authorized users`);
    } catch (error) {
      this.logger.error('Failed to load authorized users', error.stack);
    }
  }
  
  private async isUserAuthorized(telegramId: string): Promise<boolean> {
    // First check our cached set
    if (this.authorizedUsers.has(telegramId)) {
      return true;
    }
    
    // If not in cache, check database
    try {
      const user = await this.userService.getUserById(telegramId);
      if (user) {
        // Add to our cache for future checks
        this.authorizedUsers.add(telegramId);
        return true;
      }
    } catch (error) {
      this.logger.error(`Error checking user authorization: ${error.message}`);
    }
    
    return false;
  }

  private setupCommandHandlers() {
    // Start command handler - this is open to everyone as entry point
    this.bot.onText(/\/start/, async (msg) => {
      const chatId = msg.chat.id;
      const telegramId = msg.from.id.toString();
      const firstName = msg.from.first_name;
      const lastName = msg.from.last_name;
      const username = msg.from.username;
      
      try {
        // Create or update user
        await this.userService.findOrCreateUser(telegramId, firstName, lastName, username);
        
        // Add to authorized users
        this.authorizedUsers.add(telegramId);
        
        // Generate a token for this user
        await this.authService.generateTelegramToken(telegramId);
        
        // Show welcome message with buttons
        this.sendMessageWithButtons(
          chatId,
          this.telegramMessageService.formatMessage('WELCOME'),
          TELEGRAM_MESSAGES.WELCOME_BUTTONS
        );
        
        // Start guided tour for new users
        setTimeout(() => {
          this.sendMessageWithButtons(
            chatId,
            this.telegramMessageService.formatMessage('GUIDED_TOUR'),
            TELEGRAM_MESSAGES.GUIDED_TOUR_BUTTONS
          );
        }, 5000); // Send guided tour 5 seconds after welcome
      } catch (error) {
        this.logger.error(`Error in start command: ${error.message}`, error.stack);
        this.sendMessageWithButtons(
          chatId,
          this.telegramMessageService.formatMessage('GENERIC_ERROR'),
          TELEGRAM_MESSAGES.GENERIC_ERROR_BUTTONS
        );
      }
    });
    
    // Main menu command
    this.bot.onText(/\/menu/, (msg) => {
      const chatId = msg.chat.id;
      this.showMainMenu(chatId);
    });
    
    // Help command handler
    this.bot.onText(/\/help/, (msg) => {
      const chatId = msg.chat.id;
      this.sendMessageWithButtons(
        chatId,
        this.telegramMessageService.formatMessage('HELP'),
        TELEGRAM_MESSAGES.HELP_BUTTONS
      );
    });

    // Expense command - simplified to just show buttons
    this.bot.onText(/\/expense/, (msg) => {
      const chatId = msg.chat.id;
      const telegramId = msg.from.id.toString();
      this.startExpenseFlow(chatId, telegramId);
    });

    // Income command - simplified to just show buttons
    this.bot.onText(/\/income/, (msg) => {
      const chatId = msg.chat.id;
      const telegramId = msg.from.id.toString();
      this.startIncomeFlow(chatId, telegramId);
    });

    // Summary command - simplified
    this.bot.onText(/\/summary/, (msg) => {
      const chatId = msg.chat.id;
      this.showSummary(chatId);
    });

    // UPI command - simplified
    this.bot.onText(/\/upi/, (msg) => {
      const chatId = msg.chat.id;
      const telegramId = msg.from.id.toString();
      this.startUpiFlow(chatId, telegramId);
    });

    // Settings command
    this.bot.onText(/\/settings/, (msg) => {
      const chatId = msg.chat.id;
      this.showSettingsMenu(chatId);
    });
  }

  private setupCallbackHandlers() {
    // Handle button callback data
    this.bot.on('callback_query', async (callbackQuery) => {
      const chatId = callbackQuery.message.chat.id;
      const data = callbackQuery.data;
      const messageId = callbackQuery.message.message_id;
      const telegramId = callbackQuery.from.id.toString();
      
      // First acknowledge the button press
      this.bot.answerCallbackQuery(callbackQuery.id);
      
      try {
        // Parse callback data
        const action = data.toLowerCase();
        
        // Handle main menu actions
        if (action === 'main_menu') {
          this.showMainMenu(chatId);
          return;
        }
        
        // Handle expense actions
        if (action === 'record_expense') {
          this.startExpenseFlow(chatId, telegramId);
          return;
        }
        
        // Handle income actions
        if (action === 'record_income') {
          this.startIncomeFlow(chatId, telegramId);
          return;
        }
        
        // Handle summary actions
        if (action === 'view_summary') {
          this.showSummary(chatId);
          return;
        }
        
        // Handle settings actions
        if (action === 'settings') {
          this.showSettingsMenu(chatId);
          return;
        }
        
        // Handle UPI actions
        if (action === 'quick_upi') {
          this.startUpiFlow(chatId, telegramId);
          return;
        }
        
        // Handle cancel actions
        if (action === 'cancel') {
          this.cancelCurrentOperation(chatId);
          return;
        }
        
        // Handle specific category selections
        if (action.startsWith('category_')) {
          const category = action.replace('category_', '');
          this.handleCategorySelection(chatId, category);
          return;
        }
        
        // Handle guided tour responses
        if (action === 'start_tour') {
          this.startGuidedTour(chatId);
          return;
        }
        
        if (action === 'skip_tour') {
          this.sendMessageWithButtons(
            chatId,
            this.telegramMessageService.formatMessage('GUIDED_NEXT_STEP'),
            TELEGRAM_MESSAGES.GUIDED_NEXT_STEP_BUTTONS
          );
          return;
        }
        
        // Handle UPI category selection
        if (action.startsWith('upi_category_')) {
          const category = action.replace('upi_category_', '');
          this.handleUpiCategorySelection(chatId, category);
          return;
        }
        
        // Handle unknown callback
        this.logger.warn(`Unknown callback data: ${data}`);
        
      } catch (error) {
        this.logger.error(`Error handling callback: ${error.message}`, error.stack);
        this.sendMessageWithButtons(
          chatId,
          this.telegramMessageService.formatMessage('GENERIC_ERROR'),
          TELEGRAM_MESSAGES.GENERIC_ERROR_BUTTONS
        );
      }
    });
  }

  private setupConversationHandlers() {
    // This handles text messages for ongoing conversations
    this.bot.on('message', async (msg) => {
      // Skip command messages, we handle those separately
      if (msg.text && (msg.text.startsWith('/') || msg.entities?.some(e => e.type === 'bot_command'))) {
        return;
      }
      
      const chatId = msg.chat.id;
      const text = msg.text || '';
      const telegramId = msg.from.id.toString();
      
      // Check if user is authorized
      const isAuthorized = await this.isUserAuthorized(telegramId);
      if (!isAuthorized) {
        this.sendMessageWithButtons(
          chatId,
          this.telegramMessageService.formatMessage('UNAUTHORIZED'),
          TELEGRAM_MESSAGES.UNAUTHORIZED_BUTTONS
        );
        return;
      }
      
      // Check if we're in a conversation state
      const userState = this.userStates.get(chatId);
      if (userState) {
        this.handleConversationState(chatId, telegramId, text, userState);
        return;
      }
      
      // Handle button text clicks (for older clients that don't support inline buttons)
      this.handleButtonTextFallback(chatId, text, telegramId);
    });
  }

  // Handle text that might be button text for older clients
  private handleButtonTextFallback(chatId: number, text: string, userId: string = '') {
    const textLower = text.toLowerCase();
    
    // Main menu options
    if (textLower.includes('record expense')) {
      this.startExpenseFlow(chatId, userId);
      return;
    }
    
    if (textLower.includes('record income')) {
      this.startIncomeFlow(chatId, userId);
      return;
    }
    
    if (textLower.includes('view summary')) {
      this.showSummary(chatId);
      return;
    }
    
    if (textLower.includes('settings')) {
      this.showSettingsMenu(chatId);
      return;
    }
    
    if (textLower.includes('main menu')) {
      this.showMainMenu(chatId);
      return;
    }
    
    // For text that doesn't match any known buttons, show help
    this.sendMessageWithButtons(
      chatId,
      this.telegramMessageService.formatMessage('UNKNOWN_COMMAND'),
      TELEGRAM_MESSAGES.UNKNOWN_COMMAND_BUTTONS
    );
  }

  private async handleConversationState(chatId: number, userId: string, text: string, userState: { state: string; data: any }) {
    // Implementation depends on many states, so this is just an example pattern
    try {
      const state = userState.state;
      const data = userState.data || {};
      
      // Make sure userId is always set
      data.userId = data.userId || userId;
      
      // Handle different conversation states
      switch (state) {
        // Expense states
        case 'EXPENSE_AMOUNT':
          await this.handleExpenseAmount(chatId, text, data);
          break;
          
        case 'EXPENSE_CATEGORY':
          await this.handleExpenseCategory(chatId, text, data);
          break;
          
        case 'EXPENSE_PAYMENT':
          await this.handleExpensePayment(chatId, text, data);
          break;
          
        case 'EXPENSE_DESCRIPTION':
          await this.handleExpenseDescription(chatId, text, data);
          break;
          
        // Income states
        case 'INCOME_AMOUNT':
          await this.handleIncomeAmount(chatId, text, data);
          break;
          
        case 'INCOME_CATEGORY':
          await this.handleIncomeCategory(chatId, text, data);
          break;
          
        case 'INCOME_DESCRIPTION':
          await this.handleIncomeDescription(chatId, text, data);
          break;
          
        // UPI states
        case 'UPI_AMOUNT':
          await this.handleUpiAmount(chatId, text, data);
          break;
          
        case 'UPI_MERCHANT':
          await this.handleUpiMerchant(chatId, text, data);
          break;
        
        default:
          this.logger.warn(`Unknown state: ${state}`);
          this.cancelCurrentOperation(chatId);
      }
    } catch (error) {
      this.logger.error(`Error in conversation handler: ${error.message}`, error.stack);
      this.sendMessageWithButtons(
        chatId, 
        this.telegramMessageService.formatMessage('GENERIC_ERROR'),
        TELEGRAM_MESSAGES.GENERIC_ERROR_BUTTONS
      );
      this.userStates.delete(chatId);
    }
  }

  // State handlers for expense flow
  private async handleExpenseAmount(chatId: number, text: string, data: any) {
    const amount = parseFloat(text.trim());
    
    if (isNaN(amount) || amount <= 0) {
      this.bot.sendMessage(
        chatId,
        this.telegramMessageService.formatMessage('EXPENSE_AMOUNT_INVALID')
      );
      return;
    }
    
    // Update state data with the amount
    data.amount = amount;
    this.userStates.set(chatId, { state: 'EXPENSE_CATEGORY', data });
    
    // Show category selection with buttons
    this.sendMessageWithButtons(
      chatId,
      this.telegramMessageService.formatMessage('EXPENSE_AMOUNT_CONFIRM', { 
        amount: this.telegramMessageService.formatAmount(amount)
      }),
      TELEGRAM_MESSAGES.EXPENSE_CATEGORY_BUTTONS
    );
  }

  private async handleExpenseCategory(chatId: number, text: string, data: any) {
    // Get just the category name (strip emoji if present)
    let category = text.trim();
    if (category.includes(' ')) {
      category = category.split(' ')[1];
    }
    
    // Map text categories to ExpenseCategory enum
    let expenseCategory: ExpenseCategory;
    switch(category.toLowerCase()) {
      case 'food': expenseCategory = ExpenseCategory.FOOD; break;
      case 'transport': expenseCategory = ExpenseCategory.TRANSPORTATION; break;
      case 'entertainment': expenseCategory = ExpenseCategory.ENTERTAINMENT; break;
      case 'shopping': expenseCategory = ExpenseCategory.SHOPPING; break;
      case 'utilities': expenseCategory = ExpenseCategory.UTILITIES; break;
      case 'rent': expenseCategory = ExpenseCategory.RENT; break;
      case 'healthcare': expenseCategory = ExpenseCategory.HEALTH; break;
      case 'education': expenseCategory = ExpenseCategory.EDUCATION; break;
      case 'travel': expenseCategory = ExpenseCategory.TRAVEL; break;
      case 'cancel': 
        this.cancelCurrentOperation(chatId);
        return;
      default:
        this.bot.sendMessage(
          chatId,
          this.telegramMessageService.formatMessage('EXPENSE_CATEGORY_INVALID')
        );
        return;
    }
    
    // Update state with category
    data.category = expenseCategory;
    this.userStates.set(chatId, { state: 'EXPENSE_PAYMENT', data });
    
    // Show payment method buttons
    this.sendMessageWithButtons(
      chatId,
      this.telegramMessageService.formatMessage('EXPENSE_CATEGORY_CONFIRM', {
        category: this.telegramMessageService.formatCategory(expenseCategory)
      }),
      TELEGRAM_MESSAGES.EXPENSE_PAYMENT_BUTTONS
    );
  }

  private handleCategorySelection(chatId: number, category: string) {
    // Get the current conversation state
    const userState = this.userStates.get(chatId);
    if (!userState) {
      this.showMainMenu(chatId);
      return;
    }
    
    // Update the state with the selected category
    const data = userState.data || {};
    let expenseCategory: ExpenseCategory;
    
    switch(category.toLowerCase()) {
      case 'food': expenseCategory = ExpenseCategory.FOOD; break;
      case 'transport': expenseCategory = ExpenseCategory.TRANSPORTATION; break;
      case 'entertainment': expenseCategory = ExpenseCategory.ENTERTAINMENT; break;
      case 'shopping': expenseCategory = ExpenseCategory.SHOPPING; break;
      case 'utilities': expenseCategory = ExpenseCategory.UTILITIES; break;
      case 'rent': expenseCategory = ExpenseCategory.RENT; break;
      case 'healthcare': expenseCategory = ExpenseCategory.HEALTH; break;
      case 'education': expenseCategory = ExpenseCategory.EDUCATION; break;
      case 'travel': expenseCategory = ExpenseCategory.TRAVEL; break;
      default: expenseCategory = ExpenseCategory.OTHER;
    }
    
    data.category = expenseCategory;
    this.userStates.set(chatId, { state: 'EXPENSE_PAYMENT', data });
    
    // Show payment method buttons
    this.sendMessageWithButtons(
      chatId,
      this.telegramMessageService.formatMessage('EXPENSE_CATEGORY_CONFIRM', {
        category: this.telegramMessageService.formatCategory(expenseCategory)
      }),
      TELEGRAM_MESSAGES.EXPENSE_PAYMENT_BUTTONS
    );
  }
  
  private async handleExpensePayment(chatId: number, text: string, data: any) {
    // Get just the payment method (strip emoji if present)
    let paymentMethod = text.trim();
    if (paymentMethod.includes(' ')) {
      paymentMethod = paymentMethod.split(' ')[1];
    }
    
    // Map text payment methods to PaymentMethod enum
    let expensePaymentMethod: PaymentMethod;
    switch(paymentMethod.toLowerCase()) {
      case 'credit card': expensePaymentMethod = PaymentMethod.CREDIT_CARD; break;
      case 'debit card': expensePaymentMethod = PaymentMethod.DEBIT_CARD; break;
      case 'upi': expensePaymentMethod = PaymentMethod.UPI; break;
      case 'cash': expensePaymentMethod = PaymentMethod.CASH; break;
      case 'net banking': expensePaymentMethod = PaymentMethod.NET_BANKING; break;
      case 'back': 
        // Go back to category selection
        this.userStates.set(chatId, { state: 'EXPENSE_CATEGORY', data });
        this.sendMessageWithButtons(
          chatId,
          this.telegramMessageService.formatMessage('EXPENSE_AMOUNT_CONFIRM', { 
            amount: this.telegramMessageService.formatAmount(data.amount)
          }),
          TELEGRAM_MESSAGES.EXPENSE_CATEGORY_BUTTONS
        );
        return;
      default:
        this.bot.sendMessage(
          chatId,
          this.telegramMessageService.formatMessage('EXPENSE_PAYMENT_INVALID')
        );
        return;
    }
    
    // Update state with payment method
    data.paymentMethod = expensePaymentMethod;
    this.userStates.set(chatId, { state: 'EXPENSE_DESCRIPTION', data });
    
    // Prompt for description with Skip button
    this.sendMessageWithButtons(
      chatId,
      this.telegramMessageService.formatMessage('EXPENSE_PAYMENT_CONFIRM', {
        method: paymentMethod
      }),
      TELEGRAM_MESSAGES.EXPENSE_PAYMENT_CONFIRM_BUTTONS
    );
  }
  
  private async handleExpenseDescription(chatId: number, text: string, data: any) {
    // Check if user wants to skip
    if (text.includes('Skip') || text.toLowerCase() === 'skip') {
      data.description = '';
    } else {
      data.description = text.trim();
    }
    
    try {
      // Ensure we have a userId
      if (!data.userId) {
        this.logger.warn('No userId found for expense description');
        this.sendMessage(chatId, 'Unable to create expense: User not identified.');
        this.cancelCurrentOperation(chatId);
        return;
      }

      this.logger.log(`[handleExpenseDescription] Processing description: ${data.description}`);
      
      // Save the expense to the database
      await this.expenseService.createExpense(
        data.userId,
        data.amount,
        data.category,
        data.paymentMethod,
        data.description
      );
      
      // Show success message with next options - without mock budget data
      this.sendMessageWithButtons(
        chatId,
        this.telegramMessageService.formatMessage('EXPENSE_SUCCESS', {
          amount: this.telegramMessageService.formatAmount(data.amount),
          category: this.telegramMessageService.formatCategory(data.category),
          method: data.paymentMethod,
          description: data.description || '(None provided)'
        }),
        TELEGRAM_MESSAGES.EXPENSE_SUCCESS_BUTTONS
      );
      
      // Clear the conversation state
      this.userStates.delete(chatId);
    } catch (error) {
      this.logger.error(`Error saving expense: ${error.message}`, error.stack);
      this.sendMessageWithButtons(
        chatId,
        this.telegramMessageService.formatMessage('GENERIC_ERROR'),
        TELEGRAM_MESSAGES.GENERIC_ERROR_BUTTONS
      );
      this.userStates.delete(chatId);
    }
  }

  // Add handler for income amount state
  private async handleIncomeAmount(chatId: number, text: string, data: any) {
    const amount = parseFloat(text.trim());
    
    if (isNaN(amount) || amount <= 0) {
      this.bot.sendMessage(
        chatId,
        this.telegramMessageService.formatMessage('INCOME_AMOUNT_INVALID')
      );
      return;
    }
    
    // Update state data with the amount
    data.amount = amount;
    this.userStates.set(chatId, { state: 'INCOME_CATEGORY', data });
    
    // Show category selection with buttons
    this.sendMessageWithButtons(
      chatId,
      this.telegramMessageService.formatMessage('INCOME_AMOUNT_CONFIRM', { 
        amount: this.telegramMessageService.formatAmount(amount)
      }),
      TELEGRAM_MESSAGES.INCOME_CATEGORY_BUTTONS
    );
  }

  // Add handler for income category state
  private async handleIncomeCategory(chatId: number, text: string, data: any) {
    // Get just the category name (strip emoji if present)
    let category = text.trim();
    if (category.includes(' ')) {
      category = category.split(' ')[1];
    }
    
    // Map text categories to IncomeCategory enum
    let incomeCategory: IncomeCategory;
    switch(category.toLowerCase()) {
      case 'salary': incomeCategory = IncomeCategory.SALARY; break;
      case 'freelance': incomeCategory = IncomeCategory.FREELANCE; break;
      case 'investment': incomeCategory = IncomeCategory.INVESTMENT; break;
      case 'gift': incomeCategory = IncomeCategory.GIFT; break;
      case 'cancel': 
        this.cancelCurrentOperation(chatId);
        return;
      default:
        this.bot.sendMessage(
          chatId,
          this.telegramMessageService.formatMessage('INCOME_CATEGORY_INVALID')
        );
        return;
    }
    
    // Update state with category
    data.category = incomeCategory;
    this.userStates.set(chatId, { state: 'INCOME_DESCRIPTION', data });
    
    // Prompt for description
    this.sendMessageWithButtons(
      chatId,
      this.telegramMessageService.formatMessage('INCOME_CATEGORY_CONFIRM', {
        category: this.telegramMessageService.formatCategory(incomeCategory)
      }),
      TELEGRAM_MESSAGES.INCOME_CATEGORY_CONFIRM_BUTTONS
    );
  }

  // Add handler for income description state
  private async handleIncomeDescription(chatId: number, text: string, data: any) {
    // Check if user wants to skip
    if (text.includes('Skip') || text.toLowerCase() === 'skip') {
      data.description = '';
    } else {
      data.description = text.trim();
    }
    
    try {
      // Ensure we have a userId
      if (!data.userId) {
        this.logger.warn('No userId found for income description');
        this.sendMessage(chatId, 'Unable to create income: User not identified.');
        this.cancelCurrentOperation(chatId);
        return;
      }

      this.logger.log(`[handleIncomeDescription] Processing description: ${data.description}`);
      
      // Save the income to the database
      await this.incomeService.createIncome(
        data.userId,
        data.amount,
        data.category,
        data.description
      );
      
      // Show success message with next options - without mock data
      this.sendMessageWithButtons(
        chatId,
        this.telegramMessageService.formatMessage('INCOME_SUCCESS', {
          amount: this.telegramMessageService.formatAmount(data.amount),
          category: this.telegramMessageService.formatCategory(data.category),
          description: data.description || '(None provided)'
        }),
        TELEGRAM_MESSAGES.INCOME_SUCCESS_BUTTONS
      );
      
      // Clear the conversation state
      this.userStates.delete(chatId);
    } catch (error) {
      this.logger.error(`Error saving income: ${error.message}`, error.stack);
      this.sendMessageWithButtons(
        chatId,
        this.telegramMessageService.formatMessage('GENERIC_ERROR'),
        TELEGRAM_MESSAGES.GENERIC_ERROR_BUTTONS
      );
      this.userStates.delete(chatId);
    }
  }

  // Add handlers for UPI states
  private async handleUpiAmount(chatId: number, text: string, data: any) {
    const amount = parseFloat(text.trim());
    
    if (isNaN(amount) || amount <= 0) {
      this.bot.sendMessage(
        chatId,
        this.telegramMessageService.formatMessage('UPI_AMOUNT_INVALID')
      );
      return;
    }
    
    // Update state data with the amount
    data.amount = amount;
    this.userStates.set(chatId, { state: 'UPI_MERCHANT', data });
    
    // Prompt for merchant
    this.bot.sendMessage(
      chatId,
      this.telegramMessageService.formatMessage('UPI_AMOUNT_CONFIRM', { 
        amount: this.telegramMessageService.formatAmount(amount)
      })
    );
  }

  private async handleUpiMerchant(chatId: number, text: string, data: any) {
    try {
      // Ensure we have a userId
      if (!data.userId) {
        this.logger.warn('No userId found for UPI merchant');
        this.sendMessage(chatId, 'Unable to process UPI transaction: User not identified.');
        this.cancelCurrentOperation(chatId);
        return;
      }

      if (!text || text.trim() === '') {
        this.sendMessage(
          chatId,
          this.telegramMessageService.formatMessage('UPI_MERCHANT_INVALID')
        );
        return;
      }

      const merchantName = text.trim();
      data.merchantName = merchantName;
      
      this.logger.log(`[handleUpiMerchant] Processing merchant: ${merchantName}`);
      
      // Update the state with merchant info
      this.userStates.set(chatId, { 
        state: 'UPI_CATEGORY', 
        data: data 
      });

      // Ask for category without suggesting any mock detected category
      const message = this.telegramMessageService.formatMessage('UPI_CATEGORY_PROMPT', {
        amount: this.telegramMessageService.formatAmount(data.amount),
        merchant: merchantName
      });
      
      await this.sendMessageWithInlineButtons(chatId, message, [
        [{ text: '🍔 Food', callback_data: 'upi_category_Food' }, { text: '🛒 Groceries', callback_data: 'upi_category_Groceries' }],
        [{ text: '🚇 Transport', callback_data: 'upi_category_Transport' }, { text: '🏠 Utilities', callback_data: 'upi_category_Utilities' }],
        [{ text: '🎬 Entertainment', callback_data: 'upi_category_Entertainment' }, { text: '👚 Shopping', callback_data: 'upi_category_Shopping' }],
        [{ text: '❓ Other', callback_data: 'upi_category_Other' }]
      ]);
    } catch (error) {
      this.logger.error(`Error handling UPI merchant: ${error.message}`, error.stack);
      await this.sendMessage(chatId, 'Sorry, there was an error processing your UPI transaction. Please try again.');
      this.cancelCurrentOperation(chatId);
    }
  }

  // Handle UPI category selection
  private async handleUpiCategorySelection(chatId: number, category: string) {
    try {
      const state = this.userStates.get(chatId);
      if (!state || state.state !== 'UPI_CATEGORY') {
        return;
      }
      
      const data = state.data;
      
      // Ensure userId is present
      if (!data.userId) {
        this.logger.warn('No userId found for UPI category selection');
        this.sendMessage(chatId, 'Unable to process UPI transaction: User not identified.');
        this.cancelCurrentOperation(chatId);
        return;
      }
      
      // Create an expense entry for the UPI transaction
      // We're treating UPI transactions as expenses with a payment method of 'UPI'
      await this.expenseService.createExpense(
        data.userId,
        data.amount,
        category as any, // Convert to expected type
        'UPI' as any, // Convert to expected payment method type
        `UPI payment to ${data.merchantName}`
      );
      
      // Get current date for display
      const date = new Date().toLocaleDateString();
      
      // Show success message
      this.sendMessageWithButtons(
        chatId,
        this.telegramMessageService.formatMessage('UPI_SUCCESS', {
          amount: this.telegramMessageService.formatAmount(data.amount),
          merchant: data.merchantName,
          date: date,
          category: category
        }),
        TELEGRAM_MESSAGES.UPI_SUCCESS_BUTTONS
      );
      
      // Clear the conversation state
      this.userStates.delete(chatId);
    } catch (error) {
      this.logger.error(`Error processing UPI category: ${error.message}`, error.stack);
      this.sendMessage(chatId, 'Sorry, there was an error processing your UPI transaction. Please try again.');
      this.cancelCurrentOperation(chatId);
    }
  }

  // Method to send messages to users
  sendMessage(chatId: number, text: string): Promise<TelegramBot.Message> {
    try {
      // Convert Markdown-style asterisks to HTML bold tags
      const formattedText = text.replace(/\*(.*?)\*/g, '<b>$1</b>');
      
      const options: any = {
        parse_mode: 'HTML'
      };
      
      return this.bot.sendMessage(chatId, formattedText, options);
    } catch (error) {
      this.logger.error('Error sending message with formatting', error);
      // Fallback to plain text if formatting fails
      return this.bot.sendMessage(chatId, text.replace(/\*(.*?)\*/g, '$1'));
    }
  }

  // Helper methods for displaying UI elements
  private sendMessageWithButtons(chatId: number, text: string, buttons: string[][]) {
    try {
      // Convert string buttons to KeyboardButton objects
      const keyboardButtons = buttons.map(row => 
        row.map(buttonText => ({ text: buttonText }))
      );
      
      // Convert Markdown-style asterisks to HTML bold tags
      const formattedText = text.replace(/\*(.*?)\*/g, '<b>$1</b>');
      
      const options: any = {
        parse_mode: 'HTML',
        reply_markup: {
          keyboard: keyboardButtons,
          resize_keyboard: true,
          one_time_keyboard: false
        }
      };
      
      this.bot.sendMessage(chatId, formattedText, options);
    } catch (error) {
      this.logger.error('Error sending message with buttons and formatting', error);
      // Fallback to plain text if formatting fails
      const keyboardButtons = buttons.map(row => 
        row.map(buttonText => ({ text: buttonText }))
      );
      
      this.bot.sendMessage(chatId, text.replace(/\*(.*?)\*/g, '$1'), {
        reply_markup: {
          keyboard: keyboardButtons,
          resize_keyboard: true,
          one_time_keyboard: false
        }
      });
    }
  }

  private sendMessageWithInlineButtons(chatId: number, text: string, buttons: Array<Array<{text: string, callback_data: string}>>) {
    try {
      // Convert Markdown-style asterisks to HTML bold tags
      const formattedText = text.replace(/\*(.*?)\*/g, '<b>$1</b>');
      
      const options: any = {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: buttons
        }
      };
      
      this.bot.sendMessage(chatId, formattedText, options);
    } catch (error) {
      this.logger.error('Error sending message with inline buttons and formatting', error);
      // Fallback to plain text if formatting fails
      this.bot.sendMessage(chatId, text.replace(/\*(.*?)\*/g, '$1'), {
        reply_markup: {
          inline_keyboard: buttons
        }
      });
    }
  }

  // Main menu and flow starters
  private showMainMenu(chatId: number) {
    this.userStates.delete(chatId); // Clear any ongoing conversation
    
    this.sendMessageWithButtons(
      chatId,
      this.telegramMessageService.formatMessage('MAIN_MENU'),
      TELEGRAM_MESSAGES.MAIN_MENU_BUTTONS
    );
  }
  
  private startGuidedTour(chatId: number) {
    // Tour sequence would be implemented here
    // For now, just show the main menu
    this.showMainMenu(chatId);
  }
  
  private startExpenseFlow(chatId: number, userId: string = '') {
    // Set initial state with userId
    const userState = {
      state: 'EXPENSE_AMOUNT', 
      data: { userId }
    };
    
    this.userStates.set(chatId, userState);
    
    // Send initial message
    this.bot.sendMessage(
      chatId,
      this.telegramMessageService.formatMessage('EXPENSE_START')
    );
  }
  
  private startIncomeFlow(chatId: number, userId: string = '') {
    // Set initial state with userId
    this.userStates.set(chatId, { 
      state: 'INCOME_AMOUNT', 
      data: { userId }
    });
    
    // Send initial message
    this.bot.sendMessage(
      chatId,
      this.telegramMessageService.formatMessage('INCOME_START')
    );
  }
  
  private startUpiFlow(chatId: number, userId: string = '') {
    // Set initial state with userId
    this.userStates.set(chatId, { 
      state: 'UPI_AMOUNT', 
      data: { userId }
    });
    
    // Send initial message
    this.bot.sendMessage(
      chatId,
      this.telegramMessageService.formatMessage('UPI_START')
    );
  }
  
  private async showSummary(chatId: number) {
    try {
      // Attempt to fetch data from the database
      // First, we need to get the user ID for this chat
      const user = await this.getUserForChat(chatId);
      
      if (!user || !user.id) {
        // Can't find user, so we can't show summary
        this.sendMessage(chatId, 'Unable to fetch summary: User not identified. Please login first.');
        return;
      }
      
      // Fetch real expense data
      const expenses = await this.expenseService.getExpensesByUserId(user.id);
      
      // Fetch real income data
      const incomes = await this.incomeService.getIncomeByUserId(user.id);
      
      if ((!expenses || expenses.length === 0) && (!incomes || incomes.length === 0)) {
        // No data available
        const message = `📊 *Financial Summary*\n\n` +
          `I don't have any expense or income data to show yet.\n\n` +
          `As you continue to track your expenses and income, you'll be able to see a comprehensive summary here.\n\n` +
          `What would you like to do next?`;
        
        this.sendMessageWithButtons(chatId, message, [
          ['📝 New Expense', '💰 New Income'],
          ['💸 UPI Transaction', '🏠 Main Menu']
        ]);
        return;
      }
      
      // Calculate totals
      const totalExpenses = expenses.reduce((total, expense) => total + expense.amount, 0);
      const totalIncome = incomes.reduce((total, income) => total + income.amount, 0);
      const netSavings = totalIncome - totalExpenses;
      
      // Get current month and year
      const now = new Date();
      const month = now.toLocaleString('default', { month: 'long' });
      const year = now.getFullYear();
      
      // Categorize expenses
      const categorizedExpenses = this.categorizeExpenses(expenses);
      const categorySummary = this.formatCategorySummary(categorizedExpenses);
      
      // Show the summary with real data
      this.sendMessageWithButtons(
        chatId,
        this.telegramMessageService.formatMessage('SUMMARY_RESULT', {
          month,
          year,
          totalExpenses: this.telegramMessageService.formatAmount(totalExpenses),
          totalIncome: this.telegramMessageService.formatAmount(totalIncome),
          netSavings: this.telegramMessageService.formatAmount(netSavings),
          categories: categorySummary
        }),
        TELEGRAM_MESSAGES.SUMMARY_RESULT_BUTTONS
      );
    } catch (error) {
      this.logger.error(`Error showing summary: ${error.message}`, error.stack);
      this.sendMessage(chatId, 'Sorry, there was an error fetching your summary. Please try again later.');
    }
  }
  
  // Helper method to get user for a chat
  private async getUserForChat(chatId: number): Promise<any> {
    try {
      // This requires either storing chat-to-user mapping or using telegram ID as user ID
      // Simplified approach - check if any authorized user matches this chat
      for (const telegramId of this.authorizedUsers) {
        if (telegramId === chatId.toString()) {
          // Use a generic findOne approach - the service likely has a method to find by ID
          // or we can use the telegramId directly as userId in some cases
          return { id: telegramId };
        }
      }
      return null;
    } catch (error) {
      this.logger.error(`Error getting user for chat: ${error.message}`, error.stack);
      return null;
    }
  }

  // Helper method to categorize expenses
  private categorizeExpenses(expenses: any[]): Map<string, number> {
    const categoryTotals = new Map<string, number>();
    
    for (const expense of expenses) {
      const category = expense.category;
      const currentTotal = categoryTotals.get(category) || 0;
      categoryTotals.set(category, currentTotal + expense.amount);
    }
    
    return categoryTotals;
  }

  // Helper method to format category summary
  private formatCategorySummary(categoryTotals: Map<string, number>): string {
    if (categoryTotals.size === 0) {
      return 'No categories to display';
    }
    
    // Get emoji for categories
    const categoryEmojis: {[key: string]: string} = {
      'Food': '🍔',
      'Transport': '🚗',
      'Rent': '🏠',
      'Utilities': '📱',
      'Entertainment': '🎬',
      'Shopping': '🛍️',
      'Healthcare': '🏥',
      'Education': '📚',
      'Travel': '✈️',
      'Other': '📦'
    };
    
    // Format each category
    let summary = '';
    for (const [category, total] of categoryTotals.entries()) {
      const emoji = categoryEmojis[category] || '📌';
      summary += `${emoji} ${category}: ${this.telegramMessageService.formatAmount(total)}\n`;
    }
    
    return summary;
  }
  
  private showSettingsMenu(chatId: number) {
    this.sendMessageWithButtons(
      chatId,
      this.telegramMessageService.formatMessage('SETTINGS_START'),
      TELEGRAM_MESSAGES.SETTINGS_BUTTONS
    );
  }
  
  private cancelCurrentOperation(chatId: number) {
    this.userStates.delete(chatId);
    
    this.sendMessageWithButtons(
      chatId,
      this.telegramMessageService.formatMessage('CONVERSATION_CANCELLED'),
      TELEGRAM_MESSAGES.CONVERSATION_CANCELLED_BUTTONS
    );
  }
} 