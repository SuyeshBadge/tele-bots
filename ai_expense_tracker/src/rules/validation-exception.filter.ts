import { ExceptionFilter, Catch, ArgumentsHost, BadRequestException } from '@nestjs/common';
import { Response } from 'express';
import { ValidationError } from 'class-validator';
import { getLogger } from '../utils/logger';

@Catch(BadRequestException)
export class ValidationExceptionFilter implements ExceptionFilter {
  private logger = getLogger('ValidationExceptionFilter');

  catch(exception: BadRequestException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();
    const status = exception.getStatus();

    // Get the validation errors
    const exceptionResponse = exception.getResponse() as any;
    let validationErrors = [];

    if (exceptionResponse.message && Array.isArray(exceptionResponse.message)) {
      // Process class-validator errors
      validationErrors = this.formatValidationErrors(exceptionResponse.message);
      this.logger.warn('Validation failed', { path: request.url, errors: validationErrors });
    } else {
      // Other bad request errors
      validationErrors = [{
        message: typeof exceptionResponse.message === 'string' 
          ? exceptionResponse.message 
          : 'Bad Request'
      }];
      this.logger.warn('Bad request error', { 
        path: request.url, 
        message: exceptionResponse.message 
      });
    }

    response.status(status).json({
      error: {
        statusCode: status,
        timestamp: new Date().toISOString(),
        path: request.url,
        validationErrors,
      },
    });
  }

  private formatValidationErrors(errors: ValidationError[]): any[] {
    const formattedErrors = [];
    
    if (Array.isArray(errors)) {
      errors.forEach(error => {
        // Handle nested validation errors
        if (error.children && error.children.length > 0) {
          formattedErrors.push(...this.formatValidationErrors(error.children));
        }
        
        // Process constraint errors
        if (error.constraints) {
          Object.keys(error.constraints).forEach(key => {
            formattedErrors.push({
              field: error.property,
              message: error.constraints[key],
            });
          });
        }
      });
    }
    
    return formattedErrors;
  }
} 