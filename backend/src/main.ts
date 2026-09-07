import 'dotenv/config';
import helmet from 'helmet';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { AppModule } from './app.module';
import { RealtimeService } from './realtime/realtime.service';
import { resolveUploadDir } from './uploads/upload-dir';

// Serve uploaded post images from the local uploads directory.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const express = require('express');

const logger = new Logger('Bootstrap');

/**
 * Build (but do not listen on) the fully configured Nest application.
 * Used by both the local listener and the serverless handler.
 */
async function createApp(): Promise<NestExpressApplication> {
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

  // Allow the frontend origin(s). Comma-separate multiple origins, or set `*` to allow all.
  // Default includes localhost for dev AND the Vercel frontend domain for production.
  const corsOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
    : ['http://localhost:3000', 'https://connect-social-five.vercel.app'];
  app.enableCors({
    origin: corsOrigins.includes('*') ? true : corsOrigins,
    credentials: true,
  });

  // Run module lifecycle hooks (TypeORM schema sync + demo seeding) before
  // the first request is served.
  await app.init();
  return app;
}

/**
 * Vercel serverless entry point (@vercel/node). Vercel sets VERCEL=1, so this
 * default export is used there instead of the local bootstrap() listener.
 */
let cachedApp: NestExpressApplication | null = null;

export default async function handler(req: Request, res: Response) {
  const app = cachedApp ?? (cachedApp = await createApp());
  const server = app.getHttpAdapter().getInstance();
  return server(req, res);
}

/** Local / self-hosted entry point: bind a real port and start the WS hub. */
async function bootstrap() {
  const app = await createApp();

  const port = Number(process.env.PORT) || 3001;
  await app.listen(port);

  // Attach the realtime WebSocket hub (only meaningful on a long-running
  // server; serverless hosts like Vercel cannot accept WebSocket upgrades).
  try {
    app.get(RealtimeService).init(app.getHttpServer());
  } catch (err) {
    logger.warn(`Realtime hub not started (${(err as Error).message})`);
  }
  console.log(`Backend running on http://localhost:${port}`);
}

if (process.env.VERCEL !== '1') {
  bootstrap().catch((err) => {
    logger.error(`Fatal startup error: ${err?.stack ?? err}`);
    process.exit(1);
  });
}
