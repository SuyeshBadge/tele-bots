import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { IncomeService } from './income.service';
import { Income, IncomeSchema } from '../models/income.model';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Income.name, schema: IncomeSchema }]),
  ],
  providers: [IncomeService],
  exports: [IncomeService],
})
export class IncomeModule {} 