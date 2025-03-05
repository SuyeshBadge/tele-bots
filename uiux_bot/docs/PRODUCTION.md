# Production Deployment Guide

This guide covers deploying the UI/UX Lesson Bot in a production environment using Docker.

## Prerequisites

- A server with Docker and Docker Compose installed
- A Telegram Bot Token (from [@BotFather](https://t.me/BotFather))
- An OpenAI API key
- An Unsplash API key

## Deployment Steps

### 1. Clone the Repository

```bash
git clone <repository-url>
cd <repository-directory>/bots/uiux_bot
```

### 2. Configure Environment Variables

```bash
cp .env.example .env
nano .env
```

Fill in all required environment variables:

```
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
OPENAI_API_KEY=your_openai_api_key
UNSPLASH_API_KEY=your_unsplash_api_key
ADMIN_USER_IDS=your_telegram_user_id
```

Optional variables:
```
CHANNEL_ID=your_channel_id  # For broadcasting to a channel
OPENAI_MODEL=gpt-4  # Default model to use
LOG_LEVEL=INFO  # Logging level
REQUEST_TIMEOUT=30  # API request timeout in seconds
```

### 3. Deploy with Docker Compose

```bash
cd docker
docker-compose up -d
```

This will:
- Build the Docker image
- Create necessary volumes for data persistence
- Start the bot in detached mode

### 4. Verify Deployment

Check if the container is running:

```bash
docker-compose ps
```

View logs:

```bash
docker-compose logs -f
```

### 5. Health Monitoring

The bot includes built-in health checks. You can:

1. Use the `/health` command in the bot
2. Check the Docker health status:
   ```bash
   docker inspect --format='{{.State.Health.Status}}' uiux-lesson-bot
   ```

### 6. Backup and Restore

#### Backup

To backup subscriber data:

```bash
docker cp uiux-lesson-bot:/app/data/subscribers.json ./backup_subscribers.json
```

#### Restore

To restore from backup:

```bash
docker cp ./backup_subscribers.json uiux-lesson-bot:/app/data/subscribers.json
```

### 7. Updating the Bot

To update to a new version:

```bash
# Pull latest code
git pull

# Rebuild and restart
cd docker
docker-compose down
docker-compose up -d --build
```

## Troubleshooting

### Common Issues

1. **Bot not responding**:
   - Check logs: `docker-compose logs -f`
   - Verify the bot token is correct
   - Ensure the container is running: `docker-compose ps`

2. **API errors**:
   - Verify API keys are correct
   - Check for rate limiting issues in the logs
   - Increase `REQUEST_TIMEOUT` if needed

3. **Data persistence issues**:
   - Check volume mounting: `docker volume ls`
   - Verify permissions: `docker exec -it uiux-lesson-bot ls -la /app/data`

### Getting Support

If you encounter issues not covered here, please:
1. Check the full logs for error messages
2. Review the [documentation](README.md)
3. Open an issue on the repository with detailed information about the problem

## Security Considerations

- Store API keys securely and never commit them to version control
- Regularly update the Docker image to get security patches
- Limit admin access to trusted users only
- Consider using Docker secrets for production deployments

## Performance Optimization

For high-traffic deployments:
- Increase container resources in docker-compose.yml
- Consider using a reverse proxy like Nginx
- Monitor memory usage and adjust as needed 