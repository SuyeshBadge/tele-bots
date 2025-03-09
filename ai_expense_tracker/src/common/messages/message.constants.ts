/**
 * Centralized messages for AI Expense Tracker
 * 
 * This file contains all user-facing messages used throughout the application.
 * Using constants ensures consistency and makes updates easier.
 * 
 * Variables in messages are denoted with {variableName} and should be 
 * replaced at runtime using the MessageService.
 */

// General Success Messages
export const SUCCESS_MESSAGES = {
  CREATED: '✅ Successfully created {resourceName}.',
  UPDATED: '✅ Successfully updated {resourceName}.',
  DELETED: '✅ Successfully deleted {resourceName}.',
  SAVED: '💾 Your changes have been saved.',
  LOGGED_IN: '👋 Welcome back, {name}! You\'ve successfully logged in.',
  LOGGED_OUT: '👋 You\'ve been securely logged out. Have a great day!',
  PASSWORD_CHANGED: '🔐 Your password has been successfully updated. Your account is now more secure!',
  SETTINGS_UPDATED: '⚙️ Your settings have been updated successfully.',
  DATA_EXPORTED: '📊 Your data has been exported successfully. Check your email for the download link.',
};

// Onboarding and Welcome Messages
export const ONBOARDING_MESSAGES = {
  WELCOME: '🎉 Welcome to AI Expense Tracker! We\'re excited to help you gain clarity and confidence with your finances.',
  BUDGET_SETUP: '💰 Let\'s set up your monthly budget together. This helps us provide personalized insights just for you.',
  ACCOUNT_LINKING_TIP: '💡 Tip: Connect your accounts to automatically track expenses and save time.',
  FIRST_EXPENSE: '🚀 You\'ve recorded your first expense! Keep it up to discover valuable insights about your spending habits.',
  CATEGORY_SETUP: '🗂️ Personalizing your expense categories helps us provide more relevant insights for your unique financial journey.',
};

// Expense Related Messages
export const EXPENSE_MESSAGES = {
  CREATED: '💸 Your {category} expense of ${amount} has been recorded.',
  UPDATED: '✏️ Expense updated successfully.',
  DELETED: '🗑️ Expense has been deleted.',
  OVER_BUDGET: '⚠️ This expense puts you ${amount} over your {category} budget for this month.',
  NEAR_BUDGET: '📊 You\'ve now used {percentage}% of your {category} budget for this month.',
  BUDGET_REACHED: '🔔 You\'ve reached your {category} budget for this month. Would you like to adjust it?',
  RECURRING_CREATED: '🔄 Recurring expense set up. We\'ll automatically track this {frequency}.',
  SUGGESTION: '💡 Based on your spending patterns, you might want to adjust your {category} budget to ${suggestedAmount}.',
};

// Budget and Financial Insights
export const BUDGET_MESSAGES = {
  CREATED: '🎯 Your budget has been set up! We\'ll help you track your progress throughout the month.',
  UPDATED: '📝 Your budget has been updated. The changes will be reflected in your next financial summary.',
  BUDGET_ALERT: '⚠️ You\'ve used {percentage}% of your {category} budget with {daysLeft} days left in the month.',
  UNDER_BUDGET: '🏆 Congratulations! You stayed under your {category} budget this month by ${amount}.',
  OVER_BUDGET_SUMMARY: '📈 You went over your {category} budget by ${amount} this month. Let\'s look at ways to adjust for next month.',
  MONTHLY_SUMMARY: '📊 Your monthly summary is ready! You spent ${totalAmount} across {categoryCount} categories this month.',
  SAVING_OPPORTUNITY: '💰 Based on your {category} spending, you could save about ${amount} by {savingTip}.',
};

