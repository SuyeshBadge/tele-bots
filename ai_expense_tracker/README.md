# AI-Powered Expense Tracker Bot

A Telegram bot that helps Indian users (18-30 years old) track their income, UPI expenses, credit card usage, and shared subscriptions with minimal input—just a tap or voice command.

## Features

- **Income Tracking**: Automated salary detection with simple confirmation
- **AI-Powered Expense Logging**: Automatically suggests based on prior spending patterns
- **UPI Transaction Tracking**: Automatically categorizes UPI transactions based on merchant name
- **Credit Card Tracking**: Differentiates between Credit, UPI, and Cash transactions
- **Subscription Tracking**: Detects and monitors recurring payments
- **Monthly Expense Summary & Budgeting**: Generates detailed insights on income vs. spending trends

## Tech Stack

- **Backend**: Node.js with NestJS
- **Database**: MongoDB
- **AI Services**: OpenAI (Optimized for Cost Efficiency)
- **Integrations**: Telegram Bot API, UPI APIs (Razorpay, Juspay, Paytm)

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- MongoDB
- Telegram Bot Token (from BotFather)
- OpenAI API Key

### Installation

1. Clone the repository
```bash
git clone https://github.com/yourusername/ai-expense-tracker.git
cd ai-expense-tracker
```

2. Install dependencies
```bash
npm install
```

3. Create a `.env` file in the root directory with the following variables:
```
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
MONGODB_URI=your_mongodb_uri
OPENAI_API_KEY=your_openai_api_key
```

4. Start the application
```bash
npm run start:dev
```

## Available Commands

- `/start` - Show welcome message
- `/help` - Show help message
- `/income` - Log a new income
- `/expense` - Log a new expense
- `/upi` - Log a UPI transaction
- `/summary` - Get your monthly expense summary
- `/settings` - Configure your preferences

## Development Roadmap

### Phase 1 (MVP)
- [x] Project Setup
- [x] Telegram Bot Core Development
- [x] Basic Income & Expense Logging
- [x] User Management & Settings
- [x] UPI-Based Transaction Tracking

### Phase 2
- [ ] Credit Card & Subscription Tracking
- [ ] Gamification Features (Spending Streaks, Challenges, Insights)

### Phase 3
- [ ] AI-Powered Smart Budgeting & Financial Insights

## License

This project is licensed under the MIT License - see the LICENSE file for details. 