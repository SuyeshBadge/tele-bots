import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { PaymentMethod } from './expense.model';

export enum SubscriptionCategory {
  ENTERTAINMENT = 'Entertainment',
  MUSIC = 'Music',
  VIDEO = 'Video',
  NEWS = 'News',
  SOFTWARE = 'Software',
  GAMING = 'Gaming',
  OTHER = 'Other',
}

export enum SubscriptionFrequency {
  MONTHLY = 'Monthly',
  QUARTERLY = 'Quarterly',
  YEARLY = 'Yearly',
  WEEKLY = 'Weekly',
}

@Schema({ timestamps: true })
export class Subscription extends Document {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true, enum: SubscriptionCategory, default: SubscriptionCategory.ENTERTAINMENT })
  category: SubscriptionCategory;

  @Prop({ required: true, enum: SubscriptionFrequency, default: SubscriptionFrequency.MONTHLY })
  frequency: SubscriptionFrequency;

  @Prop({ required: true, enum: PaymentMethod, default: PaymentMethod.UPI })
  paymentMethod: PaymentMethod;

  @Prop({ required: true })
  startDate: Date;

  @Prop()
  endDate: Date;

  @Prop()
  nextBillingDate: Date;

  @Prop({ default: false })
  isShared: boolean;

  @Prop({ type: [String], default: [] })
  sharedWith: string[];

  @Prop()
  reminderDays: number;
}

export const SubscriptionSchema = SchemaFactory.createForClass(Subscription); 