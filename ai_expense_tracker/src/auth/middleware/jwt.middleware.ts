import { Injectable, NestMiddleware } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class JwtMiddleware implements NestMiddleware {
  constructor(
    private readonly jwtService: JwtService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // Let the guard handle unauthorized routes
    }

    const token = authHeader.split(' ')[1];
    
    try {
      const payload = this.jwtService.verify(token);
      
      // Attach user to request object
      req['user'] = {
        userId: payload.sub,
        clientType: payload.clientType,
      };
      
      next();
    } catch (error) {
      // Token is invalid or expired
      // Let the guard handle unauthorized routes
      next();
    }
  }
} 