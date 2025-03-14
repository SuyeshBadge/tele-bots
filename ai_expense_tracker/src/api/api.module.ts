import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ExpenseModule } from '../expense/expense.module';
import { IncomeModule } from '../income/income.module';
import { UserModule } from '../user/user.module';
import { UpiModule } from '../upi/upi.module';
import { ExpenseController } from './controllers/expense.controller';
import { IncomeController } from './controllers/income.controller';
import { UserController } from './controllers/user.controller';
import { UpiController } from './controllers/upi.controller';
import { AuthModule } from '../auth/auth.module';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SecurityModule } from '../security/security.module';

@Module({
  imports: [
    AuthModule,
    SecurityModule,
    ExpenseModule,
    IncomeModule,
    UserModule,
    UpiModule,
  ],
  controllers: [
    ExpenseController,
    IncomeController,
    UserController,
    UpiController,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class ApiModule {} 