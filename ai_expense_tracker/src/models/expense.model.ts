import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export enum ExpenseCategory {
  FOOD = 'Food',
  TRANSPORTATION = 'Transportation',
  ENTERTAINMENT = 'Entertainment',
  SHOPPING = 'Shopping',
  UTILITIES = 'Utilities',
  RENT = 'Rent',
  HEALTH = 'Health',
  EDUCATION = 'Education',
  TRAVEL = 'Travel',
  OTHER = 'Other',
}

export enum PaymentMethod {
  UPI = 'UPI',
  CREDIT_CARD = 'Credit Card',
  DEBIT_CARD = 'Debit Card',
  CASH = 'Cash',
  NET_BANKING = 'Net Banking',
  OTHER = 'Other',
}

@Schema({ timestamps: true })
export class Expense extends Document {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true, enum: ExpenseCategory, default: ExpenseCategory.OTHER })
  category: ExpenseCategory;

  @Prop({ required: true, enum: PaymentMethod, default: PaymentMethod.UPI })
  paymentMethod: PaymentMethod;

  @Prop()
  description: string;

  @Prop({ default: Date.now })
  date: Date;

  @Prop({ default: false })
  isRecurring: boolean;

  @Prop()
  recurringFrequency: string;

  @Prop()
  upiId: string;

  @Prop()
  merchantName: string;
}

export const ExpenseSchema = SchemaFactory.createForClass(Expense); 