// Error Messages
export const ERROR_MESSAGES = {
  // Authentication Errors
  AUTH_FAILED: '🔒 We couldn\'t authenticate you. Please check your credentials and try again.',
  SESSION_EXPIRED: '⏰ Your session has expired. Please log in again to continue.',
  UNAUTHORIZED: '🚫 You don\'t have permission to perform this action.',
  
  // Validation Errors
  INVALID_INPUT: '❌ Please check the highlighted fields and try again.',
  REQUIRED_FIELD: '❗ This field is required to help us accurately track your finances.',
  INVALID_DATE: '📅 Please enter a valid date.',
  INVALID_AMOUNT: '💲 Please enter a valid amount.',
  INVALID_CATEGORY: '📁 Please select a valid category for this expense.',
  
  // System Errors
  SYSTEM_ERROR: '🛠️ We\'re experiencing technical difficulties. Our team has been notified, and we\'re working to fix it.',
  CONNECTION_ERROR: '🔌 We\'re having trouble connecting to your financial institution. Please try again later.',
  SYNC_ERROR: '🔄 We couldn\'t sync your latest transactions. We\'ll try again automatically.',
  DATA_ERROR: '📄 There was an error loading your data. Please refresh the page or try again later.',
  
  // Resource Errors
  NOT_FOUND: '🔍 We couldn\'t find the {resourceName} you\'re looking for.',
  ALREADY_EXISTS: '⚠️ A {resourceName} with this information already exists.',
  DELETE_FAILED: '❌ We couldn\'t delete this {resourceName}. It might be referenced by other items.',
};

// Confirmation Messages
export const CONFIRMATION_MESSAGES = {
  DELETE_EXPENSE: '🗑️ Are you sure you want to delete this expense? This action cannot be undone.',
  DELETE_BUDGET: '⚠️ Are you sure you want to delete this budget category? Any associated expenses will be moved to "Uncategorized".',
  LOGOUT: '👋 Are you sure you want to log out?',
  DISCARD_CHANGES: '❓ You have unsaved changes. Are you sure you want to leave this page?',
  CATEGORY_CHANGE: '📋 Changing this expense category from {oldCategory} to {newCategory} will affect your budget calculations. Would you like to proceed?',
};

// Notification Messages
export const NOTIFICATION_MESSAGES = {
  ACTIVITY_REMINDER: '⏰ It\'s been {days} days since your last update. Take a moment to record any recent expenses to keep your insights accurate.',
  BILL_DUE: '📅 Reminder: Your {billName} bill of ${amount} is due in {days} days.',
  PAYMENT_RECEIVED: '💵 A payment of ${amount} from {source} has been recorded in your account.',
  NEW_INSIGHT: '💡 We\'ve discovered a new insight about your {category} spending. Would you like to see it?',
  BUDGET_REFRESH: '🔄 Your monthly budgets have been refreshed for {month}. Looking forward to a successful financial month!',
};

// Achievement Messages
export const ACHIEVEMENT_MESSAGES = {
  STREAK: '🔥 You\'ve logged expenses for {days} days in a row! Keep up the great habit!',
  BUDGET_STREAK: '🏆 That\'s {count} months in a row you\'ve stayed under your {category} budget! Amazing discipline!',
  EXPENSE_COUNT: '📊 You\'ve tracked {count} expenses! Your financial awareness journey is well underway.',
  SAVINGS_MILESTONE: '💰 Congratulations! You\'ve saved ${amount} since you started using the app.',
  CATEGORY_MASTERY: '🌟 You\'ve become a master at tracking your {category} expenses! You\'ve logged them consistently for {months} months.',
};

// Label constants for accessibility and consistency
export const LABELS = {
  // Form Labels
  AMOUNT: '💲 Amount',
  DESCRIPTION: '📝 Description',
  CATEGORY: '📂 Category',
  DATE: '📅 Date',
  NOTES: '📋 Notes (optional)',
  PAYMENT_METHOD: '💳 Payment Method',
  RECURRING: '🔄 Recurring Expense',
  FREQUENCY: '⏱️ Frequency',
  
  // Button Labels
  SAVE: '💾 Save',
  CANCEL: '❌ Cancel',
  DELETE: '🗑️ Delete',
  EDIT: '✏️ Edit',
  ADD: '➕ Add',
  CLOSE: '✖️ Close',
  CONTINUE: '➡️ Continue',
  BACK: '⬅️ Back',
  CONFIRM: '✅ Confirm',
  
  // Page Titles
  DASHBOARD_TITLE: '📊 Financial Dashboard',
  EXPENSES_TITLE: '💸 Expenses',
  BUDGETS_TITLE: '💰 Budgets',
  INSIGHTS_TITLE: '💡 Financial Insights',
  SETTINGS_TITLE: '⚙️ Settings',
  PROFILE_TITLE: '👤 Your Profile',
  
  // Section Headers
  RECENT_TRANSACTIONS: '🕒 Recent Transactions',
  BUDGET_OVERVIEW: '📈 Budget Overview',
  SPENDING_TRENDS: '📊 Spending Trends',
  TOP_CATEGORIES: '🏆 Top Spending Categories',
  UPCOMING_BILLS: '📅 Upcoming Bills',
}; 