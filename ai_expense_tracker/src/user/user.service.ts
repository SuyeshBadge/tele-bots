import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../models/user.model';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
  ) {}

  async findOrCreateUser(
    telegramId: string,
    firstName?: string,
    lastName?: string,
    username?: string,
  ): Promise<User> {
    try {
      let user = await this.userModel.findOne({ telegramId }).exec();
      
      if (!user) {
        user = new this.userModel({
          telegramId,
          firstName,
          lastName,
          username,
          lastActive: new Date(),
        });
        
        await user.save();
        this.logger.log(`New user created: ${telegramId}`);
      } else {
        // Update user's last active time
        user.lastActive = new Date();
        if (firstName) user.firstName = firstName;
        if (lastName) user.lastName = lastName;
        if (username) user.username = username;
        
        await user.save();
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
      const user = await this.userModel.findOne({ telegramId }).exec();
      
      if (!user) {
        throw new Error(`User not found: ${telegramId}`);
      }
      
      user.preferences = { ...user.preferences, ...preferences };
      await user.save();
      
      this.logger.log(`User preferences updated: ${telegramId}`);
      return user;
    } catch (error) {
      this.logger.error(`Error updating user preferences: ${error.message}`, error.stack);
      throw error;
    }
  }

  async setOnboardingStatus(telegramId: string, isOnboarded: boolean): Promise<User> {
    try {
      const user = await this.userModel.findOne({ telegramId }).exec();
      
      if (!user) {
        throw new Error(`User not found: ${telegramId}`);
      }
      
      user.isOnboarded = isOnboarded;
      await user.save();
      
      this.logger.log(`User onboarding status updated: ${telegramId} - ${isOnboarded}`);
      return user;
    } catch (error) {
      this.logger.error(`Error updating onboarding status: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getUserById(telegramId: string): Promise<User> {
    try {
      const user = await this.userModel.findOne({ telegramId }).exec();
      
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
      return await this.userModel.find().exec();
    } catch (error) {
      this.logger.error(`Error fetching all users: ${error.message}`, error.stack);
      throw error;
    }
  }
} 