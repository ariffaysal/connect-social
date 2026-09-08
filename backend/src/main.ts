import 'dotenv/config';
import helmet from 'helmet';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { RealtimeService } from './realtime/realtime.service';
import { resolveUploadDir } from './uploads/upload-dir';

// Serve uploaded post images from the local uploads directory.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const express = require('express');

const logger = new Logger('Bootstrap');

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
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

  const uploadsDir = resolveUploadDir();
  app.use('/uploads', express.static(uploadsDir));

  // Allow the frontend origin(s). Comma-separate multiple origins, or set `*`
  // to allow all. Defaults to the local Next.js dev server.
  const corsOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
    : ['http://localhost:3000', 'http://localhost:3001'];

  app.enableCors({
    origin: corsOrigins.includes('*') ? true : corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  const port = Number(process.env.PORT) || 3001;
  await app.listen(port);

  // Attach the realtime WebSocket hub (long-running local/self-hosted server).
  try {
    app.get(RealtimeService).init(app.getHttpServer());
  } catch (err) {
    logger.warn(`Realtime hub not started (${(err as Error).message})`);
  }
  console.log(`Backend running on http://localhost:${port}`);
}

bootstrap().catch((err) => {
  logger.error(`Fatal startup error: ${err?.stack ?? err}`);
  process.exit(1);
});