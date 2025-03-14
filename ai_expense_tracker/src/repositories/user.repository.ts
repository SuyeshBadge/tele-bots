import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../models/user.model';
import { IUserRepository } from './user.repository.interface';

@Injectable()
export class UserRepository implements IUserRepository {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
  ) {}

  async findByTelegramId(telegramId: string): Promise<User | null> {
    return this.userModel.findOne({ telegramId }).exec();
  }

  async findByMobileNumber(mobileNumber: string): Promise<User | null> {
    return this.userModel.findOne({ mobileNumber }).exec();
  }

  async create(userData: Partial<User>): Promise<User> {
    const newUser = new this.userModel(userData);
    return newUser.save();
  }

  async update(user: User): Promise<User> {
    return user.save();
  }

  async findAll(): Promise<User[]> {
    return this.userModel.find().exec();
  }
} 