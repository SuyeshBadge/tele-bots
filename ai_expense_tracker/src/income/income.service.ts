import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Income, IncomeCategory } from '../models/income.model';

@Injectable()
export class IncomeService {
  private readonly logger = new Logger(IncomeService.name);

  constructor(
    @InjectModel(Income.name) private incomeModel: Model<Income>,
  ) {}

  async createIncome(
    userId: string,
    amount: number,
    category: IncomeCategory,
    description?: string,
    date?: Date,
    isRecurring?: boolean,
    recurringFrequency?: string,
    source?: string,
  ): Promise<Income> {
    try {
      const income = new this.incomeModel({
        userId,
        amount,
        category,
        description,
        date: date || new Date(),
        isRecurring: isRecurring || false,
        recurringFrequency,
        source,
      });

      const savedIncome = await income.save();
      this.logger.log(`Income created for user ${userId}: ${amount} - ${category}`);
      return savedIncome;
    } catch (error) {
      this.logger.error(`Error creating income: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getIncomeByUserId(userId: string): Promise<Income[]> {
    try {
      return this.incomeModel.find({ userId }).sort({ date: -1 }).exec();
    } catch (error) {
      this.logger.error(`Error fetching income for user ${userId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getIncomeByUserIdAndMonth(userId: string, month: number, year: number): Promise<Income[]> {
    try {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);

      return this.incomeModel
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
        `Error fetching income for user ${userId} for month ${month}/${year}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getIncomeByCategory(userId: string, month: number, year: number): Promise<Record<string, number>> {
    try {
      const incomes = await this.getIncomeByUserIdAndMonth(userId, month, year);
      
      const categoryTotals: Record<string, number> = {};
      
      incomes.forEach((income) => {
        const category = income.category;
        if (!categoryTotals[category]) {
          categoryTotals[category] = 0;
        }
        categoryTotals[category] += income.amount;
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

  async getTotalIncomeByMonth(userId: string, month: number, year: number): Promise<number> {
    try {
      const incomes = await this.getIncomeByUserIdAndMonth(userId, month, year);
      return incomes.reduce((total, income) => total + income.amount, 0);
    } catch (error) {
      this.logger.error(
        `Error calculating total income for user ${userId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
} 