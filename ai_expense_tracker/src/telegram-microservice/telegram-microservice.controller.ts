import { Controller, Logger } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { TelegramMicroserviceService } from './telegram-microservice.service';
import { CreateExpenseDto, CreateIncomeDto } from '../interfaces/models.interfaces';

@Controller()
export class TelegramMicroserviceController {
  private readonly logger = new Logger(TelegramMicroserviceController.name);

  constructor(
    private readonly telegramMicroserviceService: TelegramMicroserviceService,
  ) {}

  @MessagePattern('create_expense')
  async createExpense(expense: CreateExpenseDto) {
    this.logger.log(`[Expense Service] Creating expense: ${JSON.stringify(expense)}`);
    try {
      const result = await this.telegramMicroserviceService.createExpense(expense);
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
      const result = await this.telegramMicroserviceService.createIncome(income);
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
      const result = await this.telegramMicroserviceService.getUserSummary(userId);
      this.logger.log(`[Summary Service] Summary retrieved successfully for user ${userId}`);
      return result;
    } catch (error) {
      this.logger.error(`[Summary Service] Error getting user summary: ${error.message}`, error.stack);
      throw error;
    }
  }

  @MessagePattern('get_user_categories')
  async getUserCategories(userId: string) {
    this.logger.log(`[Categories Service] Getting categories for user: ${userId}`);
    try {
      const result = await this.telegramMicroserviceService.getUserCategories(userId);
      this.logger.log(`[Categories Service] Categories retrieved successfully for user ${userId}`);
      return result;
    } catch (error) {
      this.logger.error(`[Categories Service] Error getting user categories: ${error.message}`, error.stack);
      throw error;
    }
  }

  @MessagePattern('authorize_user')
  async authorizeUser(userId: string) {
    this.logger.log(`[Auth Service] Authorizing user: ${userId}`);
    try {
      const result = await this.telegramMicroserviceService.authorizeUser(userId);
      this.logger.log(`[Auth Service] User ${userId} authorized successfully`);
      return result;
    } catch (error) {
      this.logger.error(`[Auth Service] Error authorizing user: ${error.message}`, error.stack);
      throw error;
    }
  }

  @MessagePattern('get_user_settings')
  async getUserSettings(userId: string) {
    this.logger.log(`[Settings Service] Getting settings for user: ${userId}`);
    try {
      const result = await this.telegramMicroserviceService.getUserSettings(userId);
      this.logger.log(`[Settings Service] Settings retrieved successfully for user ${userId}`);
      return result;
    } catch (error) {
      this.logger.error(`[Settings Service] Error getting user settings: ${error.message}`, error.stack);
      throw error;
    }
  }

  @MessagePattern('update_user_settings')
  async updateUserSettings(data: { userId: string; settings: any }) {
    this.logger.log(`[Settings Service] Updating settings for user: ${data.userId}`);
    try {
      const result = await this.telegramMicroserviceService.updateUserSettings(data.userId, data.settings);
      this.logger.log(`[Settings Service] Settings updated successfully for user ${data.userId}`);
      return result;
    } catch (error) {
      this.logger.error(`[Settings Service] Error updating user settings: ${error.message}`, error.stack);
      throw error;
    }
  }
} 