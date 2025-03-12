import { Injectable, NestInterceptor, ExecutionContext, CallHandler, BadRequestException } from '@nestjs/common';
import { Observable } from 'rxjs';
import { getLogger } from '../utils/logger';

@Injectable()
export class RequestValidationInterceptor implements NestInterceptor {
  private logger = getLogger('RequestValidationInterceptor');
  
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest();
    
    // Get the handler and controller from the context
    const handler = context.getHandler();
    const controller = context.getClass();
    
    // Log request metadata
    this.logger.debug(
      `Validating request for ${request.method} ${request.url}`,
      { 
        controller: controller.name, 
        handler: handler.name,
        contentType: request.headers['content-type']
      }
    );
    
    // Content-Type validation for POST, PUT, PATCH requests
    if (['POST', 'PUT', 'PATCH'].includes(request.method) && 
        request.body && 
        Object.keys(request.body).length > 0) {
      
      const contentType = request.headers['content-type'];
      
      if (!contentType || !contentType.includes('application/json')) {
        const errorMessage = 'Content-Type must be application/json for POST, PUT, and PATCH requests';
        this.logger.warn(errorMessage, { contentType });
        throw new BadRequestException(errorMessage);
      }
    }
    
    // The actual validation is handled by ValidationPipe, this interceptor
    // primarily focuses on logging and additional validations
    
    return next.handle();
  }
} 