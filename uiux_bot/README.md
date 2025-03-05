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
- `UNSPLASH_API_KEY`: Your Unsplash API key (required)
- `CHANNEL_ID`: Optional channel ID for broadcasting lessons
- `ADMIN_USER_IDS`: Comma-separated list of admin user IDs
- `LOG_LEVEL`: Logging level (default: INFO)
- `REQUEST_TIMEOUT`: API request timeout in seconds (default: 30)

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
- **Custom Images**: Generates relevant images for each lesson using Unsplash API
- **Admin Commands**: Special commands for bot administrators
- **Health Monitoring**: Built-in health checks and status reporting
- **Persistent Storage**: All subscriber data is stored persistently

## License

MIT License 