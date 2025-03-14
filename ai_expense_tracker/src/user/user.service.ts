import { Injectable, Logger } from '@nestjs/common';
import { User } from '../models/user.model';
import { UserRepository } from '../repositories/user.repository';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private readonly userRepository: UserRepository,
  ) {}

  async findOrCreateUser(
    telegramId: string,
    firstName?: string,
    lastName?: string,
    username?: string,
  ): Promise<User> {
    try {
      let user = await this.userRepository.findByTelegramId(telegramId);
      
      if (!user) {
        user = await this.userRepository.create({
          telegramId,
          firstName,
          lastName,
          username,
          lastActive: new Date(),
        });
        
        this.logger.log(`New user created: ${telegramId}`);
      } else {
        // Update user's last active time
        user.lastActive = new Date();
        if (firstName) user.firstName = firstName;
        if (lastName) user.lastName = lastName;
        if (username) user.username = username;
        
        await this.userRepository.update(user);
      }
      
      return user;
    } catch (error) {
      this.logger.error(`Error finding or creating user: ${error.message}`, error.stack);
      throw error;
    }
  }

  async updateUserPreferences(
    telegramId: string,
    preferences: {
      notificationsEnabled?: boolean;
      reminderTime?: string;
      monthlyBudget?: number;
      budgetCategories?: { [key: string]: number };
    },
  ): Promise<User> {
    try {
      const user = await this.userRepository.findByTelegramId(telegramId);
      
      if (!user) {
        throw new Error(`User not found: ${telegramId}`);
      }
      
      user.preferences = { ...user.preferences, ...preferences };
      await this.userRepository.update(user);
      
      this.logger.log(`User preferences updated: ${telegramId}`);
      return user;
    } catch (error) {
      this.logger.error(`Error updating user preferences: ${error.message}`, error.stack);
      throw error;
    }
  }

  async setOnboardingStatus(telegramId: string, isOnboarded: boolean): Promise<User> {
    try {
      const user = await this.userRepository.findByTelegramId(telegramId);
      
      if (!user) {
        throw new Error(`User not found: ${telegramId}`);
      }
      
      user.isOnboarded = isOnboarded;
      await this.userRepository.update(user);
      
      this.logger.log(`User onboarding status updated: ${telegramId} - ${isOnboarded}`);
      return user;
    } catch (error) {
      this.logger.error(`Error updating onboarding status: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getUserById(telegramId: string): Promise<User> {
    try {
      const user = await this.userRepository.findByTelegramId(telegramId);
      
      if (!user) {
        throw new Error(`User not found: ${telegramId}`);
      }
      
      return user;
    } catch (error) {
      this.logger.error(`Error fetching user: ${error.message}`, error.stack);
      throw error;
    }
  }
  
  async getAllUsers(): Promise<User[]> {
    try {
      return await this.userRepository.findAll();
    } catch (error) {
      this.logger.error(`Error fetching all users: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findOrCreateUserByMobile(mobileNumber: string): Promise<User> {
    try {
      let user = await this.userRepository.findByMobileNumber(mobileNumber);
      
      if (!user) {
        user = await this.userRepository.create({
          telegramId: `m_${Date.now()}`, // Generate a unique telegramId for mobile users
          mobileNumber,
          lastActive: new Date(),
        });
        
        this.logger.log(`New user created with mobile: ${mobileNumber}`);
      } else {
        // Update user's last active time
        user.lastActive = new Date();
        await this.userRepository.update(user);
      }
      
      return user;
    } catch (error) {
      this.logger.error(`Error finding or creating user by mobile: ${error.message}`, error.stack);
      throw error;
    }
  }

  async generateOTP(mobileNumber: string): Promise<{ otpCode: string, expiresIn: number }> {
    try {
      // Generate a 6-digit OTP
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresIn = 10; // OTP validity in minutes
      
      // Set OTP expiry time
      const otpExpiry = new Date();
      otpExpiry.setMinutes(otpExpiry.getMinutes() + expiresIn);
      
      // Find user by mobile number or create a new one
      const user = await this.findOrCreateUserByMobile(mobileNumber);
      
      // Update OTP information
      user.otpCode = otpCode;
      user.otpExpiry = otpExpiry;
      await this.userRepository.update(user);
      
      this.logger.log(`OTP generated for mobile: ${mobileNumber}`);
      
      return { otpCode, expiresIn };
    } catch (error) {
      this.logger.error(`Error generating OTP: ${error.message}`, error.stack);
      throw error;
    }
  }

  async verifyOTP(mobileNumber: string, otpCode: string): Promise<{ isValid: boolean, user: User | null }> {
    try {
      const user = await this.userRepository.findByMobileNumber(mobileNumber);
      
      if (!user) {
        return { isValid: false, user: null };
      }
      
      const isValid = user.otpCode === otpCode && new Date() < user.otpExpiry;
      
      if (isValid) {
        // Mark mobile as verified
        user.mobileVerified = true;
        
        // Clear OTP data after successful verification
        user.otpCode = null;
        user.otpExpiry = null;
        
        await this.userRepository.update(user);
        this.logger.log(`OTP verified for mobile: ${mobileNumber}`);
      }
      
      return { isValid, user };
    } catch (error) {
      this.logger.error(`Error verifying OTP: ${error.message}`, error.stack);
      throw error;
    }
  }

  async updateUserWithOtp(user: User): Promise<User> {
    try {
      const result = await this.userRepository.update(user);
      this.logger.log(`Updated user with OTP: ${user.mobileNumber}`);
      return result;
    } catch (error) {
      this.logger.error(`Error updating user with OTP: ${error.message}`, error.stack);
      throw error;
    }
  }
} 