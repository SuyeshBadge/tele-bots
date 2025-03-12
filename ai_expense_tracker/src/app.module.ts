import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { DatabaseModule } from './database/database.module';
import { ExpenseModule } from './expense/expense.module';
import { IncomeModule } from './income/income.module';
import { UserModule } from './user/user.module';
import { UpiModule } from './upi/upi.module';
import { TelegramModule } from './telegram/telegram.module';
import { ApiModule } from './api/api.module';
import { AuthModule } from './auth/auth.module';
import { JwtMiddleware } from './auth/middleware/jwt.middleware';
import { JwtService } from '@nestjs/jwt';
import { RequestLoggerMiddleware } from './middleware/request-logger.middleware';
import { MessageModule } from './common/messages/message.module';

@Module({
  imports: [
    // Global configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    
    // Rate limiting
    ThrottlerModule.forRoot({
      ttl: 60,
      limit: 10,
    }),
    
    // Core modules
    DatabaseModule,
    AuthModule,
    MessageModule,
    
    // Domain modules
    ExpenseModule,
    IncomeModule,
    UserModule,
    UpiModule,
    
    // Client modules
    TelegramModule,
    ApiModule,
  ],
  controllers: [
    // ... existing controllers ...
  ],
  providers: [
    JwtService,
  ],
})
export class AppModule implements NestModule {
  constructor(
    private readonly jwtService: JwtService,
  ) {}
  
  configure(consumer: MiddlewareConsumer) {
    // Apply JWT middleware to all API routes
    consumer
      .apply(new JwtMiddleware(this.jwtService).use)
      .forRoutes('api/*');
      
    // Apply request logger middleware to all API routes
    consumer
      .apply(RequestLoggerMiddleware)
      .forRoutes('api/*');
  }
} 