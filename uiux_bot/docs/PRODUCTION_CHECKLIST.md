# Production Deployment Checklist

This checklist helps ensure that the UI/UX Lesson Bot is properly configured and ready for production deployment.

## Pre-Deployment Configuration

### Environment Variables
- [ ] `TELEGRAM_BOT_TOKEN` is set with a valid token
- [ ] `OPENAI_API_KEY` is set with a valid API key
- [ ] At least one image service is configured:
  - [ ] `UNSPLASH_API_KEY` for Unsplash image service
  - [ ] `ENABLE_DALLE_IMAGES=True` and appropriate `DALLE_MODEL` for DALL-E image generation
  - [ ] `PEXELS_API_KEY` for Pexels image service
- [ ] `CHANNEL_ID` is set if broadcasting to a channel
- [ ] `ADMIN_USER_IDS` contains comma-separated admin user IDs
- [ ] `REQUEST_TIMEOUT` is set to an appropriate value (30s recommended)
- [ ] `MAX_DAILY_LESSONS` is set to control user rate limits

### Image Settings
- [ ] `IMAGE_PREFERENCE` order is properly configured (e.g., "dalle,unsplash,pexels,local")
- [ ] `SAVE_IMAGES_LOCALLY` is set to True to ensure image availability
- [ ] At least 5-10 fallback images are added to the `images/fallback/` directory

### Server Configuration
- [ ] Server has Python 3.8+ installed
- [ ] Server has appropriate memory (minimum 1GB RAM recommended)
- [ ] Docker is installed if using containerized deployment
- [ ] Storage space is sufficient for image caching

## Deployment Steps

### Fly.io Deployment
1. [ ] Configure `fly.toml` with appropriate app name and region
2. [ ] Set all required secrets with `fly secrets set`
3. [ ] Create persistent volume with `fly volumes create uiux_bot_data --size 1`
4. [ ] Deploy with `fly launch` or `fly deploy`
5. [ ] Check logs with `fly logs` to verify successful startup
6. [ ] Test bot functionality with a few test commands
7. [ ] See `docs/FLY_DEPLOYMENT.md` for detailed instructions

### Docker Deployment (Recommended)
1. [ ] Copy the .env.example file to .env and fill in all values
2. [ ] Navigate to the docker directory
3. [ ] Run `docker-compose up -d` to start the container in detached mode
4. [ ] Check logs with `docker-compose logs -f` to verify successful startup
5. [ ] Test bot functionality with a few test commands

### Manual Deployment
1. [ ] Copy the .env.example file to .env and fill in all values
2. [ ] Create a virtual environment: `python -m venv venv`
3. [ ] Activate the virtual environment
4. [ ] Install requirements: `pip install -r requirements.txt`
5. [ ] Run the bot: `python main.py`
6. [ ] Consider setting up a process manager like supervisor to keep the bot running

## Post-Deployment Verification

### Bot Functionality
- [ ] `/start` command works and subscribes users
- [ ] `/help` command responds with help information
- [ ] `/nextlesson` command delivers a lesson with image
- [ ] `/image` command generates UI/UX themed images
- [ ] Bot responds to messages in a reasonable time
- [ ] Scheduled lessons are being sent

### Error Handling
- [ ] Check logs for any errors or warnings
- [ ] Verify that fallback mechanisms work:
  - [ ] Disable internet connection temporarily to test fallback images
  - [ ] Test with invalid API keys to ensure graceful handling

### Monitoring Setup
- [ ] Set up log monitoring
- [ ] Configure health checks to ping the bot regularly
- [ ] Set up alerts for any critical errors
- [ ] Monitor disk space for image storage

## Regular Maintenance Tasks
- [ ] Regularly review logs for errors
- [ ] Update fallback images periodically
- [ ] Check API key validity
- [ ] Update dependencies when needed
- [ ] Back up subscriber data

## Scaling Considerations
- [ ] Monitor rate limits on image APIs
- [ ] Consider upgrading to higher tier API plans if usage grows
- [ ] Add more fallback images for variety
- [ ] Monitor subscriber growth and adjust server resources accordingly
- [ ] For Fly.io deployments, consider upgrading VM size or enabling auto-scaling

## Cloud Platform Specific Checks

### Fly.io
- [ ] Persistent volumes are properly configured and mounted
- [ ] Health check endpoint is responding correctly
- [ ] Application metrics are being collected
- [ ] Consider setting up automatic backups for volumes 