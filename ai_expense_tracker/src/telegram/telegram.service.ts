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
  ) {}

  onModuleInit() {
    const token = this.configService.get('TELEGRAM_BOT_TOKEN');
    const nodeEnv = this.configService.get('NODE_ENV');
    
    // Skip Telegram bot initialization in development mode if token is not valid
    if (nodeEnv === 'development' && (!token || token === 'your_telegram_bot_token_here')) {
      this.logger.warn('Telegram bot skipped in development mode. Set a valid token to enable it.');
      return;
    }
    
    if (!token) {
      this.logger.warn('Telegram bot token not configured. Bot will not start.');
      return;
    }

    this.bot = new TelegramBot(token, { polling: true });
    this.logger.log('Telegram bot initialized and started polling');
    
    // Load authorized users from the database
    this.loadAuthorizedUsers();
    
    this.setupCommandHandlers();
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
        const token = await this.authService.generateTelegramToken(telegramId);
        
        this.bot.sendMessage(
          chatId,
          'Welcome to AI Expense Tracker Bot! 🤖💰\n\n' +
          'I can help you track your expenses with minimal effort.\n\n' +
          'Commands:\n' +
          '/start - Show this welcome message\n' +
          '/help - Show available commands\n' +
          '/income - Log a new income\n' +
          '/expense - Log a new expense\n' +
          '/upi - Log a UPI transaction\n' +
          '/summary - Get your monthly expense summary\n' +
          '/settings - Configure your preferences\n' +
          '/token - Get your API token for mobile/web app'
        );
      } catch (error) {
        this.logger.error(`Error in start command: ${error.message}`, error.stack);
        this.bot.sendMessage(
          chatId,
          'Sorry, there was an error processing your request. Please try again.'
        );
      }
    });
    
    // Add middleware for checking authorization for all other commands
    this.bot.on('message', async (msg) => {
      // Skip authentication for /start
      if (msg.text && msg.text.startsWith('/start')) {
        return;
      }
      
      const chatId = msg.chat.id;
      const telegramId = msg.from.id.toString();
      
      // Check if user is authorized
      const isAuthorized = await this.isUserAuthorized(telegramId);
      
      if (!isAuthorized) {
        this.bot.sendMessage(
          chatId,
          'You are not authorized to use this bot. Please use /start to register.'
        );
        return;
      }
      
      // Continue with processing the message
    });

    // Token command handler - authenticated
    this.bot.onText(/\/token/, async (msg) => {
      const chatId = msg.chat.id;
      const telegramId = msg.from.id.toString();
      
      try {
        // Check if user is authorized
        if (!await this.isUserAuthorized(telegramId)) {
          this.bot.sendMessage(
            chatId,
            'You are not authorized to use this bot. Please use /start to register.'
          );
          return;
        }
        
        // Generate a token for this user
        const token = await this.authService.generateTelegramToken(telegramId);
        
        this.bot.sendMessage(
          chatId,
          `Your API token for mobile/web app:\n\n${token}\n\nThis token is valid for 7 days. Keep it secure!`
        );
      } catch (error) {
        this.logger.error(`Error generating token: ${error.message}`, error.stack);
        this.bot.sendMessage(
          chatId,
          'Sorry, there was an error generating your token. Please try again.'
        );
      }
    });

    // Help command handler
    this.bot.onText(/\/help/, (msg) => {
      const chatId = msg.chat.id;
      this.bot.sendMessage(
        chatId,
        'AI Expense Tracker Bot Commands:\n\n' +
        '/start - Show welcome message\n' +
        '/help - Show this help message\n' +
        '/income - Log a new income\n' +
        '/expense - Log a new expense\n' +
        '/upi - Log a UPI transaction\n' +
        '/summary - Get your monthly expense summary\n' +
        '/settings - Configure your preferences\n' +
        '/token - Get your API token for mobile/web app'
      );
    });

    // UPI command handler
    this.bot.onText(/\/upi/, (msg) => {
      const chatId = msg.chat.id;
      this.userStates.set(chatId, { state: 'UPI_AMOUNT', data: {} });
      
      this.bot.sendMessage(
        chatId,
        'Please enter the UPI transaction amount:',
        {
          reply_markup: {
            force_reply: true,
          },
        }
      );
    });

    // Settings command handler
    this.bot.onText(/\/settings/, (msg) => {
      const chatId = msg.chat.id;
      this.userStates.set(chatId, { state: 'SETTINGS_MENU', data: {} });
      
      this.bot.sendMessage(
        chatId,
        'Settings Menu:\n\n' +
        '1. Set Monthly Budget\n' +
        '2. Enable/Disable Notifications\n' +
        '3. Set Reminder Time\n' +
        '4. Change Currency\n\n' +
        'Please select an option (1-4) or type "cancel" to exit:',
        {
          reply_markup: {
            force_reply: true,
          },
        }
      );
    });

    // Income command handler
    this.bot.onText(/\/income/, (msg) => {
      const chatId = msg.chat.id;
      this.userStates.set(chatId, { state: 'INCOME_AMOUNT', data: {} });
      
      this.bot.sendMessage(
        chatId,
        'Please enter the income amount:',
        {
          reply_markup: {
            force_reply: true,
          },
        }
      );
    });

    // Expense command handler
    this.bot.onText(/\/expense/, (msg) => {
      const chatId = msg.chat.id;
      this.userStates.set(chatId, { state: 'EXPENSE_AMOUNT', data: {} });
      
      this.bot.sendMessage(
        chatId,
        'Please enter the expense amount:',
        {
          reply_markup: {
            force_reply: true,
          },
        }
      );
    });

    // Summary command handler
    this.bot.onText(/\/summary/, async (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id.toString();
      
      try {
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth() + 1;
        const currentYear = currentDate.getFullYear();
        
        const totalIncome = await this.incomeService.getTotalIncomeByMonth(userId, currentMonth, currentYear);
        const totalExpense = await this.expenseService.getTotalExpensesByMonth(userId, currentMonth, currentYear);
        const balance = totalIncome - totalExpense;
        
        const expensesByCategory = await this.expenseService.getExpensesByCategory(userId, currentMonth, currentYear);
        
        let categoryBreakdown = '';
        for (const [category, amount] of Object.entries(expensesByCategory)) {
          categoryBreakdown += `${category}: ₹${amount.toFixed(2)}\n`;
        }
        
        this.bot.sendMessage(
          chatId,
          `📊 *Monthly Summary (${currentMonth}/${currentYear})*\n\n` +
          `💰 *Total Income:* ₹${totalIncome.toFixed(2)}\n` +
          `💸 *Total Expenses:* ₹${totalExpense.toFixed(2)}\n` +
          `💼 *Balance:* ₹${balance.toFixed(2)}\n\n` +
          `*Expense Breakdown:*\n${categoryBreakdown}`,
          { parse_mode: 'Markdown' }
        );
      } catch (error) {
        this.logger.error(`Error generating summary: ${error.message}`, error.stack);
        this.bot.sendMessage(
          chatId,
          'Sorry, there was an error generating your summary. Please try again later.'
        );
      }
    });

    // Message handler for conversation flow
    this.bot.on('message', (msg) => {
      if (msg.text && !msg.text.startsWith('/')) {
        const chatId = msg.chat.id;
        const userId = msg.from.id.toString();
        const userState = this.userStates.get(chatId);
        
        if (userState) {
          this.handleConversationState(chatId, userId, msg.text, userState);
        } else {
          this.bot.sendMessage(
            chatId,
            'I received your message. Please use commands to interact with me.'
          );
        }
      }
    });
  }

  private async handleConversationState(chatId: number, userId: string, text: string, userState: { state: string; data: any }) {
    try {
      switch (userState.state) {
        case 'UPI_AMOUNT':
          const upiAmount = parseFloat(text);
          if (isNaN(upiAmount)) {
            this.bot.sendMessage(chatId, 'Please enter a valid number for the amount.');
            return;
          }
          
          userState.data.amount = upiAmount;
          userState.state = 'UPI_MERCHANT';
          
          this.bot.sendMessage(
            chatId,
            'Please enter the merchant name:',
            {
              reply_markup: {
                force_reply: true,
              },
            }
          );
          break;
          
        case 'UPI_MERCHANT':
          if (!text || text.trim() === '') {
            this.bot.sendMessage(chatId, 'Please enter a valid merchant name.');
            return;
          }
          
          userState.data.merchantName = text;
          
          try {
            await this.upiService.mockUpiTransaction(
              userId,
              userState.data.amount,
              userState.data.merchantName
            );
            
            this.bot.sendMessage(
              chatId,
              `UPI transaction of ₹${userState.data.amount} to ${userState.data.merchantName} has been recorded successfully!`,
              {
                reply_markup: {
                  remove_keyboard: true,
                },
              }
            );
          } catch (error) {
            this.logger.error(`Error processing UPI transaction: ${error.message}`, error.stack);
            this.bot.sendMessage(
              chatId,
              'Sorry, there was an error processing your UPI transaction. Please try again.'
            );
          }
          
          this.userStates.delete(chatId);
          break;
          
        case 'SETTINGS_MENU':
          if (text === 'cancel') {
            this.bot.sendMessage(
              chatId,
              'Settings canceled.',
              {
                reply_markup: {
                  remove_keyboard: true,
                },
              }
            );
            this.userStates.delete(chatId);
            return;
          }
          
          const option = parseInt(text);
          if (isNaN(option) || option < 1 || option > 4) {
            this.bot.sendMessage(chatId, 'Please select a valid option (1-4) or type "cancel" to exit.');
            return;
          }
          
          switch (option) {
            case 1: // Set Monthly Budget
              userState.state = 'SETTINGS_BUDGET';
              this.bot.sendMessage(
                chatId,
                'Please enter your monthly budget amount:',
                {
                  reply_markup: {
                    force_reply: true,
                  },
                }
              );
              break;
              
            case 2: // Enable/Disable Notifications
              userState.state = 'SETTINGS_NOTIFICATIONS';
              this.bot.sendMessage(
                chatId,
                'Would you like to enable notifications?',
                {
                  reply_markup: {
                    keyboard: [[{ text: 'Yes' }, { text: 'No' }]],
                    one_time_keyboard: true,
                    resize_keyboard: true,
                  },
                }
              );
              break;
              
            case 3: // Set Reminder Time
              userState.state = 'SETTINGS_REMINDER_TIME';
              this.bot.sendMessage(
                chatId,
                'Please enter the time for daily reminders (HH:MM format, 24-hour):',
                {
                  reply_markup: {
                    force_reply: true,
                  },
                }
              );
              break;
              
            case 4: // Change Currency
              userState.state = 'SETTINGS_CURRENCY';
              this.bot.sendMessage(
                chatId,
                'Currently only INR (₹) is supported.',
                {
                  reply_markup: {
                    remove_keyboard: true,
                  },
                }
              );
              this.userStates.delete(chatId);
              break;
          }
          break;
          
        case 'SETTINGS_BUDGET':
          const budget = parseFloat(text);
          if (isNaN(budget) || budget <= 0) {
            this.bot.sendMessage(chatId, 'Please enter a valid budget amount.');
            return;
          }
          
          await this.userService.updateUserPreferences(userId, { monthlyBudget: budget });
          
          this.bot.sendMessage(
            chatId,
            `Your monthly budget has been set to ₹${budget.toFixed(2)}.`,
            {
              reply_markup: {
                remove_keyboard: true,
              },
            }
          );
          
          this.userStates.delete(chatId);
          break;
          
        case 'SETTINGS_NOTIFICATIONS':
          const enableNotifications = text.toLowerCase() === 'yes';
          
          await this.userService.updateUserPreferences(userId, { notificationsEnabled: enableNotifications });
          
          this.bot.sendMessage(
            chatId,
            `Notifications have been ${enableNotifications ? 'enabled' : 'disabled'}.`,
            {
              reply_markup: {
                remove_keyboard: true,
              },
            }
          );
          
          this.userStates.delete(chatId);
          break;
          
        case 'SETTINGS_REMINDER_TIME':
          const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
          if (!timeRegex.test(text)) {
            this.bot.sendMessage(chatId, 'Please enter a valid time in HH:MM format (24-hour).');
            return;
          }
          
          await this.userService.updateUserPreferences(userId, { reminderTime: text });
          
          this.bot.sendMessage(
            chatId,
            `Your reminder time has been set to ${text}.`,
            {
              reply_markup: {
                remove_keyboard: true,
              },
            }
          );
          
          this.userStates.delete(chatId);
          break;
          
        case 'INCOME_AMOUNT':
          const incomeAmount = parseFloat(text);
          if (isNaN(incomeAmount)) {
            this.bot.sendMessage(chatId, 'Please enter a valid number for the amount.');
            return;
          }
          
          userState.data.amount = incomeAmount;
          userState.state = 'INCOME_CATEGORY';
          
          const incomeCategoryOptions = Object.values(IncomeCategory).map(category => ({
            text: category,
          }));
          
          this.bot.sendMessage(
            chatId,
            'Please select the income category:',
            {
              reply_markup: {
                keyboard: this.chunkArray(incomeCategoryOptions, 2),
                one_time_keyboard: true,
                resize_keyboard: true,
              },
            }
          );
          break;
          
        case 'INCOME_CATEGORY':
          if (!Object.values(IncomeCategory).includes(text as IncomeCategory)) {
            this.bot.sendMessage(chatId, 'Please select a valid category from the keyboard.');
            return;
          }
          
          userState.data.category = text;
          userState.state = 'INCOME_DESCRIPTION';
          
          this.bot.sendMessage(
            chatId,
            'Please enter a description (or type "skip" to skip):',
            {
              reply_markup: {
                force_reply: true,
              },
            }
          );
          break;
          
        case 'INCOME_DESCRIPTION':
          userState.data.description = text === 'skip' ? '' : text;
          
          await this.incomeService.createIncome(
            userId,
            userState.data.amount,
            userState.data.category as IncomeCategory,
            userState.data.description
          );
          
          this.bot.sendMessage(
            chatId,
            `Income of ₹${userState.data.amount} (${userState.data.category}) has been recorded successfully!`,
            {
              reply_markup: {
                remove_keyboard: true,
              },
            }
          );
          
          this.userStates.delete(chatId);
          break;
          
        case 'EXPENSE_AMOUNT':
          const expenseAmount = parseFloat(text);
          if (isNaN(expenseAmount)) {
            this.bot.sendMessage(chatId, 'Please enter a valid number for the amount.');
            return;
          }
          
          userState.data.amount = expenseAmount;
          userState.state = 'EXPENSE_CATEGORY';
          
          const expenseCategoryOptions = Object.values(ExpenseCategory).map(category => ({
            text: category,
          }));
          
          this.bot.sendMessage(
            chatId,
            'Please select the expense category:',
            {
              reply_markup: {
                keyboard: this.chunkArray(expenseCategoryOptions, 2),
                one_time_keyboard: true,
                resize_keyboard: true,
              },
            }
          );
          break;
          
        case 'EXPENSE_CATEGORY':
          if (!Object.values(ExpenseCategory).includes(text as ExpenseCategory)) {
            this.bot.sendMessage(chatId, 'Please select a valid category from the keyboard.');
            return;
          }
          
          userState.data.category = text;
          userState.state = 'EXPENSE_PAYMENT_METHOD';
          
          const paymentMethodOptions = Object.values(PaymentMethod).map(method => ({
            text: method,
          }));
          
          this.bot.sendMessage(
            chatId,
            'Please select the payment method:',
            {
              reply_markup: {
                keyboard: this.chunkArray(paymentMethodOptions, 2),
                one_time_keyboard: true,
                resize_keyboard: true,
              },
            }
          );
          break;
          
        case 'EXPENSE_PAYMENT_METHOD':
          if (!Object.values(PaymentMethod).includes(text as PaymentMethod)) {
            this.bot.sendMessage(chatId, 'Please select a valid payment method from the keyboard.');
            return;
          }
          
          userState.data.paymentMethod = text;
          userState.state = 'EXPENSE_DESCRIPTION';
          
          this.bot.sendMessage(
            chatId,
            'Please enter a description (or type "skip" to skip):',
            {
              reply_markup: {
                force_reply: true,
              },
            }
          );
          break;
          
        case 'EXPENSE_DESCRIPTION':
          userState.data.description = text === 'skip' ? '' : text;
          
          await this.expenseService.createExpense(
            userId,
            userState.data.amount,
            userState.data.category as ExpenseCategory,
            userState.data.paymentMethod as PaymentMethod,
            userState.data.description
          );
          
          this.bot.sendMessage(
            chatId,
            `Expense of ₹${userState.data.amount} (${userState.data.category}) has been recorded successfully!`,
            {
              reply_markup: {
                remove_keyboard: true,
              },
            }
          );
          
          this.userStates.delete(chatId);
          break;
          
        default:
          this.bot.sendMessage(chatId, 'I received your message. Please use commands to interact with me.');
          this.userStates.delete(chatId);
      }
    } catch (error) {
      this.logger.error(`Error in conversation flow: ${error.message}`, error.stack);
      this.bot.sendMessage(
        chatId,
        'Sorry, there was an error processing your request. Please try again.'
      );
      this.userStates.delete(chatId);
    }
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const result = [];
    for (let i = 0; i < array.length; i += size) {
      result.push(array.slice(i, i + size));
    }
    return result;
  }

  // Method to send messages to users
  sendMessage(chatId: number, text: string): Promise<TelegramBot.Message> {
    return this.bot.sendMessage(chatId, text);
  }
} 