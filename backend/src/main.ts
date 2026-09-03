import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import helmet from 'helmet';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { RealtimeService } from './realtime/realtime.service';

// Serve uploaded post images from the local uploads directory.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const express = require('express');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Security headers for the API. CSP is handled by the frontend's
  // next.config.js, since this server only serves JSON and static uploads.
  // crossOriginResourcePolicy must stay permissive: uploaded images are
  // deliberately embedded from this origin into the frontend's pages
  // (Helmet's default `same-origin` makes browsers block those <img> loads).
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  const uploadsDir = path.join(process.cwd(), 'uploads');
  fs.mkdirSync(uploadsDir, { recursive: true });
  app.use('/uploads', express.static(uploadsDir));

  // Allow the frontend origin(s). Comma-separate multiple origins, or set `*` to allow all.
  const corsOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
    : ['http://localhost:3000'];
  app.enableCors({
    origin: corsOrigins.includes('*') ? true : corsOrigins,
    credentials: true,
  });

  const port = Number(process.env.PORT) || 3001;
  await app.listen(port);

  app.get(RealtimeService).init(app.getHttpServer());
  console.log(`Backend running on http://localhost:${port}`);
}

bootstrap();
