import { NestFactory } from '@nestjs/core';
import { Transport } from '@nestjs/microservices';
import { TelegramMicroserviceModule } from './telegram-microservice.module';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('TelegramMicroservice');
  
  const app = await NestFactory.createMicroservice(TelegramMicroserviceModule, {
    transport: Transport.TCP,
    options: {
      host: '0.0.0.0',
      port: 3001, // Port for the microservice
    },
  });

  const configService = app.get(ConfigService);
  
  // Enable logging
  app.useLogger(logger);
  
  // Start the microservice
  await app.listen();
  
  logger.log('Telegram microservice is listening on port 3001');
}

bootstrap(); 