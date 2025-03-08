# UI/UX Lessons Telegram Bot

A TypeScript Telegram bot that sends UI/UX lessons twice daily, with quizzes and image generation capabilities. This is the TypeScript implementation of the original Python UI/UX bot.

## 🚀 Features

- **Scheduled Lessons**: Sends lessons at configured times (default: 10:00 AM and 6:00 PM IST)
- **Interactive Quizzes**: Tests user knowledge with quizzes related to the lessons
- **Custom Image Generation**: Creates custom images to illustrate UI/UX concepts
- **User Progress Tracking**: Monitors user engagement and progress
- **Admin Dashboard**: Special commands for administrators
- **Persistent Data Storage**: Uses Supabase for data persistence

## 📋 Requirements

- Node.js ≥ 18.0.0
- npm
- Supabase account
- Telegram Bot Token (from BotFather)
- OpenAI API Key (optional, for image generation)

## 🔧 Setup and Installation

### Local Development Setup

1. **Clone the repository**:
   ```bash
   git clone [repository-url]
   cd uiux_bot_ts
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Create environment variables**:
   ```bash
   cp .env.example .env
   ```
   
4. **Configure your environment variables**:
   Edit the `.env` file and fill in the required values:
   ```
   TELEGRAM_TOKEN=your_telegram_bot_token
   ADMIN_USER_IDS=comma,separated,user,ids
   SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_KEY=your_supabase_service_key
   OPENAI_API_KEY=your_openai_api_key (optional)
   ```

5. **Build the application**:
   ```bash
   npm run build
   ```

6. **Run the application**:
   ```bash
   npm start
   ```

### Development with Hot Reload

```bash
npm run dev
```

### Running Tests

```bash
npm test
```

## 🐳 Docker Setup

### Building and Running with Docker

1. **Build the Docker image**:
   ```bash
   docker build -t uiux-bot-ts .
   ```

2. **Run the container**:
   ```bash
   docker run -d --name uiux-bot-ts \
     -v $(pwd)/data:/app/data \
     -v $(pwd)/logs:/app/logs \
     -v $(pwd)/images:/app/images:ro \
     --env-file .env \
     uiux-bot-ts
   ```

### Using Docker Compose

1. **Start the services**:
   ```bash
   docker-compose up -d
   ```

2. **View logs**:
   ```bash
   docker-compose logs -f
   ```

3. **Stop the services**:
   ```bash
   docker-compose down
   ```

## 🌎 Production Deployment

### Production Startup Script

For production environments, use the included startup script:

```bash
chmod +x prod-start.sh
./prod-start.sh
```

This script:
- Performs pre-flight checks
- Ensures all dependencies are installed
- Builds the application if needed
- Validates environment variables
- Starts the bot in production mode

### Deployment to Fly.io

The bot is fully configured for deployment on Fly.io with the following features:
- HTTP health checks
- Persistent volumes for data and logs
- Zero-downtime deployments
- Resource scaling

#### Quick Deployment Using the Script

The simplest way to deploy is using the included script:

```bash
chmod +x deploy-to-fly.sh
./deploy-to-fly.sh
```

This script will:
1. Check for Fly CLI installation
2. Verify you're logged in
3. Create the app if it doesn't exist
4. Create persistent volumes
5. Set environment variables from your .env file
6. Deploy the application

#### Manual Deployment Steps

If you prefer to deploy manually, follow these steps:

1. **Install the Fly CLI**:
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. **Login to Fly**:
   ```bash
   fly auth login
   ```

3. **Create the application**:
   ```bash
   fly launch --no-deploy --copy-config --name uiux-bot-ts
   ```

4. **Create volumes for persistence**:
   ```bash
   fly volumes create data --size 1
   fly volumes create logs --size 1
   ```

5. **Set secrets (environment variables)**:
   ```bash
   fly secrets set TELEGRAM_BOT_TOKEN=your_token
   fly secrets set SUPABASE_URL=your_url
   fly secrets set SUPABASE_KEY=your_key
   # Add all other required variables
   ```

6. **Deploy**:
   ```bash
   fly deploy
   ```

7. **Monitor the deployment**:
   ```bash
   fly status
   fly logs
   ```

#### Using Fly.io Dashboard

You can also manage your application through the Fly.io dashboard:

1. Go to [https://fly.io/dashboard](https://fly.io/dashboard)
2. Select your app
3. Monitor metrics, logs, and deployment status
4. Scale resources as needed

#### Scaling Your Application

To scale your application on Fly.io:

```bash
# Scale to 2 instances
fly scale count 2

# Scale memory
fly scale memory 1024

# Scale CPU
fly scale vm shared-cpu-1x
```

## 🔬 Monitoring and Maintenance

### Health Checks

Run health checks to verify the bot is functioning correctly:

```bash
npm run health-check
```

### Logs

Logs are stored in the `logs` directory and contain detailed information about bot operations. In production, logs are also available through Docker:

```bash
docker logs -f uiux-bot-ts
```

### Updating the Bot

1. **Pull the latest changes**:
   ```bash
   git pull
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Rebuild the application**:
   ```bash
   npm run build
   ```

4. **Restart the bot**:
   ```bash
   # If running with Docker
   docker-compose down
   docker-compose up -d
   
   # If running locally
   ./prod-start.sh
   ```

## 📝 Project Structure

```
uiux_bot_ts/
├── src/                   # Source code
│   ├── app/               # Application code
│   │   ├── api/           # API integrations
│   │   ├── bot/           # Bot logic
│   │   ├── config/        # Configuration
│   │   ├── design-system/ # Design system components
│   │   ├── gamification/  # Gamification features
│   │   ├── static/        # Static assets
│   │   ├── trend-analyzer/ # Trend analysis
│   │   ├── utils/         # Utility functions
│   │   ├── ux-research/   # UX research components
│   │   └── vision/        # Vision and image generation
│   ├── data/              # Data files
│   ├── database/          # Database related code
│   ├── docs/              # Documentation
│   ├── images/            # Image assets
│   ├── scripts/           # Utility scripts
│   └── tests/             # Test files
├── dist/                  # Compiled JavaScript
├── logs/                  # Log files
├── .env.example           # Example environment variables
├── .gitignore             # Git ignore file
├── Dockerfile             # Docker configuration
├── docker-compose.yml     # Docker Compose configuration
├── jest.config.js         # Jest configuration
├── nodemon.json           # Nodemon configuration
├── package.json           # Dependencies and scripts
├── package-lock.json      # Lock file for dependencies
├── prod-start.sh          # Production startup script
├── README.md              # This file
├── run_bot.sh             # Bot execution script
├── start.sh               # Startup script
└── tsconfig.json          # TypeScript configuration
```

## 🔐 Security Considerations

1. **Environment Variables**: Never commit sensitive information to version control.
2. **Regular Updates**: Keep dependencies updated to address security vulnerabilities.
3. **Input Validation**: All user input is validated to prevent injection attacks.
4. **Principle of Least Privilege**: The Docker container runs as a non-root user.
5. **API Rate Limiting**: Implemented to prevent abuse.

## 🔨 Development Guidelines

1. **TypeScript**: Always use proper TypeScript types to ensure code reliability.
2. **Testing**: Write tests for new features.
3. **Documentation**: Update documentation when adding or changing features.
4. **Commits**: Use descriptive commit messages following conventional commits format.
5. **Code Style**: Follow the project's code style guidelines.

## 📄 License

This project is licensed under the ISC License.

## 🙏 Acknowledgements

This project is based on the original Python implementation of the UI/UX Bot and uses various open source libraries. 