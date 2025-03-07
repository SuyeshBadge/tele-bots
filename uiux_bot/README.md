# UI/UX Lesson Telegram Bot

![Docker Enabled](https://img.shields.io/badge/Docker-Enabled-blue)
![Production Ready](https://img.shields.io/badge/Status-Production%20Ready-green)

An educational Telegram bot that sends UI/UX design lessons twice daily and includes interactive quizzes to test knowledge retention.

## Documentation

- [Full Documentation](docs/README.md)
- [Production Deployment Guide](docs/PRODUCTION.md)

## Quick Start

```bash
# Clone the repository
git clone <repository-url>
cd <repository-directory>/bots/uiux_bot

# Copy and edit environment file
cp .env.example .env
nano .env  # Add your API keys and configuration

# Start with Docker Compose
cd docker
docker-compose up -d
```

## Docker Deployment

The bot is fully containerized and ready for production deployment:

```bash
# Build and start the container
cd bots/uiux_bot/docker
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the container
docker-compose down
```

### Persistent Data

The bot uses Docker volumes to ensure data persistence:
- Subscriber data is stored in the `uiux_bot_data` volume
- Images are stored in the `images` directory

### Environment Variables

All configuration is done through environment variables. See `.env.example` for required variables:

- `TELEGRAM_BOT_TOKEN`: Your Telegram bot token (required)
- `OPENAI_API_KEY`: Your OpenAI API key (required)
- `UNSPLASH_API_KEY`: Your Unsplash API key (optional but recommended)
- `PEXELS_API_KEY`: Your Pexels API key (optional)
- `CHANNEL_ID`: Optional channel ID for broadcasting lessons
- `ADMIN_USER_IDS`: Comma-separated list of admin user IDs
- `LOG_LEVEL`: Logging level (default: INFO)
- `REQUEST_TIMEOUT`: API request timeout in seconds (default: 30)

### Image Generation Settings

The bot supports multiple image sources with configurable preferences:

- `ENABLE_DALLE_IMAGES`: Set to True to enable DALL-E image generation
- `DALLE_MODEL`: Choose between 'dall-e-2' or 'dall-e-3'
- `IMAGE_PREFERENCE`: Comma-separated order of image sources to try (e.g., "dalle,unsplash,pexels,local")
- `SAVE_IMAGES_LOCALLY`: Save online images locally for future use (recommended for production)

## Project Structure

```
uiux_bot/
├── app/                    # Application code
│   ├── bot/                # Telegram bot functionality
│   ├── api/                # API integrations (OpenAI, Unsplash)
│   ├── utils/              # Utility functions
│   └── config/             # Configuration management
├── docker/                 # Docker configuration
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── docker-entrypoint.sh
├── docs/                   # Documentation
│   ├── README.md           # Full documentation
│   └── PRODUCTION.md       # Production deployment guide
├── tests/                  # Test suite
├── images/                 # Image resources
│   └── fallback/           # Fallback images
├── .env.example            # Example environment variables
├── main.py                 # Main entry point
└── README.md               # This file
```

## Features

- **Scheduled Lessons**: Automatically sends UI/UX lessons at 10:00 and 18:00 IST
- **Interactive Quizzes**: Tests user knowledge with interactive quizzes
- **Multi-Source Image Generation**: Combines multiple image sources for the most relevant visuals:
  - OpenAI DALL-E: Generates custom UI/UX themed images
  - Unsplash API: Fetches relevant stock photos
  - Pexels API: Provides additional professional imagery
  - Local Fallback: Uses pre-saved images when online sources are unavailable
- **Image Command**: Users can request UI/UX themed images on demand with `/image <theme>`
- **Admin Commands**: Special commands for bot administrators
- **Health Monitoring**: Built-in health checks and status reporting
- **Persistent Storage**: All subscriber data and images stored persistently
- **Supabase Integration**: Supports cloud-based data storage

## Development Mode

This project includes a hot reload functionality that automatically restarts the application when code changes are detected. This is particularly useful during development to quickly test changes without manually restarting the bot.

### Using Hot Reload

There are two ways to use the hot reload functionality:

#### 1. Using the dev.py script:

```bash
python dev.py
```

This script automatically ensures all required dependencies are installed and starts the application with hot reload enabled.

#### 2. Using the --dev flag:

```bash
python main.py --dev
```

This starts the main application with hot reload enabled.

### How It Works

The hot reload system:

1. Monitors all Python files in the project directory and subdirectories
2. When a file change is detected, it gracefully stops the current application
3. Automatically restarts the application with the updated code
4. Uses a cooldown period to prevent rapid restarts when multiple files are saved

### Prerequisites

Hot reload requires the watchdog package, which can be installed using:

```bash
pip install watchdog
```

This dependency is included in the requirements.txt file.

## Setup

1. Clone the repository
2. Install dependencies:
   ```
   pip install -r requirements.txt
   ```
3. Create a `.env` file with the following variables:
   ```
   TELEGRAM_BOT_TOKEN=your_bot_token
   OPENAI_API_KEY=your_openai_api_key
   OPENAI_MODEL=gpt-3.5-turbo
   ADMIN_USER_IDS=123456789,987654321
   ENABLE_ADMIN_COMMANDS=True
   AUTO_ADMIN_SUBSCRIBERS=True
   TIMEZONE=Asia/Kolkata
   UNSPLASH_API_KEY=your_unsplash_api_key (optional)
   CHANNEL_ID=your_channel_id (optional, for channel mode)
   ENABLE_SUPABASE=True (optional, for Supabase integration)
   SUPABASE_URL=your_supabase_url (required if ENABLE_SUPABASE=True)
   SUPABASE_KEY=your_supabase_key (required if ENABLE_SUPABASE=True)
   ```
4. Run the bot:
   ```
   python main.py
   ```
   
## Supabase Integration

The bot supports Supabase integration for cloud-based data storage. This allows for:

- Storing subscriber information
- Tracking user history and preferences
- Monitoring bot health status
- Caching lesson content

### Setting Up Supabase

1. Create a Supabase account and project at [supabase.com](https://supabase.com)
2. Get your Supabase URL and API key from the project settings
3. Set the following environment variables in your `.env` file:
   ```
   ENABLE_SUPABASE=True
   SUPABASE_URL=your_supabase_url
   SUPABASE_KEY=your_supabase_key
   ```
4. Create the required tables in Supabase by running the SQL script in `database/simple_schema.sql`

### Thread-Safe Implementation

The Supabase integration is implemented in a thread-safe manner to avoid event loop conflicts. This is achieved through:

1. **Thread-Safe Client**: The Supabase client is initialized with a thread lock to prevent multiple threads from initializing it simultaneously.
2. **Decorator Pattern**: A `threadsafe_supabase_operation` decorator is used to make all Supabase operations thread-safe.
3. **Fallback Mechanism**: If a Supabase operation fails, the system gracefully falls back to file-based storage.
4. **Error Handling**: Comprehensive error handling and logging are implemented to track and diagnose issues.

### Testing Supabase Integration

You can test the Supabase integration by running:
```
python test_supabase.py
```

This script tests all Supabase operations, including:
- Subscriber management
- User history tracking
- Health status monitoring
- Lesson caching
- Thread safety

## Commands

- `/start` - Subscribe to lessons
- `/stop` - Unsubscribe from lessons
- `/help` - Show help message
- `/nextlesson` - Request an immediate lesson
- `/health` - Check bot health status

### Admin Commands

- `/broadcast` - Broadcast a message to all subscribers
- `/stats` - Show bot statistics
- `/subscribers` - Show subscriber count
- `/theme` - Request a lesson on a specific theme

## Architecture

The bot is built with a modular architecture:

- `app/bot/` - Bot handlers and scheduler
- `app/api/` - OpenAI and Unsplash API clients
- `app/utils/` - Utility functions for persistence, database, etc.
- `app/config/` - Configuration settings
- `database/` - Database scripts and utilities

## License

This project is licensed under the MIT License - see the LICENSE file for details. 