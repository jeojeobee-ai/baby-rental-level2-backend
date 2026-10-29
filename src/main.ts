import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Vercel에 올린 프론트엔드 주소만 허용합니다. 여러 개면 쉼표로 구분합니다.
  const origins = (process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({ origin: origins });
  app.enableShutdownHooks();

  // Render는 PORT 환경변수로 포트를 알려 줍니다.
  await app.listen(Number(process.env.PORT ?? 4000), '0.0.0.0');
}

bootstrap();
