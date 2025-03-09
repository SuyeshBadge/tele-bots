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
    
    return next.handle().pipe(
      map(data => {
        const formattedResponse = {
          data,
          meta: {
            timestamp: new Date().toISOString(),
            status: response.statusCode,
            path: request.url,
          }
        };
        
        this.logger.debug(
          `Response formatted for ${request.method} ${request.url}`,
          { status: response.statusCode, responseSize: JSON.stringify(data).length }
        );
        
        return formattedResponse;
      }),
    );
  }
} 