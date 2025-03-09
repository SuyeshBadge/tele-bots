/**
 * Centralized messages for Telegram Bot interactions
 *
 * These messages are designed to guide users through simple flows with minimal
 * technical details or commands. The focus is on button-driven navigation
 * and clear, friendly instructions.
 */

export const TELEGRAM_MESSAGES = {
  // Welcome and Onboarding Messages
  WELCOME: `🎉 *Welcome to your Personal Finance Assistant!*

I'm here to help you track expenses, manage your budget, and improve your financial health - all through simple conversations!

*What would you like to do?*`,

  WELCOME_BUTTONS: [
    ['💸 Record Expense', '💵 Record Income'],
    ['📊 View Summary', '⚙️ Settings']
  ],

  HELP: `💁‍♂️ *How I Can Help You*

I'm designed to make tracking your finances super easy. Here's what I can do:

• Record your expenses and income
• Track your spending by category
• Alert you when you're approaching budget limits
• Provide helpful financial summaries

*What would you like to help with today?*`,

  HELP_BUTTONS: [
    ['💸 Record Expense', '💵 Record Income'],
    ['📊 View Summary', '⚙️ Settings']
  ],

  // Authentication and Authorization
  UNAUTHORIZED: `🔒 *Let's get you set up first!*

Tap the button below to create your account and start tracking your finances.`,

  UNAUTHORIZED_BUTTONS: [['🚀 Get Started']],

  TOKEN_SUCCESS: `🔑 *Your account is connected!*

You can now use the mobile or web app with the same account.

*What would you like to do next?*`,

  TOKEN_SUCCESS_BUTTONS: [
    ['💸 Record Expense', '📊 View Summary'],
    ['⬅️ Back to Main Menu']
  ],

  TOKEN_ERROR: `❌ *There was a small hiccup connecting your account*

Let's try again! Tap the button below.`,

  TOKEN_ERROR_BUTTONS: [['🔄 Try Again'], ['⬅️ Back to Main Menu']],

  // Main Menu
  MAIN_MENU: `🏠 *Main Menu*

What would you like to do today?`,

  MAIN_MENU_BUTTONS: [
    ['💸 Record Expense', '💵 Record Income'],
    ['📊 View Summary', '⚙️ Settings'],
    ['💳 Quick UPI Payment', '❓ Help']
  ],

  // Expense Tracking
  EXPENSE_START: `💸 *Let's record your expense*

Please enter the amount you spent:`,

  EXPENSE_AMOUNT_INVALID: `❌ *That doesn't look like a valid amount*

Please enter a number (like 250.50):`,

  EXPENSE_AMOUNT_CONFIRM: `✅ *Amount: {amount}*

Now, what category does this expense belong to?`,

  EXPENSE_CATEGORY_BUTTONS: [
    ['🍔 Food', '🚗 Transport'],
    ['🏠 Rent', '🛒 Shopping'],
    ['📱 Utilities', '🎬 Entertainment'],
    ['💊 Healthcare', '📚 Education'],
    ['⬅️ Cancel']
  ],

  EXPENSE_CATEGORY_INVALID: `❌ *Please select a category from the buttons below*`,

  EXPENSE_CATEGORY_CONFIRM: `✅ *Category: {category}*

How did you pay for this?`,

  EXPENSE_PAYMENT_BUTTONS: [
    ['💳 Credit Card', '🏦 Debit Card'],
    ['📱 UPI', '💵 Cash'],
    ['🏦 Net Banking', '⬅️ Back']
  ],

  EXPENSE_PAYMENT_INVALID: `❌ *Please select a payment method from the buttons below*`,

  EXPENSE_PAYMENT_CONFIRM: `✅ *Payment Method: {method}*

*Optional:* Add a quick description (or tap "Skip"):`,

  EXPENSE_PAYMENT_CONFIRM_BUTTONS: [['⏩ Skip']],

  EXPENSE_SUCCESS: `🎉 *Expense Recorded Successfully!*

*Amount:* {amount}
*Category:* {category}
*Payment:* {method}
*Description:* {description}

Your {category} budget is now {percentage}% used this month.

*What would you like to do next?*`,

  EXPENSE_SUCCESS_BUTTONS: [
    ['➕ Record Another', '📊 View Summary'],
    ['🏠 Back to Main Menu']
  ],
  
  // Income Tracking
  INCOME_START: `💵 *Let's record your income*

Please enter the amount:`,

  INCOME_AMOUNT_INVALID: `❌ *That doesn't look like a valid amount*

Please enter a number (like 25000):`,

  INCOME_AMOUNT_CONFIRM: `✅ *Amount: {amount}*

What type of income is this?`,

  INCOME_CATEGORY_BUTTONS: [
    ['💼 Salary', '💰 Freelance'],
    ['🏦 Investment', '🎁 Gift'],
    ['⬅️ Cancel']
  ],

  INCOME_CATEGORY_INVALID: `❌ *Please select a category from the buttons below*`,

  INCOME_CATEGORY_CONFIRM: `✅ *Category: {category}*

*Optional:* Add a quick description (or tap "Skip"):`,

  INCOME_CATEGORY_CONFIRM_BUTTONS: [['⏩ Skip']],

  INCOME_SUCCESS: `🎉 *Income Recorded Successfully!*

*Amount:* {amount}
*Category:* {category}
*Description:* {description}

Your total income this month is now {totalIncome}.

*What would you like to do next?*`,

  INCOME_SUCCESS_BUTTONS: [
    ['➕ Record Another', '📊 View Summary'],
    ['🏠 Back to Main Menu']
  ],

  // UPI Transactions
  UPI_START: `💳 *Quick UPI Payment*

Please enter the amount:`,

  UPI_AMOUNT_INVALID: `❌ *That doesn't look like a valid amount*

Please enter a number (like 499):`,

  UPI_AMOUNT_CONFIRM: `✅ *Amount: {amount}*

Who did you pay? (merchant or person name)`,

  UPI_MERCHANT_INVALID: `❌ *Please enter who you paid*

Examples: "Amazon", "Local Grocery", "Rahul"`,

  UPI_MERCHANT_CONFIRM: `✅ *Paid to: {merchant}*

Processing your payment record...`,

  UPI_SUCCESS: `🎉 *UPI Payment Recorded!*

*Amount:* {amount}
*Paid to:* {merchant}
*Date:* {date}
*Category:* {category} (best guess)

*What would you like to do next?*`,

  UPI_SUCCESS_BUTTONS: [
    ['➕ Record Another', '📊 View Summary'],
    ['🏠 Back to Main Menu']
  ],

  // Summary and Reports
  SUMMARY_START: `📊 *Generating your summary...*`,

  SUMMARY_RESULT: `📊 *Your Financial Summary*
*Month:* {month} {year}

💸 *Total Expenses:* {totalExpenses}
💵 *Total Income:* {totalIncome}
💰 *Net Savings:* {netSavings}

*Top Spending Categories:*
{categories}

*What would you like to do next?*`,

  SUMMARY_RESULT_BUTTONS: [
    ['📅 Change Month', '📈 Detailed Report'],
    ['💸 Record Expense', '🏠 Main Menu']
  ],

  // Settings
  SETTINGS_START: `⚙️ *Settings*

What would you like to set up?`,

  SETTINGS_BUTTONS: [
    ['💰 Monthly Budget', '⏰ Reminder Time'],
    ['🔔 Notifications', '👤 Profile'],
    ['🏠 Back to Main Menu']
  ],

  SETTINGS_INVALID_OPTION: `❌ *Please select an option from the buttons below*`,

  SETTINGS_BUDGET_START: `💰 *Set Monthly Budget*

Enter your total budget amount for the month:`,

  SETTINGS_BUDGET_INVALID: `❌ *That doesn't look like a valid amount*

Please enter a number (like 30000):`,

  SETTINGS_BUDGET_SUCCESS: `✅ *Monthly budget set to {amount}*

Would you like to set budgets for specific categories?`,

  SETTINGS_BUDGET_SUCCESS_BUTTONS: [
    ['✅ Yes, Set Categories', '⏩ Skip for Now'],
    ['🏠 Back to Main Menu']
  ],

  SETTINGS_REMINDER_START: `⏰ *Set Reminder Time*  
Enter time in *HH:MM* (24-hour format).`,

  SETTINGS_REMINDER_INVALID: `❌ *Please enter a valid time in *HH:MM* format.*`,

  SETTINGS_REMINDER_SUCCESS: `✅ *Reminder time set to {time}.*`,

  SETTINGS_NOTIFICATIONS_START: `🔔 *Notification Preferences*  

1️⃣ Daily Reminders: {dailyReminders}  
2️⃣ Weekly Summary: {weeklySummary}  
3️⃣ Budget Alerts: {budgetAlerts}  

Reply with a number (1-3) to toggle or type *done* to finish.`,
  
  SETTINGS_NOTIFICATIONS_SUCCESS: `✅ *Notification preferences updated.*`,

  // Error Messages
  GENERIC_ERROR: `❌ *Oops! Something went wrong.*

Let's try something else. What would you like to do?`,

  GENERIC_ERROR_BUTTONS: [
    ['🏠 Main Menu', '❓ Help'],
    ['🔄 Try Again']
  ],

  CONVERSATION_CANCELLED: `🚫 *Action cancelled.*

What would you like to do instead?`,

  CONVERSATION_CANCELLED_BUTTONS: [
    ['💸 Record Expense', '💵 Record Income'],
    ['📊 View Summary', '🏠 Main Menu']
  ],

  UNKNOWN_COMMAND: `❓ *I'm not sure what you mean.*

To make things easier, you can use the buttons below or choose from the main menu:`,

  UNKNOWN_COMMAND_BUTTONS: [
    ['💸 Record Expense', '💵 Record Income'],
    ['📊 View Summary', '⚙️ Settings'],
    ['🏠 Main Menu']
  ],

  // Quick Action Prompts
  QUICK_ACTION_PROMPT: `⚡ *Quick Actions*

Did you just make a purchase? Would you like to record it now?`,

  QUICK_ACTION_BUTTONS: [
    ['💸 Record Expense', '⏱️ Remind Me Later'],
    ['🏠 Main Menu']
  ],

  // Reminders
  DAILY_REMINDER: `⏰ *Daily Check-in*

It's a good time to update your finances! Have you recorded all your expenses today?`,

  DAILY_REMINDER_BUTTONS: [
    ['💸 Record Now', '✅ All Updated'],
    ['⏱️ Remind Me Later']
  ],

  WEEKLY_SUMMARY_REMINDER: `📊 *Your Weekly Summary is Ready!*

Would you like to see how your finances are doing this week?`,

  WEEKLY_SUMMARY_BUTTONS: [
    ['👀 View Summary', '⏱️ Later'],
    ['🏠 Main Menu']
  ],

  BUDGET_ALERT: `⚠️ *Budget Alert*

You've used {percentage}% of your {category} budget with {daysLeft} days left in the month.

Would you like to see where your money is going?`,

  BUDGET_ALERT_BUTTONS: [
    ['👀 View Details', '👍 Thanks'],
    ['💰 Adjust Budget']
  ],

  // Guidance Messages
  GUIDED_TOUR: `🚀 *Let me show you around!*

I'm designed to make finance tracking simple. Here's a quick tour of what I can do:

1️⃣ *Record expenses* with just a few taps
2️⃣ *Track income* from various sources
3️⃣ *Set budgets* and get alerts when you're close to limits
4️⃣ *View summaries* of your financial health

Ready to get started?`,

  GUIDED_TOUR_BUTTONS: [
    ['✅ Yes, Let\'s Go!', '⏩ Skip Tour'],
    ['❓ Ask a Question']
  ],

  GUIDED_NEXT_STEP: `✨ *Suggested Next Steps*

Based on your activity, you might want to:`,

  GUIDED_NEXT_STEP_BUTTONS: [
    ['💰 Set Monthly Budget', '📊 View Your Summary'],
    ['💸 Record Recent Expense', '🏠 Main Menu']
  ]
};
