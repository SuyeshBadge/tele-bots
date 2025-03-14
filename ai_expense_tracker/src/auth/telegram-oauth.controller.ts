import { Controller, Get, Query, Req, Res, BadRequestException, Post, Body, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { Public } from '../decorators/public.decorator';
import { createHash, createHmac } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../user/user.service';
import { Response, Request } from 'express';
import { getLogger } from '../utils/logger';

@ApiTags('telegram-oauth')
@Controller('api/auth/telegram')
export class TelegramOAuthController {
  private readonly logger = getLogger(TelegramOAuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly userService: UserService,
  ) {}

  @Public()
  @Get('debug-env')
  @ApiOperation({ summary: 'Debug environment variables (Development only)' })
  @ApiResponse({ status: 200, description: 'Returns environment info for debugging' })
  async debugEnv() {
    // Only allow in development mode
    if (this.configService.get<string>('NODE_ENV') !== 'development') {
      throw new BadRequestException('This endpoint is only available in development mode');
    }
    
    // Get relevant environment variables
    const botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN') || 'not set';
    const botId = this.configService.get<string>('TELEGRAM_BOT_ID') || 'not set';
    const botUsername = this.configService.get<string>('TELEGRAM_BOT_USERNAME') || 'not set';
    const redirectUrl = this.configService.get<string>('TELEGRAM_OAUTH_REDIRECT_URL') || 'not set';
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'not set';
    const apiUrl = this.configService.get<string>('API_URL') || 'not set';
    
    // Extract bot ID from token for comparison
    let extractedBotId = 'not available';
    if (botToken && botToken !== 'not set' && botToken.includes(':')) {
      extractedBotId = botToken.split(':')[0];
    }
    
    return {
      nodeEnv: this.configService.get<string>('NODE_ENV'),
      botTokenAvailable: botToken !== 'not set',
      botTokenLength: botToken !== 'not set' ? botToken.length : 0,
      botId,
      botUsername,
      redirectUrl,
      frontendUrl,
      apiUrl,
      extractedBotId,
      configServiceWorking: true,
      // List of all environment variables (keys only for security)
      envVarKeys: Object.keys(process.env)
    };
  }

  @Public()
  @Get('login')
  @ApiOperation({ summary: 'Redirect to Telegram OAuth' })
  @ApiResponse({ status: 302, description: 'Redirects to Telegram authentication' })
  async login(@Res() res: Response) {
    try {
      // Get the bot token
      const botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
      if (!botToken) {
        throw new BadRequestException('Telegram bot token not configured');
      }
      
      this.logger.log('Bot token available: ' + (botToken ? 'Yes' : 'No'));
      
      // Log all environment variables for debugging
      const env = process.env;
      this.logger.debug('Available environment variables: ' + Object.keys(env).join(', '));
      
      // Check if we have a numeric bot ID configured
      let botId = this.configService.get<string>('TELEGRAM_BOT_ID');
      this.logger.log('TELEGRAM_BOT_ID from config: ' + botId);
      
      // If bot ID is not found, extract it from the token
      if (!botId && botToken) {
        this.logger.log('Extracting bot ID from token...');
        // Extract bot ID from the token (part before the colon)
        const botTokenParts = botToken.split(':');
        if (botTokenParts.length > 1) {
          botId = botTokenParts[0];
          this.logger.log('Extracted bot ID: ' + botId);
        }
      }
      
      if (!botId) {
        this.logger.error('Failed to get bot ID from config or token');
        throw new BadRequestException(
          'Telegram OAuth requires the numeric bot ID. Unable to extract it from bot token. ' +
          'Please restart the server or check your environment configuration.'
        );
      }

      // Get the redirect URL from config or use a default
      const redirectUrl = this.configService.get<string>('TELEGRAM_OAUTH_REDIRECT_URL') || 
        `${this.configService.get<string>('API_URL') || 'http://localhost:3000'}/api/auth/telegram/callback`;
      
      // Generate a random auth state token to prevent CSRF
      const authState = createHash('sha256').update(Math.random().toString()).digest('hex');
      
      // Construct the Telegram Login URL with numeric bot ID
      const telegramOAuthUrl = `https://oauth.telegram.org/auth?bot_id=${botId}&origin=${encodeURIComponent(redirectUrl)}&return_to=${encodeURIComponent(`${redirectUrl}?state=${authState}`)}&request_access=write`;
      
      this.logger.log(`Redirecting to Telegram OAuth: ${telegramOAuthUrl}`);
      return res.redirect(telegramOAuthUrl);
    } catch (error) {
      this.logger.error(`Error in Telegram OAuth login: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Public()
  @Get('callback')
  @ApiOperation({ summary: 'Handle Telegram OAuth callback' })
  @ApiResponse({ status: 200, description: 'Authentication successful' })
  @ApiResponse({ status: 401, description: 'Authentication failed' })
  async callback(
    @Query() query: any,
    @Req() req: Request,
    @Res() res: Response
  ) {
    try {
      this.logger.log(`Received Telegram OAuth callback with data: ${JSON.stringify(query)}`);
      
      // Verify the data from Telegram
      if (!this.validateTelegramAuth(query)) {
        throw new UnauthorizedException('Invalid authentication data');
      }

      const telegramId = query.id.toString();
      const firstName = query.first_name;
      const lastName = query.last_name || '';
      const username = query.username || '';
      const photoUrl = query.photo_url || '';
      
      // Create or get the user
      const user = await this.userService.findOrCreateUser(
        telegramId,
        firstName,
        lastName,
        username
      );
      
      // Generate a token for the user
      const accessToken = await this.authService.generateTelegramToken(telegramId);
      
      // Get the frontend URL from config or use a default
      const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3001';
      
      // Redirect to the frontend with the token
      const redirectUrl = `${frontendUrl}/auth/telegram-success?token=${accessToken}`;
      this.logger.log(`Redirecting to: ${redirectUrl}`);
      
      return res.redirect(redirectUrl);
    } catch (error) {
      // Log the error
      this.logger.error(`Telegram OAuth callback error: ${error.message}`, error.stack);
      
      // Get the frontend URL for error redirect
      const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3001';
      
      // Redirect to an error page
      return res.redirect(`${frontendUrl}/auth/telegram-error?error=${encodeURIComponent(error.message)}`);
    }
  }

  @Public()
  @Post('validate')
  @ApiOperation({ summary: 'Validate Telegram authentication data' })
  @ApiResponse({ status: 200, description: 'Valid authentication data' })
  @ApiResponse({ status: 401, description: 'Invalid authentication data' })
  async validateAuth(@Body() authData: any) {
    if (!this.validateTelegramAuth(authData)) {
      throw new UnauthorizedException('Invalid authentication data');
    }

    const telegramId = authData.id.toString();
    const firstName = authData.first_name;
    const lastName = authData.last_name || '';
    const username = authData.username || '';
    
    // Create or get the user
    const user = await this.userService.findOrCreateUser(
      telegramId,
      firstName,
      lastName,
      username
    );
    
    // Generate a token for the user
    const accessToken = await this.authService.generateTelegramToken(telegramId);
    
    return {
      accessToken,
      user: {
        id: user.id,
        telegramId: user.telegramId,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username
      }
    };
  }

  @Public()
  @Get('direct-login')
  @ApiOperation({ summary: 'Direct login for testing (Development only)' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  async directLogin(@Query('telegramId') telegramId: string, @Res() res: Response) {
    // Only allow in development mode
    if (this.configService.get<string>('NODE_ENV') !== 'development') {
      throw new BadRequestException('This endpoint is only available in development mode');
    }
    
    if (!telegramId) {
      throw new BadRequestException('telegramId query parameter is required');
    }
    
    try {
      this.logger.log(`Direct login attempt for telegramId: ${telegramId}`);
      
      // Find or create a test user
      const user = await this.userService.findOrCreateUser(
        telegramId,
        'Test',
        'User',
        'testuser'
      );
      
      // Generate a token for the user
      const accessToken = await this.authService.generateTelegramToken(telegramId);
      
      // Get the frontend URL from config or use a default
      const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3001';
      
      // Redirect to the frontend with the token
      const redirectUrl = `${frontendUrl}/auth/telegram-success?token=${accessToken}`;
      this.logger.log(`Direct login successful. Redirecting to: ${redirectUrl}`);
      
      return res.redirect(redirectUrl);
    } catch (error) {
      this.logger.error(`Direct login error: ${error.message}`, error.stack);
      
      // Get the frontend URL for error redirect
      const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3001';
      
      // Redirect to an error page
      return res.redirect(`${frontendUrl}/auth/telegram-error?error=${encodeURIComponent(error.message)}`);
    }
  }
  
  @Public()
  @Get('login-instructions')
  @ApiOperation({ summary: 'Show instructions for setting up Telegram OAuth' })
  @ApiResponse({ status: 200, description: 'Returns setup instructions' })
  async loginInstructions() {
    // Extract bot ID from token
    const botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    let botId = this.configService.get<string>('TELEGRAM_BOT_ID');
    
    if (!botId && botToken && botToken.includes(':')) {
      botId = botToken.split(':')[0];
    }
    
    const apiUrl = this.configService.get<string>('API_URL') || 'http://localhost:3000';
    const botUsername = this.configService.get<string>('TELEGRAM_BOT_USERNAME');
    
    return {
      title: 'Telegram OAuth Setup Instructions',
      error: 'Bot domain invalid',
      reason: 'Your domain needs to be verified with BotFather before you can use Telegram OAuth',
      steps: [
        '1. Open Telegram and contact @BotFather',
        '2. Send the /mybots command',
        '3. Select your bot from the list',
        '4. Go to Bot Settings > Domain',
        '5. Add your domain (without https:// or path)',
        '6. Wait for verification to complete'
      ],
      currentSettings: {
        botId,
        apiUrl,
        botUsername,
        domain: new URL(apiUrl).hostname
      },
      alternatives: {
        directLoginUrl: `${apiUrl}/api/auth/telegram/direct-login?telegramId=YOUR_TELEGRAM_ID`,
        ngrokInstructions: 'For local development, use ngrok to get a public URL and register it with BotFather'
      }
    };
  }

  /**
   * Validates Telegram authentication data using the bot token
   * @see https://core.telegram.org/widgets/login#checking-authorization
   */
  private validateTelegramAuth(authData: any): boolean {
    // If no auth data, return false
    if (!authData) return false;

    // Check required fields
    if (!authData.id || !authData.first_name || !authData.hash || !authData.auth_date) {
      return false;
    }

    // Get the bot token
    const botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!botToken) {
      throw new BadRequestException('Telegram bot token not configured');
    }

    // Check if auth_date is not older than 1 day (86400 seconds)
    const authDate = parseInt(authData.auth_date, 10);
    const currentTimestamp = Math.floor(Date.now() / 1000);
    if (currentTimestamp - authDate > 86400) {
      return false;
    }

    // Create a secret key from the bot token
    const secretKey = createHash('sha256').update(botToken).digest();

    // Create a check string from the auth data excluding the hash
    const dataCheckArray: string[] = [];
    Object.keys(authData)
      .sort()
      .forEach(key => {
        if (key !== 'hash') {
          dataCheckArray.push(`${key}=${authData[key]}`);
        }
      });
    const dataCheckString = dataCheckArray.join('\n');

    // Calculate the hash using HMAC-SHA-256
    const calculatedHash = createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    // Compare the calculated hash with the provided hash
    return calculatedHash === authData.hash;
  }
} 