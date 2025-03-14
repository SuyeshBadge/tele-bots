import { User } from '../models/user.model';

export interface IUserRepository {
  findByTelegramId(telegramId: string): Promise<User | null>;
  findByMobileNumber(mobileNumber: string): Promise<User | null>;
  create(userData: Partial<User>): Promise<User>;
  update(user: User): Promise<User>;
  findAll(): Promise<User[]>;
} 