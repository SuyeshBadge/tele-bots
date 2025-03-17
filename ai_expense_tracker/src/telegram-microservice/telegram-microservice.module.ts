import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { TelegramMicroserviceController } from './telegram-microservice.controller';
import { TelegramMicroserviceService } from './telegram-microservice.service';
import { TelegramGramioService } from './telegram-gramio.service';
import { TelegramMessageService } from './telegram.message.service';
import { ExpenseModule } from '../expense/expense.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MongooseModule.forRoot(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }),
    ExpenseModule,
    UserModule,
  ],
  controllers: [TelegramMicroserviceController],
  providers: [
    TelegramMicroserviceService,
    TelegramGramioService,
    TelegramMessageService,
  ],
})
export class TelegramMicroserviceModule {} 