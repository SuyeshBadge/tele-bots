import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { TokenBlacklistService } from '../../security/token-blacklist.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private tokenBlacklistService: TokenBlacklistService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET'),
      issuer: 'expense-tracker-api',
      audience: 'expense-tracker-clients',
    });
  }

  async validate(payload: any) {
    // Check if token is blacklisted
    if (payload.jti && this.tokenBlacklistService.isBlacklisted(payload.jti)) {
      throw new UnauthorizedException('Token has been revoked');
    }

    // Return the payload to be attached to the request
    return {
      userId: payload.sub,
      clientType: payload.clientType,
      mobileNumber: payload.mobileNumber,
      jti: payload.jti,
    };
  }
} 