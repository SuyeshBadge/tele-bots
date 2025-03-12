/**
 * Data model interfaces for the application
 */
import { PaymentMethod } from './common.interfaces';

/**
 * Base model interface with common properties
 */
export interface BaseModel {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Expense model interface
 */
export interface Expense extends BaseModel {
  userId: string;
  amount: number;
  description: string;
  category: string;
  date: Date;
  paymentMethod: PaymentMethod;
}

/**
 * Income model interface
 */
export interface Income extends BaseModel {
  userId: string;
  amount: number;
  description: string; 
  category: string;
  date: Date;
}

/**
 * Create expense DTO
 */
export interface CreateExpenseDto {
  userId: string;
  amount: number;
  description: string;
  category: string;
  paymentMethod: PaymentMethod;
  date?: Date;
}

/**
 * Create income DTO
 */
export interface CreateIncomeDto {
  userId: string;
  amount: number;
  description: string;
  category: string;
  date?: Date;
}

/**
 * User model interface
 */
export interface UserModel extends BaseModel {
  telegramId?: string;
  name: string;
  email?: string;
  isActive: boolean;
  preferences?: UserPreferences;
}

/**
 * User preferences interface
 */
export interface UserPreferences {
  currency: string;
  locale: string;
  notificationsEnabled: boolean;
  monthlyBudget?: number;
  categories?: {
    expense: string[];
    income: string[];
  };
}

/**
 * Summary query parameters
 */
export interface SummaryQueryParams {
  userId: string;
  startDate?: Date;
  endDate?: Date;
  groupBy?: 'day' | 'week' | 'month' | 'year' | 'category';
}

/**
 * Error response
 */
export interface ErrorResponse {
  statusCode: number;
  message: string;
  error: string;
  timestamp: Date;
  path?: string;
} 