import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const port = Number(config.getOrThrow<string>('PORT'));
  const frontendOrigin = new URL(config.getOrThrow<string>('APP_URL')).origin;
  const apiPrefix = 'api';

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be a valid TCP port.');
  }

  app.enableCors({
    origin: frontendOrigin,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  app.setGlobalPrefix(apiPrefix);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  await app.listen(port);
  console.log(`====================================================`);
  console.log(` Durozen Technologies - Leave Management System API`);
  console.log(` API listening on port ${port} with prefix /${apiPrefix}`);
  console.log(`====================================================`);
}
bootstrap();
