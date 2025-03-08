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
import { UserService } from './user/user.service';

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
    
    // Domain modules
    ExpenseModule,
    IncomeModule,
    UserModule,
    UpiModule,
    
    // Client modules
    TelegramModule,
    ApiModule,
  ],
  providers: [JwtService],
})
export class AppModule implements NestModule {
  constructor(
    private readonly jwtService: JwtService,
    private readonly userService: UserService,
  ) {}
  
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(new JwtMiddleware(this.jwtService, this.userService).use)
      .forRoutes('api/*'); // Apply to all API routes
  }
} 