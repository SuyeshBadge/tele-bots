import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Expense, ExpenseCategory, PaymentMethod } from '../models/expense.model';

@Injectable()
export class ExpenseService {
  private readonly logger = new Logger(ExpenseService.name);

  constructor(
    @InjectModel(Expense.name) private expenseModel: Model<Expense>,
  ) {}

  async createExpense(
    userId: string,
    amount: number,
    category: ExpenseCategory,
    paymentMethod: PaymentMethod,
    description?: string,
    date?: Date,
    isRecurring?: boolean,
    recurringFrequency?: string,
    upiId?: string,
    merchantName?: string,
  ): Promise<Expense> {
    try {
      const expense = new this.expenseModel({
        userId,
        amount,
        category,
        paymentMethod,
        description,
        date: date || new Date(),
        isRecurring: isRecurring || false,
        recurringFrequency,
        upiId,
        merchantName,
      });

      const savedExpense = await expense.save();
      this.logger.log(`Expense created for user ${userId}: ${amount} - ${category}`);
      return savedExpense;
    } catch (error) {
      this.logger.error(`Error creating expense: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getExpensesByUserId(userId: string): Promise<Expense[]> {
    try {
      return this.expenseModel.find({ userId }).sort({ date: -1 }).exec();
    } catch (error) {
      this.logger.error(`Error fetching expenses for user ${userId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getExpensesByUserIdAndMonth(userId: string, month: number, year: number): Promise<Expense[]> {
    try {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);

      return this.expenseModel
        .find({
          userId,
          date: {
            $gte: startDate,
            $lte: endDate,
          },
        })
        .sort({ date: -1 })
        .exec();
    } catch (error) {
      this.logger.error(
        `Error fetching expenses for user ${userId} for month ${month}/${year}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getExpensesByCategory(userId: string, month: number, year: number): Promise<Record<string, number>> {
    try {
      const expenses = await this.getExpensesByUserIdAndMonth(userId, month, year);
      
      const categoryTotals: Record<string, number> = {};
      
      expenses.forEach((expense) => {
        const category = expense.category;
        if (!categoryTotals[category]) {
          categoryTotals[category] = 0;
        }
        categoryTotals[category] += expense.amount;
      });
      
      return categoryTotals;
    } catch (error) {
      this.logger.error(
        `Error calculating category totals for user ${userId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getTotalExpensesByMonth(userId: string, month: number, year: number): Promise<number> {
    try {
      const expenses = await this.getExpensesByUserIdAndMonth(userId, month, year);
      return expenses.reduce((total, expense) => total + expense.amount, 0);
    } catch (error) {
      this.logger.error(
        `Error calculating total expenses for user ${userId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
} 