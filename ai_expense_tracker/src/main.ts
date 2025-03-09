import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { ResponseFormatInterceptor } from './interceptors/response-format.interceptor';
import { RequestValidationInterceptor } from './interceptors/request-validation.interceptor';
import { ValidationExceptionFilter } from './filters/validation-exception.filter';
import { getLogger } from './utils/logger';

async function bootstrap() {
  const logger = getLogger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  
  // Enable security headers with Helmet
  app.use(helmet());
  
  // Apply global interceptors
  app.useGlobalInterceptors(
    new ResponseFormatInterceptor(),
    new RequestValidationInterceptor()
  );
  
  // Apply global filters
  app.useGlobalFilters(new ValidationExceptionFilter());
  
  // Enable validation
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, // Strip properties not in DTO
    forbidNonWhitelisted: true, // Throw error if non-whitelisted properties are present
    transform: true, // Transform payloads to DTO instances
    transformOptions: {
      enableImplicitConversion: true, // Convert primitive types
    },
    validationError: {
      target: false, // Don't expose the target object
      value: false, // Don't expose the validated value
    },
  }));
  
  // Enable CORS
  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') || '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });
  
  // Get port from config
  const configService = app.get(ConfigService);
  const port = configService.get('PORT') || 3000;
  
  await app.listen(port);
  logger.log(`AI Expense Tracker API server started on port ${port}`);
}
bootstrap(); 