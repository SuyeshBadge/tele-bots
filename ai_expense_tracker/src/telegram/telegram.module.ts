import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { ConfigModule } from '@nestjs/config';
import { ExpenseModule } from '../expense/expense.module';
import { IncomeModule } from '../income/income.module';
import { UserModule } from '../user/user.module';
import { UpiModule } from '../upi/upi.module';
import { AuthModule } from '../auth/auth.module';
import { TelegramMessageService } from './telegram.message.service';
import { MessageModule } from '../common/messages/message.module';

@Module({
  imports: [
    ConfigModule,
    ExpenseModule,
    IncomeModule,
    UserModule,
    UpiModule,
    AuthModule,
    MessageModule,
  ],
  providers: [TelegramService, TelegramMessageService],
  exports: [TelegramService],
})
export class TelegramModule {} 