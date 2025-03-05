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

## License

MIT License 