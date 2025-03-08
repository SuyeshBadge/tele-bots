import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ExpenseService } from './expense.service';
import { Expense, ExpenseSchema } from '../models/expense.model';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Expense.name, schema: ExpenseSchema }]),
  ],
  providers: [ExpenseService],
  exports: [ExpenseService],
})
export class ExpenseModule {} 