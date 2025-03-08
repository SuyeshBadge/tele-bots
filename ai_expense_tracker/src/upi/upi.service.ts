import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExpenseService } from '../expense/expense.service';
import { ExpenseCategory, PaymentMethod } from '../models/expense.model';

@Injectable()
export class UpiService {
  private readonly logger = new Logger(UpiService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly expenseService: ExpenseService,
  ) {}

  async processUpiTransaction(
    userId: string,
    upiId: string,
    amount: number,
    merchantName: string,
    timestamp: Date,
  ): Promise<void> {
    try {
      this.logger.log(`Processing UPI transaction: ${upiId} - ${amount} - ${merchantName}`);
      
      // Determine expense category based on merchant name
      const category = this.determineCategoryFromMerchant(merchantName);
      
      // Create expense entry
      await this.expenseService.createExpense(
        userId,
        amount,
        category,
        PaymentMethod.UPI,
        `UPI payment to ${merchantName}`,
        timestamp,
        false,
        null,
        upiId,
        merchantName,
      );
      
      this.logger.log(`UPI transaction processed successfully: ${upiId}`);
    } catch (error) {
      this.logger.error(`Error processing UPI transaction: ${error.message}`, error.stack);
      throw error;
    }
  }

  private determineCategoryFromMerchant(merchantName: string): ExpenseCategory {
    // Convert merchant name to lowercase for case-insensitive matching
    const merchant = merchantName.toLowerCase();
    
    // Food and Restaurants
    if (
      merchant.includes('restaurant') ||
      merchant.includes('food') ||
      merchant.includes('cafe') ||
      merchant.includes('swiggy') ||
      merchant.includes('zomato') ||
      merchant.includes('pizza') ||
      merchant.includes('burger') ||
      merchant.includes('hotel')
    ) {
      return ExpenseCategory.FOOD;
    }
    
    // Transportation
    if (
      merchant.includes('uber') ||
      merchant.includes('ola') ||
      merchant.includes('rapido') ||
      merchant.includes('metro') ||
      merchant.includes('transport') ||
      merchant.includes('petrol') ||
      merchant.includes('fuel') ||
      merchant.includes('gas')
    ) {
      return ExpenseCategory.TRANSPORTATION;
    }
    
    // Entertainment
    if (
      merchant.includes('movie') ||
      merchant.includes('cinema') ||
      merchant.includes('theatre') ||
      merchant.includes('pvr') ||
      merchant.includes('inox') ||
      merchant.includes('bookmyshow') ||
      merchant.includes('game') ||
      merchant.includes('entertainment')
    ) {
      return ExpenseCategory.ENTERTAINMENT;
    }
    
    // Shopping
    if (
      merchant.includes('amazon') ||
      merchant.includes('flipkart') ||
      merchant.includes('myntra') ||
      merchant.includes('ajio') ||
      merchant.includes('mall') ||
      merchant.includes('shop') ||
      merchant.includes('store') ||
      merchant.includes('retail')
    ) {
      return ExpenseCategory.SHOPPING;
    }
    
    // Utilities
    if (
      merchant.includes('electricity') ||
      merchant.includes('water') ||
      merchant.includes('gas') ||
      merchant.includes('bill') ||
      merchant.includes('recharge') ||
      merchant.includes('airtel') ||
      merchant.includes('jio') ||
      merchant.includes('vodafone') ||
      merchant.includes('utility')
    ) {
      return ExpenseCategory.UTILITIES;
    }
    
    // Health
    if (
      merchant.includes('hospital') ||
      merchant.includes('clinic') ||
      merchant.includes('doctor') ||
      merchant.includes('pharmacy') ||
      merchant.includes('medical') ||
      merchant.includes('health') ||
      merchant.includes('medicine') ||
      merchant.includes('apollo')
    ) {
      return ExpenseCategory.HEALTH;
    }
    
    // Default to Other if no match found
    return ExpenseCategory.OTHER;
  }

  async mockUpiTransaction(
    userId: string,
    amount: number,
    merchantName: string,
  ): Promise<void> {
    try {
      // Generate a mock UPI ID
      const upiId = `${userId}@mockupi${Math.floor(Math.random() * 1000)}`;
      
      // Use current timestamp
      const timestamp = new Date();
      
      // Process the mock transaction
      await this.processUpiTransaction(userId, upiId, amount, merchantName, timestamp);
      
      this.logger.log(`Mock UPI transaction created: ${upiId} - ${amount} - ${merchantName}`);
    } catch (error) {
      this.logger.error(`Error creating mock UPI transaction: ${error.message}`, error.stack);
      throw error;
    }
  }
} 