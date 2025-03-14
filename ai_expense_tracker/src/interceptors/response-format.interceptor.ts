import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { getLogger } from '../utils/logger';

export interface Response<T> {
  data: T;
  meta: {
    timestamp: string;
    status: number;
    path: string;
  };
}

@Injectable()
export class ResponseFormatInterceptor<T> implements NestInterceptor<T, Response<T>> {
  private logger = getLogger('ResponseInterceptor');
  
  intercept(context: ExecutionContext, next: CallHandler): Observable<Response<T>> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest();
    const response = ctx.getResponse();
    
    // Skip formatting for redirects
    if (request.url.includes('/api/auth/telegram/login') || 
        request.url.includes('/api/auth/telegram/callback')) {
      this.logger.debug(`Skipping response formatting for redirect at ${request.url}`);
      return next.handle();
    }
    
    return next.handle().pipe(
      map(data => {
        // Skip formatting if data is undefined or null
        if (data === undefined || data === null) {
          return data;
        }
        
        const formattedResponse = {
          data,
          meta: {
            timestamp: new Date().toISOString(),
            status: response.statusCode,
            path: request.url,
          }
        };
        
        // Add a null check before accessing data.length
        const responseSize = data ? (typeof JSON.stringify(data) === 'string' ? 
          JSON.stringify(data).length : 'unknown') : 0;
        
        this.logger.debug(
          `Response formatted for ${request.method} ${request.url}`,
          { status: response.statusCode, responseSize }
        );
        
        return formattedResponse;
      }),
    );
  }
} 