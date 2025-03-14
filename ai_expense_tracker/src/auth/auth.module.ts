import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule } from '@nestjs/config';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AuthController } from './auth.controller';
import { TelegramOAuthController } from './telegram-oauth.controller';
import { UserModule } from '../user/user.module';
import { SecurityModule } from '../security/security.module';
import { JwtConfigService } from '../security/jwt-config.service';

@Module({
  imports: [
    PassportModule,
    UserModule,
    SecurityModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useClass: JwtConfigService,
    }),
  ],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
  controllers: [AuthController, TelegramOAuthController],
})
export class AuthModule {} 