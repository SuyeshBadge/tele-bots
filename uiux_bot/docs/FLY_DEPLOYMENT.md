# Deploying UI/UX Lesson Bot to Fly.io

This guide provides step-by-step instructions for deploying the UI/UX Lesson Bot to [Fly.io](https://fly.io), a platform for running full-stack apps globally.

## Prerequisites

1. [Install the Fly.io CLI](https://fly.io/docs/hands-on/install-flyctl/)
2. Sign up and authenticate with Fly.io:
   ```bash
   fly auth signup
   # Or if you already have an account:
   fly auth login
   ```

## Deployment Steps

### 1. Set up the Project for Deployment

Ensure you are in the project root directory:

```bash
cd /path/to/bots/uiux_bot
```

### 2. Set Required Secrets

Set up all required API keys and sensitive configuration values:

```bash
# Telegram Bot Token (required)
fly secrets set TELEGRAM_BOT_TOKEN=your_telegram_bot_token

# API Keys for image services (add the ones you'll use)
fly secrets set OPENAI_API_KEY=your_openai_api_key
fly secrets set UNSPLASH_API_KEY=your_unsplash_api_key
fly secrets set PEXELS_API_KEY=your_pexels_api_key

# Other sensitive configuration
fly secrets set ADMIN_USER_ID=your_telegram_user_id
fly secrets set ALLOWED_CHANNELS=channel_id1,channel_id2
```

### 3. Create Persistent Volumes

Create a persistent volume to store the bot's data:

```bash
fly volumes create uiux_bot_data --size 1 --region iad
```

### 4. Deploy the Application

Launch the application:

```bash
fly launch
```

This command will detect the `fly.toml` file and use it for configuration.

Alternatively, deploy to an existing app:

```bash
fly deploy
```

### 5. Verify Deployment

Check that your app is running:

```bash
fly status
```

View the logs to ensure everything is working correctly:

```bash
fly logs
```

### 6. Set Up Webhook (Optional)

For better performance, you might want to set up a webhook for your Telegram bot instead of using polling:

```bash
curl -F "url=https://your-app-name.fly.dev/webhook" https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook
```

## Configuration Options

The `fly.toml` file contains configuration for the deployment:

- **App Name**: Change `app = "uiux-lesson-bot"` to your preferred app name
- **Region**: Modify `primary_region = "iad"` to your preferred region
- **Resources**: Adjust VM size in the `[vm]` section based on your needs
- **Auto-scaling**: Configure in the `[http_service]` section if needed

## Troubleshooting

If you encounter issues:

1. Check the logs: `fly logs`
2. Verify that all required secrets are set: `fly secrets list`
3. Ensure volumes are mounted correctly: `fly volumes list`
4. For more help, visit [Fly.io's documentation](https://fly.io/docs/)

## Maintenance

- **Updating the Bot**: Make changes locally, then run `fly deploy`
- **Scaling Up/Down**: Use `fly scale` commands
- **Monitoring**: Set up [Grafana Cloud metrics](https://fly.io/docs/reference/metrics/)

## Production Considerations

- Add the essential API keys for image services based on your `IMAGE_PREFERENCE` setting
- Consider enabling a monitoring solution for production use
- Regularly check the logs and performance metrics
- Set up automatic backups for your data volume 