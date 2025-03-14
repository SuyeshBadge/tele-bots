# AI Expense Tracker

An AI-powered expense tracking application with a Telegram bot interface and REST API.

## Features

- Mobile OTP authentication
- Swagger API documentation
- JWT-based authentication
- Secure API endpoints with rate limiting and security headers
- MongoDB integration
- AI-powered expense categorization

## Setup

### Prerequisites

- Node.js (v16 or higher)
- MongoDB instance
- Telegram Bot token (for Telegram bot functionality)

### Installation

1. Clone the repository
2. Install dependencies

```bash
npm install
```

3. Copy the example environment file and configure it

```bash
cp .env.example .env
```

4. Edit the `.env` file with your configuration values

### Environment Variables

```
# Application
PORT=3000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/ai-expense-tracker

# JWT
JWT_SECRET=your-jwt-secret-key
JWT_EXPIRATION=3600

# OTP
OTP_EXPIRATION=600  # in seconds (10 minutes)

# Telegram Bot
TELEGRAM_BOT_TOKEN=your-telegram-bot-token

# OpenAI (for expense categorization)
OPENAI_API_KEY=your-openai-api-key
```

### Running the Application

Development mode with hot-reload:

```bash
npm run start:dev
```

Production mode:

```bash
npm run build
npm run start:prod
```

## API Documentation

The application features comprehensive API documentation using Swagger UI:

1. Start the application
2. Visit `http://localhost:3000/api/docs` in your browser
3. Explore the available API endpoints

### Authentication Flow

1. Request an OTP to be sent to your mobile number using the `/api/auth/mobile/send-otp` endpoint
2. Verify the OTP using the `/api/auth/mobile/verify-otp` endpoint
3. Use the received JWT token for subsequent authenticated API calls by clicking the "Authorize" button in Swagger UI
4. Include the token in the Authorization header with the format: `Bearer <your-token>`

## Features in Detail

### OTP Authentication

The application implements a secure OTP-based authentication system:

- OTPs are time-limited (configurable)
- Rate limiting is applied to prevent brute force attacks
- In development mode, OTPs are returned in the response for testing purposes

### Swagger Documentation

The API documentation is generated automatically using NestJS Swagger:

- All endpoints, request bodies, and response models are documented
- Interactive API testing
- Authentication integration
- Download API specification in OpenAPI format

### Security Features

- JWT token authentication
- Rate limiting for sensitive endpoints
- Helmet security headers
- CSRF protection
- Validation of all input data

## Telegram Bot Integration

The application includes a Telegram bot for expense tracking:

1. Start a chat with your bot (using the token you configured)
2. Send expenses in natural language format
3. The AI will categorize and store your expenses
4. Use commands to get reports and insights

## Development

### Code Structure

- `src/auth` - Authentication-related code
- `src/users` - User management
- `src/expenses` - Expense tracking
- `src/telegram` - Telegram bot implementation
- `src/common` - Shared utilities, interceptors, and middleware

### Testing

Run tests:

```bash
npm test
```

Run tests with coverage:

```bash
npm run test:cov
```

## License

This project is licensed under the MIT License - see the LICENSE file for details. 