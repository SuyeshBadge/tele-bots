export const TELEGRAM_MESSAGES = {
  UNAUTHORIZED: 'Sorry, you are not authorized to use this bot. Please contact the administrator.',
  HELP: '💁‍♂️ How I Can Help You\n\nI make tracking your finances super easy:\n\n• Record your expenses and income\n• Track your spending by category\n• View financial summaries and insights\n• Manage your budget effectively\n\nCommands you can use:\n• /start - Start the bot\n• /help - Show this help message\n• /menu - Show the main menu',
  WELCOME: 'Welcome to AI Expense Tracker! 🤖\n\nI\'ll help you manage your finances effortlessly.',
  EXPENSE_SAVED: '✅ Expense Saved Successfully!\n\nDetails:\n• Description: {description}\n• Amount: ₹{amount}\n• Category: {category}\n\nThank you for recording your expense.',
  INCOME_SAVED: '✅ Income Saved Successfully!\n\nDetails:\n• Source: {description}\n• Amount: ₹{amount}\n\nThank you for recording your income.',
  ERROR: '❌ Something Went Wrong\n\nI encountered an error processing your request.\n\nPlease try again or return to the main menu to restart.',
  INVALID_AMOUNT: 'Please enter a valid amount (e.g., 100 or 99.95):',
  INVALID_INCOME_AMOUNT: 'Please enter a valid amount (e.g., 5000 or 5000.50):',
  OPERATION_CANCELLED: 'Operation cancelled. What would you like to do next?',
  FEATURE_COMING_SOON: 'This feature is coming soon!',
  UNKNOWN_COMMAND: 'I don\'t understand that command. Please use the buttons below:',
  WELCOME_BUTTONS: [
    [{ text: '🚀 Get Started' }]
  ],
  GUIDED_TOUR: 'Let me show you how I can help:\n\n• Record expenses and income\n• Track spending by category\n• View financial summaries\n• Manage your budget',
  GUIDED_TOUR_BUTTONS: [
    [{ text: '💸 Record Expense' }, { text: '💵 Record Income' }],
    [{ text: '📊 View Summary' }, { text: '⚙️ Settings' }]
  ],
  MAIN_MENU: 'What would you like to do?',
  MAIN_MENU_BUTTONS: [
    [{ text: '💸 Record Expense' }, { text: '💵 Record Income' }],
    [{ text: '📊 View Summary' }, { text: '⚙️ Settings' }],
    [{ text: '❓ Help' }]
  ],
  HELP_BUTTONS: [
    [{ text: '🏠 Main Menu' }]
  ],
  SETTINGS_START: 'Settings Menu:\n\n• Manage categories\n• Set currency\n• Configure notifications\n• Export data',
  SETTINGS_BUTTONS: [
    [{ text: '📋 Categories' }, { text: '💲 Currency' }],
    [{ text: '📊 Data Export' }, { text: '🔔 Notifications' }],
    [{ text: '🏠 Main Menu' }]
  ],
  CONVERSATION_CANCELLED: 'Operation cancelled. What would you like to do next?',
  CONVERSATION_CANCELLED_BUTTONS: [
    [{ text: '💸 Record Expense' }, { text: '💵 Record Income' }],
    [{ text: '📊 View Summary' }, { text: '⚙️ Settings' }],
    [{ text: '❓ Help' }]
  ],
  GENERIC_ERROR: 'Sorry, something went wrong. Please try again or use the menu below:',
  GENERIC_ERROR_BUTTONS: [
    [{ text: '🏠 Main Menu' }]
  ],
  RECORD_ANOTHER: 'Would you like to record another {type}?',
  RECORD_ANOTHER_BUTTONS: [
    [{ text: '💸 Record Another Expense' }],
    [{ text: '📊 View Summary' }],
    [{ text: '🏠 Main Menu' }]
  ]
} as const; 