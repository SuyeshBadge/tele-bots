/**
 * Common interfaces and types used throughout the application
 */

/**
 * Valid session states for the bot conversation
 */
export type SessionState = 
  | '' 
  | 'AWAITING_EXPENSE_DESCRIPTION'
  | 'AWAITING_EXPENSE_AMOUNT'
  | 'AWAITING_EXPENSE_CATEGORY'
  | 'AWAITING_INCOME_DESCRIPTION'
  | 'AWAITING_INCOME_AMOUNT';

/**
 * Specific data types for different session states
 */
export interface ExpenseSessionData {
  description?: string;
  amount?: number;
  category?: string;
  paymentMethod?: PaymentMethod;
}

export interface IncomeSessionData {
  description?: string;
  amount?: number;
  category?: string;
}

/**
 * Union type for specific session data types
 */
export type SessionDataType = ExpenseSessionData | IncomeSessionData;

/**
 * Session data for tracking user state in conversations
 */
export interface SessionData<T extends SessionDataType = SessionDataType> {
  userId: string;
  state: SessionState;
  data: T;
}

/**
 * Category interface for expense and income categories
 */
export interface Category {
  id: string;
  name: string;
  icon?: string;
  type: 'expense' | 'income';
}

/**
 * Payment method types
 */
export enum PaymentMethod {
  CASH = 'cash',
  CREDIT_CARD = 'credit_card',
  DEBIT_CARD = 'debit_card',
  UPI = 'upi',
  NET_BANKING = 'net_banking',
  OTHER = 'other'
}

/**
 * User interface
 */
export interface User {
  id: string;
  telegramId?: string;
  name: string;
  email?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Summary data interface for financial summaries
 */
export interface SummaryData {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  categories: CategorySummary[];
  period: {
    startDate: Date;
    endDate: Date;
  };
}

/**
 * Category with spending/income amount for summaries
 */
export interface CategorySummary {
  name: string;
  amount: number;
  icon?: string;
} 