import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export enum IncomeCategory {
  SALARY = 'Salary',
  FREELANCE = 'Freelance',
  BUSINESS = 'Business',
  INVESTMENT = 'Investment',
  GIFT = 'Gift',
  REFUND = 'Refund',
  OTHER = 'Other',
}

@Schema({ timestamps: true })
export class Income extends Document {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true, enum: IncomeCategory, default: IncomeCategory.SALARY })
  category: IncomeCategory;

  @Prop()
  description: string;

  @Prop({ default: Date.now })
  date: Date;

  @Prop({ default: false })
  isRecurring: boolean;

  @Prop()
  recurringFrequency: string;

  @Prop()
  source: string;
}

export const IncomeSchema = SchemaFactory.createForClass(Income); 