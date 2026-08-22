import { INestApplication, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<INestApplication>(AppModule, {
    cors: true,
  });
  const config = app.get(ConfigService);

  if (config.get('nodeEnv') === 'production') {
    for (const key of ['jwt.accessSecret', 'jwt.refreshSecret', 'database.password']) {
      if (!config.get<string>(key)) {
        throw new Error(`Refusing to start in production: missing ${key}`);
      }
    }
    if ((config.get<string>('jwt.accessSecret') ?? '').length < 32) {
      throw new Error('Refusing to start in production: JWT_ACCESS_SECRET too short (<32 chars)');
    }
  }

  app.use(helmet());

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  app.enableCors({
    origin:
      config.get('cors.origin') === true
        ? true
        : config.get<string[]>('cors.origin'),
    credentials: true,
  });

  if (config.get('nodeEnv') !== 'production') {
    const swagger = new DocumentBuilder()
      .setTitle('CA Sanjay Bajaj & Co. — Platform API')
      .setDescription(
        'Phase 1 (GST): clients, documents, reports, reminders, staff & audit.',
      )
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swagger);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = config.get<number>('port') ?? 3000;
  await app.listen(port);
  Logger.log(`API listening on http://localhost:${port}/api/v1`, 'Bootstrap');
  Logger.log(`Swagger at http://localhost:${port}/api/docs`, 'Bootstrap');
}

void bootstrap();
