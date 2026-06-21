import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import { ZodValidationPipe } from 'nestjs-zod';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  // Setup Winston structured logger (JSON format)
  const logger = WinstonModule.createLogger({
    transports: [
      new winston.transports.Console({
        level: process.env.LOG_LEVEL || 'debug',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.ms(),
          winston.format.json(),
        ),
      }),
    ],
  });

  const app = await NestFactory.create(AppModule, { logger });

  // Pipa Validasi Zod secara Global
  app.useGlobalPipes(new ZodValidationPipe());

  // Global Exception Filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // Prefix global API
  app.setGlobalPrefix('api');

  // Setup Dokumentasi Swagger API
  const config = new DocumentBuilder()
    .setTitle('AI-Powered Multi-Workspace Expense Tracker')
    .setDescription('API Documentation for Financial Expense Tracker System')
    .setVersion('2.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT Access Token',
        in: 'header',
      },
      'JWT-auth', // Nama pengenal keamanan untuk anotasi @ApiBearerAuth('JWT-auth')
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log(`Application running on port ${port}`);
  logger.log(`API Documentation available at http://localhost:${port}/api/docs`);
}
bootstrap();
