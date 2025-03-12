/**
 * AI Expense Tracker Type Definitions
 * 
 * This module exports all the interfaces and types used throughout the application.
 * 
 * Organization:
 * 
 * - common.interfaces.ts: Core interfaces shared across the application
 *   (SessionData, Category, PaymentMethod, etc.)
 * 
 * - models.interfaces.ts: Data model interfaces representing domain entities
 *   (Expense, Income, User, etc.)
 * 
 * - services.interfaces.ts: Service interfaces that define behavior contracts
 *   (IExpenseService, IIncomeService, etc.)
 * 
 * - telegram.interfaces.ts: Interfaces for Telegram bot integration
 *   (BotContext, CallbackQueryData, etc.)
 * 
 * Notes on Type Safety:
 * 
 * 1. We avoid using 'any' throughout the codebase
 * 2. We use generics and type parameters to provide better type safety
 * 3. For external libraries with complex types (like GramIO), we use a pragmatic
 *    approach with simplified interfaces and type assertions where necessary
 */

// Common interfaces
export * from './common.interfaces';

// Telegram specific interfaces
export * from './telegram.interfaces';

// Data model interfaces
export * from './models.interfaces';

// Service interfaces
export * from './services.interfaces'; 