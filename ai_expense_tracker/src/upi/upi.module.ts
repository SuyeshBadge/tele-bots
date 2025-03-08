import { Module } from '@nestjs/common';
import { UpiService } from './upi.service';
import { ConfigModule } from '../config/config.module';
import { ExpenseModule } from '../expense/expense.module';

@Module({
  imports: [
    ConfigModule,
    ExpenseModule,
  ],
  providers: [UpiService],
  exports: [UpiService],
})
export class UpiModule {} 