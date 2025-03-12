/**
 * Service interfaces for the application
 */
import { 
  CreateExpenseDto, 
  CreateIncomeDto, 
  Expense, 
  Income, 
  SummaryQueryParams, 
  UserModel 
} from './models.interfaces';
import { SummaryData } from './common.interfaces';

/**
 * Expense service interface
 */
export interface IExpenseService {
  createExpense(createExpenseDto: CreateExpenseDto): Promise<Expense>;
  getExpenseById(id: string): Promise<Expense | null>;
  getExpensesByUserId(userId: string): Promise<Expense[]>;
  getTotalExpensesByUserId(userId: string): Promise<number>;
  getExpensesByCategory(userId: string, category: string): Promise<Expense[]>;
  deleteExpense(id: string): Promise<boolean>;
  updateExpense(id: string, updateData: Partial<CreateExpenseDto>): Promise<Expense>;
}

/**
 * Income service interface
 */
export interface IIncomeService {
  createIncome(createIncomeDto: CreateIncomeDto): Promise<Income>;
  getIncomeById(id: string): Promise<Income | null>;
  getIncomesByUserId(userId: string): Promise<Income[]>;
  getTotalIncomeByUserId(userId: string): Promise<number>;
  getIncomesByCategory(userId: string, category: string): Promise<Income[]>;
  deleteIncome(id: string): Promise<boolean>;
  updateIncome(id: string, updateData: Partial<CreateIncomeDto>): Promise<Income>;
}

/**
 * User service interface
 */
export interface IUserService {
  createUser(userData: Partial<UserModel>): Promise<UserModel>;
  getUserById(id: string): Promise<UserModel | null>;
  getUserByTelegramId(telegramId: string): Promise<UserModel | null>;
  getAllUsers(): Promise<UserModel[]>;
  updateUser(id: string, userData: Partial<UserModel>): Promise<UserModel>;
  deleteUser(id: string): Promise<boolean>;
}

/**
 * Auth service interface
 */
export interface IAuthService {
  validateUser(telegramId: string): Promise<boolean>;
  generateToken(telegramId: string): Promise<string>;
  verifyToken(token: string): Promise<string | null>;
}

/**
 * Summary service interface
 */
export interface ISummaryService {
  generateSummary(params: SummaryQueryParams): Promise<SummaryData>;
} 