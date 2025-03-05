# UI/UX Lesson Bot Documentation

This documentation provides a comprehensive guide to the UI/UX Lesson Telegram Bot, including its features, architecture, and usage.

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Architecture](#architecture)
4. [Configuration](#configuration)
5. [Commands](#commands)
6. [Scheduler](#scheduler)
7. [API Integrations](#api-integrations)
8. [Data Storage](#data-storage)
9. [Docker Deployment](#docker-deployment)
10. [Development Guide](#development-guide)

## Overview

The UI/UX Lesson Bot is a Telegram bot designed to deliver educational content about UI/UX design principles. It sends lessons twice daily (10:00 and 18:00 IST), includes interactive quizzes, and uses AI-generated content with relevant images.

## Features

- **Scheduled Lessons**: Automatically sends UI/UX lessons at configured times
- **Interactive Quizzes**: Tests user knowledge with interactive quizzes
- **Custom Images**: Generates relevant images for each lesson using Unsplash API
- **Admin Commands**: Special commands for bot administrators
- **Health Monitoring**: Built-in health checks and status reporting
- **Persistent Storage**: All subscriber data is stored persistently
- **Docker Support**: Fully containerized for easy deployment

## Architecture

The bot follows a modular architecture:

```
app/
├── bot/                # Telegram bot functionality
│   ├── bot.py          # Main bot class
│   ├── handlers.py     # Command handlers
│   ├── scheduler.py    # Lesson scheduling
│   └── utils.py        # Bot-specific utilities
├── api/                # API integrations
│   ├── openai.py       # OpenAI API client
│   └── unsplash.py     # Unsplash API client
├── utils/              # Utility functions
│   ├── config.py       # Configuration management
│   ├── logger.py       # Logging setup
│   └── health.py       # Health monitoring
└── config/             # Configuration management
    └── settings.py     # Settings loader
```

## Configuration

The bot is configured using environment variables:

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| TELEGRAM_BOT_TOKEN | Telegram Bot API token | Yes | - |
| OPENAI_API_KEY | OpenAI API key | Yes | - |
| UNSPLASH_API_KEY | Unsplash API key | Yes | - |
| OPENAI_MODEL | OpenAI model to use | No | gpt-4 |
| CHANNEL_ID | Channel ID for broadcasting | No | - |
| ADMIN_USER_IDS | Admin user IDs (comma-separated) | No | - |
| LOG_LEVEL | Logging level | No | INFO |
| REQUEST_TIMEOUT | API request timeout (seconds) | No | 30 |

## Commands

The bot supports the following commands:

| Command | Description | Access |
|---------|-------------|--------|
| /start | Subscribe to lessons | All users |
| /stop | Unsubscribe from lessons | All users |
| /help | Show help information | All users |
| /nextlesson | Request the next lesson | All users |
| /health | Check bot health status | All users |
| /stats | Show subscriber statistics | Admins only |
| /broadcast | Send a message to all subscribers | Admins only |

## Scheduler

The scheduler module (`app/bot/scheduler.py`) manages the automatic sending of lessons:

- Lessons are sent at 10:00 and 18:00 IST by default
- Subscriber data is saved every 30 minutes
- Health status is updated every 5 minutes

## API Integrations

### OpenAI API

The bot uses OpenAI's API to:
- Generate UI/UX lesson content
- Create interactive quizzes
- Provide responses to user questions

### Unsplash API

The Unsplash API is used to:
- Find relevant images for each lesson
- Provide visual context for UI/UX concepts

## Data Storage

The bot stores data in JSON files:

- `subscribers.json`: List of subscribed users
- `health.json`: Bot health status information
- `lessons.json`: Lesson tracking information

All data is stored in the `/app/data` directory, which is mounted as a Docker volume for persistence.

## Docker Deployment

See the [Production Deployment Guide](PRODUCTION.md) for detailed instructions on deploying the bot using Docker.

## Development Guide

### Prerequisites

- Python 3.9+
- Poetry (for dependency management)
- Telegram Bot Token
- OpenAI API Key
- Unsplash API Key

### Setup for Development

```bash
# Clone the repository
git clone <repository-url>
cd <repository-directory>/bots/uiux_bot

# Install dependencies
poetry install

# Set up environment variables
cp .env.example .env
# Edit .env with your API keys

# Run the bot
poetry run python main.py
```

### Adding New Features

1. **New Commands**: Add handlers in `app/bot/handlers.py`
2. **API Integrations**: Add new API clients in `app/api/`
3. **Scheduled Tasks**: Modify `app/bot/scheduler.py`

### Testing

Run tests with:

```bash
poetry run pytest
```

### Code Style

The project follows PEP 8 style guidelines. Run linting with:

```bash
poetry run flake8
```

## License

MIT License

## Acknowledgments

- [python-telegram-bot](https://github.com/python-telegram-bot/python-telegram-bot)
- [OpenAI API](https://platform.openai.com/)
- [Unsplash API](https://unsplash.com/developers)
- [APScheduler](https://github.com/agronholm/apscheduler)
- [Docker](https://www.docker.com/) 