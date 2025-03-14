import { Injectable, UnauthorizedException, Logger, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { OtpService } from '../security/otp.service';
import { TokenBlacklistService } from '../security/token-blacklist.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  
  constructor(
    private readonly jwtService: JwtService,
    private readonly userService: UserService,
    private readonly otpService: OtpService,
    private readonly tokenBlacklistService: TokenBlacklistService,
  ) {}

  async validateUser(userId: string): Promise<any> {
    // This would normally validate a user from the database
    return { userId };
  }

  async login(userId: string, clientType: 'telegram' | 'app' | 'web' | 'mobile') {
    const payload = { 
      sub: userId, 
      clientType,
      iat: Math.floor(Date.now() / 1000), // issued at time
      jti: `${userId}-${Date.now()}`, // JWT ID for revocation
    };
    
    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        userId,
      }
    };
  }
  
  async generateTelegramToken(telegramId: string): Promise<string> {
    // For Telegram Bot users, we generate a special token
    const payload = { 
      sub: telegramId, 
      clientType: 'telegram',
      iat: Math.floor(Date.now() / 1000), // issued at time
      jti: `${telegramId}-${Date.now()}`, // JWT ID for revocation
    };
    
    return this.jwtService.sign(payload);
  }

  async sendOtp(mobileNumber: string, clientIp: string): Promise<{ message: string, expiresIn: number, otp?: string }> {
    try {
      // Generate a secure OTP using our OTP service
      const otpCode = this.otpService.generateOtp();
      const expiresIn = 10; // OTP validity in minutes
      
      // Set OTP expiry time
      const otpExpiry = new Date();
      otpExpiry.setMinutes(otpExpiry.getMinutes() + expiresIn);
      
      // Find user by mobile number or create a new one
      const user = await this.userService.findOrCreateUserByMobile(mobileNumber);
      
      // Update OTP information
      user.otpCode = otpCode;
      user.otpExpiry = otpExpiry;
      await this.userService.updateUserWithOtp(user); // Correctly save the user with OTP
      
      // Log the event with IP for security tracking
      this.logger.log(`OTP generated for mobile: ${mobileNumber} from IP: ${clientIp}`);
      
      // In a real application, you would send the OTP via SMS here
      // For development, we'll just log it
      console.log(`OTP for ${mobileNumber}: ${otpCode}`);
      
      return { 
        message: 'OTP sent successfully', 
        expiresIn,
        // Return OTP in development mode for easier testing
        otp: process.env.NODE_ENV !== 'production' ? otpCode : undefined
      };
    } catch (error) {
      this.logger.error(`Failed to send OTP: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to send OTP: ${error.message}`);
    }
  }

  async verifyOtp(mobileNumber: string, otpCode: string, clientIp: string): Promise<{ accessToken: string, user: any }> {
    // Check if this mobile number + IP combination has exceeded attempts
    const identifier = `${mobileNumber}-${clientIp}`;
    
    if (!this.otpService.registerAttempt(identifier)) {
      this.logger.warn(`OTP verification rate limit exceeded for ${identifier}`);
      throw new UnauthorizedException('Too many failed verification attempts. Please try again later.');
    }
    
    const { isValid, user } = await this.userService.verifyOTP(mobileNumber, otpCode);
    
    if (!isValid || !user) {
      this.logger.warn(`Invalid OTP attempt from ${clientIp} for ${mobileNumber}`);
      throw new UnauthorizedException('Invalid OTP or OTP expired');
    }
    
    // Reset the attempt counter on successful verification
    this.otpService.resetAttempts(identifier);
    
    // Generate JWT token with additional security claims
    const now = Math.floor(Date.now() / 1000);
    const payload = { 
      sub: user.telegramId, 
      clientType: 'mobile',
      mobileNumber: user.mobileNumber,
      iat: now, // issued at time
      jti: `${user.telegramId}-${now}`, // JWT ID for revocation if needed
    };
    
    this.logger.log(`Successful OTP verification for ${mobileNumber} from IP: ${clientIp}`);
    
    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        telegramId: user.telegramId,
        mobileNumber: user.mobileNumber,
        firstName: user.firstName,
        lastName: user.lastName,
        isOnboarded: user.isOnboarded,
      }
    };
  }

  async logout(token: string): Promise<{ message: string }> {
    try {
      if (!token) {
        throw new UnauthorizedException('No token provided');
      }

      // Verify and decode the token
      const decodedToken = this.jwtService.verify(token);
      
      // Get the token's jti (JWT ID) and expiration time
      const jti = decodedToken.jti;
      const exp = decodedToken.exp || Math.floor(Date.now() / 1000) + 3600; // Default 1 hour if no exp
      
      // Add the token to the blacklist
      this.tokenBlacklistService.blacklistToken(jti, exp);
      
      this.logger.log(`User logged out: ${decodedToken.sub}`);
      
      return { message: 'Successfully logged out' };
    } catch (error) {
      this.logger.error(`Logout error: ${error.message}`, error.stack);
      throw new UnauthorizedException('Invalid token');
    }
  }
} 