import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { ResponseFormatInterceptor } from './interceptors/response-format.interceptor';
import { RequestValidationInterceptor } from './interceptors/request-validation.interceptor';
import { ValidationExceptionFilter } from './filters/validation-exception.filter';
import { getLogger } from './utils/logger';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

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

  // Setup Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('AI Expense Tracker API')
    .setDescription('The API documentation for AI Expense Tracker application')
    .setVersion('1.0')
    .addTag('auth', 'Authentication endpoints')
    .addTag('expense', 'Expense management endpoints')
    .addTag('user', 'User profile management endpoints')
    .addBearerAuth(
      { 
        type: 'http', 
        scheme: 'bearer', 
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Enter JWT token',
        in: 'header'
      },
      'JWT-auth', // This is a reference ID used for security definition
    )
    .build();
  
  // Use 'as any' to bypass TypeScript type checking for the Swagger integration
  // This is needed due to version incompatibilities between dependencies
  const document = SwaggerModule.createDocument(app as any, config);
  SwaggerModule.setup('api/docs', app as any, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    }
  });
  
  // Get port from config
  const configService = app.get(ConfigService);
  const port = configService.get('PORT') || 3000;
  
  await app.listen(port);
  logger.log(`AI Expense Tracker API server started on port ${port}`);
  logger.log(`Swagger documentation available at http://localhost:${port}/api/docs`);
}
bootstrap(); 