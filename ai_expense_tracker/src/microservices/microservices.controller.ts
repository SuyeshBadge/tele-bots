import { Controller, Logger } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { ExpenseService } from '../expense/expense.service';
import { IncomeService } from '../income/income.service';
import { UserService } from '../user/user.service';
import { AuthService } from '../auth/auth.service';
import { CreateExpenseDto, CreateIncomeDto } from '../interfaces/models.interfaces';
import { ExpenseCategory, PaymentMethod } from '../models/expense.model';
import { IncomeCategory } from '../models/income.model';

@Controller()
export class MicroservicesController {
  private readonly logger = new Logger(MicroservicesController.name);

  constructor(
    private readonly expenseService: ExpenseService,
    private readonly incomeService: IncomeService,
    private readonly userService: UserService,
    private readonly authService: AuthService,
  ) {}

  @MessagePattern('create_expense')
  async createExpense(expense: CreateExpenseDto) {
    this.logger.log(`[Expense Service] Creating expense: ${JSON.stringify(expense)}`);
    try {
      let category: ExpenseCategory;
      switch(expense.category.toLowerCase()) {
        case 'food': category = ExpenseCategory.FOOD; break;
        case 'transport': category = ExpenseCategory.TRANSPORTATION; break;
        case 'entertainment': category = ExpenseCategory.ENTERTAINMENT; break;
        case 'shopping': category = ExpenseCategory.SHOPPING; break;
        case 'utilities': category = ExpenseCategory.UTILITIES; break;
        case 'rent': category = ExpenseCategory.RENT; break;
        case 'health': category = ExpenseCategory.HEALTH; break;
        case 'education': category = ExpenseCategory.EDUCATION; break;
        case 'travel': category = ExpenseCategory.TRAVEL; break;
        default: category = ExpenseCategory.OTHER;
      }

      let paymentMethod: PaymentMethod;
      switch(expense.paymentMethod.toLowerCase()) {
        case 'upi': paymentMethod = PaymentMethod.UPI; break;
        case 'credit card': paymentMethod = PaymentMethod.CREDIT_CARD; break;
        case 'debit card': paymentMethod = PaymentMethod.DEBIT_CARD; break;
        case 'cash': paymentMethod = PaymentMethod.CASH; break;
        case 'net banking': paymentMethod = PaymentMethod.NET_BANKING; break;
        default: paymentMethod = PaymentMethod.OTHER;
      }

      const result = await this.expenseService.createExpense(
        expense.userId,
        expense.amount,
        category,
        paymentMethod,
        expense.description,
        expense.date
      );
      this.logger.log(`[Expense Service] Expense created successfully: ${JSON.stringify(result)}`);
      return result;
    } catch (error) {
      this.logger.error(`[Expense Service] Error creating expense: ${error.message}`, error.stack);
      throw error;
    }
  }

  @MessagePattern('create_income')
  async createIncome(income: CreateIncomeDto) {
    this.logger.log(`[Income Service] Creating income: ${JSON.stringify(income)}`);
    try {
      let category: IncomeCategory;
      switch(income.category.toLowerCase()) {
        case 'salary': category = IncomeCategory.SALARY; break;
        case 'freelance': category = IncomeCategory.FREELANCE; break;
        case 'business': category = IncomeCategory.BUSINESS; break;
        case 'investment': category = IncomeCategory.INVESTMENT; break;
        case 'gift': category = IncomeCategory.GIFT; break;
        case 'refund': category = IncomeCategory.REFUND; break;
        default: category = IncomeCategory.OTHER;
      }

      const result = await this.incomeService.createIncome(
        income.userId,
        income.amount,
        category,
        income.description,
        income.date
      );
      this.logger.log(`[Income Service] Income created successfully: ${JSON.stringify(result)}`);
      return result;
    } catch (error) {
      this.logger.error(`[Income Service] Error creating income: ${error.message}`, error.stack);
      throw error;
    }
  }

  @MessagePattern('get_user_summary')
  async getUserSummary(userId: string) {
    this.logger.log(`[Summary Service] Getting summary for user: ${userId}`);
    try {
      const expenses = await this.expenseService.getExpensesByUserId(userId);
      const incomes = await this.incomeService.getIncomeByUserId(userId);
      const summary = {
        totalExpenses: expenses.reduce((sum, exp) => sum + exp.amount, 0),
        totalIncome: incomes.reduce((sum, inc) => sum + inc.amount, 0),
        expenses,
        incomes,
      };
      this.logger.log(`[Summary Service] Summary retrieved successfully for user ${userId}`);
      return summary;
    } catch (error) {
      this.logger.error(`[Summary Service] Error getting user summary: ${error.message}`, error.stack);
      throw error;
    }
  }

  @MessagePattern('get_user_categories')
  async getUserCategories(userId: string) {
    this.logger.log(`[Categories Service] Getting categories for user: ${userId}`);
    try {
      const expenses = await this.expenseService.getExpensesByUserId(userId);
      const incomes = await this.incomeService.getIncomeByUserId(userId);
      const categories = {
        expenseCategories: [...new Set(expenses.map(exp => exp.category))],
        incomeCategories: [...new Set(incomes.map(inc => inc.category))],
      };
      this.logger.log(`[Categories Service] Categories retrieved successfully for user ${userId}`);
      return categories;
    } catch (error) {
      this.logger.error(`[Categories Service] Error getting user categories: ${error.message}`, error.stack);
      throw error;
    }
  }

  @MessagePattern('authorize_user')
  async authorizeUser(userId: string) {
    this.logger.log(`[Auth Service] Authorizing user: ${userId}`);
    try {
      const user = await this.userService.findOrCreateUser(userId);
      const token = await this.authService.generateTelegramToken(userId);
      this.logger.log(`[Auth Service] User ${userId} authorized successfully`);
      return { user, token };
    } catch (error) {
      this.logger.error(`[Auth Service] Error authorizing user: ${error.message}`, error.stack);
      throw error;
    }
  }

  @MessagePattern('get_user_settings')
  async getUserSettings(userId: string) {
    this.logger.log(`[Settings Service] Getting settings for user: ${userId}`);
    try {
      const user = await this.userService.getUserById(userId);
      if (!user) {
        throw new Error('User not found');
      }
      this.logger.log(`[Settings Service] Settings retrieved successfully for user ${userId}`);
      return user.preferences;
    } catch (error) {
      this.logger.error(`[Settings Service] Error getting user settings: ${error.message}`, error.stack);
      throw error;
    }
  }

  @MessagePattern('update_user_settings')
  async updateUserSettings(data: { userId: string; settings: any }) {
    this.logger.log(`[Settings Service] Updating settings for user: ${data.userId}`);
    try {
      const user = await this.userService.updateUserPreferences(data.userId, data.settings);
      this.logger.log(`[Settings Service] Settings updated successfully for user ${data.userId}`);
      return user;
    } catch (error) {
      this.logger.error(`[Settings Service] Error updating user settings: ${error.message}`, error.stack);
      throw error;
    }
  }
} 