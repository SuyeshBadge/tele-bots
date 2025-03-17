import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientProxy, ClientProxyFactory, Transport } from '@nestjs/microservices';
import { CreateExpenseDto, CreateIncomeDto } from '../interfaces/models.interfaces';

@Injectable()
export class TelegramMicroserviceService {
  private readonly logger = new Logger(TelegramMicroserviceService.name);
  private readonly mainAppClient: ClientProxy;

  constructor(
    private readonly configService: ConfigService,
  ) {
    // Create a client to communicate with the main application
    this.mainAppClient = ClientProxyFactory.create({
      transport: Transport.TCP,
      options: {
        host: this.configService.get('MAIN_APP_HOST', 'localhost'),
        port: this.configService.get('MAIN_APP_PORT', 3002),
      },
    });
  }

  async createExpense(expense: CreateExpenseDto) {
    try {
      this.logger.log(`Sending create expense request to main app: ${JSON.stringify(expense)}`);
      return await this.mainAppClient.send('create_expense', expense).toPromise();
    } catch (error) {
      this.logger.error(`Error creating expense: ${error.message}`, error.stack);
      throw error;
    }
  }

  async createIncome(income: CreateIncomeDto) {
    try {
      this.logger.log(`Sending create income request to main app: ${JSON.stringify(income)}`);
      return await this.mainAppClient.send('create_income', income).toPromise();
    } catch (error) {
      this.logger.error(`Error creating income: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getUserSummary(userId: string) {
    try {
      this.logger.log(`Requesting user summary for user ${userId}`);
      return await this.mainAppClient.send('get_user_summary', userId).toPromise();
    } catch (error) {
      this.logger.error(`Error getting user summary: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getUserCategories(userId: string) {
    try {
      this.logger.log(`Requesting categories for user ${userId}`);
      return await this.mainAppClient.send('get_user_categories', userId).toPromise();
    } catch (error) {
      this.logger.error(`Error getting user categories: ${error.message}`, error.stack);
      throw error;
    }
  }

  async authorizeUser(userId: string) {
    try {
      this.logger.log(`Authorizing user ${userId}`);
      return await this.mainAppClient.send('authorize_user', userId).toPromise();
    } catch (error) {
      this.logger.error(`Error authorizing user: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getUserSettings(userId: string) {
    try {
      this.logger.log(`Getting settings for user ${userId}`);
      return await this.mainAppClient.send('get_user_settings', userId).toPromise();
    } catch (error) {
      this.logger.error(`Error getting user settings: ${error.message}`, error.stack);
      throw error;
    }
  }

  async updateUserSettings(userId: string, settings: any) {
    try {
      this.logger.log(`Updating settings for user ${userId}`);
      return await this.mainAppClient.send('update_user_settings', { userId, settings }).toPromise();
    } catch (error) {
      this.logger.error(`Error updating user settings: ${error.message}`, error.stack);
      throw error;
    }
  }
} 