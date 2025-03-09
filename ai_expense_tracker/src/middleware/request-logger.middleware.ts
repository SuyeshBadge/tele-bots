import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { getLogger } from '../utils/logger';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private logger = getLogger('RequestLogger');

  use(req: Request, res: Response, next: NextFunction): void {
    const { method, originalUrl, ip, headers } = req;
    const userAgent = headers['user-agent'] || 'unknown';
    
    // Log the request
    this.logger.log(`[REQUEST] ${method} ${originalUrl} - IP: ${ip} - User-Agent: ${userAgent}`);
    
    // Get the timestamp to calculate response time
    const start = Date.now();

    // Log response when finished
    res.on('finish', () => {
      const duration = Date.now() - start;
      const { statusCode } = res;
      
      // Log based on status code
      const logMessage = `[RESPONSE] ${method} ${originalUrl} - Status: ${statusCode} - Duration: ${duration}ms`;
      
      if (statusCode >= 500) {
        this.logger.error(logMessage);
      } else if (statusCode >= 400) {
        this.logger.warn(logMessage);
      } else {
        this.logger.log(logMessage);
      }
    });

    next();
  }
} 