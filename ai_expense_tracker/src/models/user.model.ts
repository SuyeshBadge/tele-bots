import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class User extends Document {
  @Prop({ required: true, unique: true })
  telegramId: string;

  @Prop()
  firstName: string;

  @Prop()
  lastName: string;

  @Prop()
  username: string;

  @Prop({ default: 'en' })
  language: string;

  @Prop({ default: 'INR' })
  currency: string;

  @Prop({ default: Date.now })
  lastActive: Date;

  @Prop({ default: false })
  isOnboarded: boolean;

  @Prop({ type: Object, default: {} })
  preferences: {
    notificationsEnabled?: boolean;
    reminderTime?: string;
    monthlyBudget?: number;
    budgetCategories?: { [key: string]: number };
  };
}

export const UserSchema = SchemaFactory.createForClass(User); 