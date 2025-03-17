import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ExpenseModule } from './expense/expense.module';
import { IncomeModule } from './income/income.module';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { UpiModule } from './upi/upi.module';
import { MessageModule } from './common/messages/message.module';
import { MicroservicesController } from './microservices/microservices.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MongooseModule.forRoot(process.env.MONGODB_URI),
    ExpenseModule,
    IncomeModule,
    UserModule,
    AuthModule,
    UpiModule,
    MessageModule,
  ],
  controllers: [MicroservicesController],
})
export class AppModule {} 