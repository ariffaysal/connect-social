import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import request from 'supertest';
import WebSocket from 'ws';
import { describe, beforeAll, afterAll, it, expect } from '@jest/globals';
import { AppModule } from '../src/app.module';
import { User } from '../src/users/entities/user.entity';
import { Notification } from '../src/notifications/entities/notification.entity';
import { Role } from '../src/auth/roles.enum';
import { RealtimeService } from '../src/realtime/realtime.service';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function createApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  return app;
}

/** Mint a token directly (no login request) so non-auth tests never consume the login quota. */
function mint(app: INestApplication, userId: number, username: string, role: Role): string {
  const jwt = app.get(JwtService);
  return jwt.sign({ username, sub: userId, role }, { expiresIn: '1h' });
}

describe('Auth: login success/failure + plaintext upgrade', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    app = await createApp();
    dataSource = app.get(DataSource);
  });
  afterAll(async () => {
    await app.close();
  });

  it('logs in with seeded bcrypt credentials', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'user', password: 'password' });
    expect(res.status).toBe(201);
    expect(res.body.access_token).toBeTruthy();
    expect(res.body.role).toBe(Role.RegularUser);
  });

  it('rejects a wrong password', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'user', password: 'wrong-password' });
    expect(res.status).toBe(401);
  });

  it('rejects an unknown username', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'ghost', password: 'password' });
    expect(res.status).toBe(401);
  });

  it('upgrades a legacy plaintext password to bcrypt on next successful login', async () => {
    // Simulate a pre-bcrypt account by writing a plaintext password straight to the DB.
    await dataSource.getRepository(User).insert({
      username: 'legacy-user',
      password: 'legacy123',
      role: Role.RegularUser,
    });

    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'legacy-user', password: 'legacy123' });
    expect(res.status).toBe(201);

    const stored = await dataSource.getRepository(User).findOne({
      where: { username: 'legacy-user' },
    });
    expect(stored?.password).toMatch(/^\$2[aby]\$\d{2}\$/);
    expect(stored?.password).not.toBe('legacy123');
  });
});

describe('Authorization: role guards + private reads', () => {
  let app: INestApplication;
  let admin: string;
  let user: string;
  let guest: string;

  beforeAll(async () => {
    app = await createApp();
    admin = mint(app, 1, 'admin', Role.SuperAdmin);
    user = mint(app, 3, 'user', Role.RegularUser);
    guest = mint(app, 4, 'guest', Role.Guest);
  });
  afterAll(async () => {
    await app.close();
  });

  it('enforces SuperAdmin-only user management', async () => {
    const allowed = await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${admin}`);
    expect(allowed.status).toBe(200);

    const denied = await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${user}`);
    expect(denied.status).toBe(403);
  });

  it('keeps admin monitoring endpoints SuperAdmin-only', async () => {
    const denied = await request(app.getHttpServer())
      .get('/monitoring/overview')
      .set('Authorization', `Bearer ${user}`);
    expect(denied.status).toBe(403);

    const allowed = await request(app.getHttpServer())
      .get('/monitoring/overview')
      .set('Authorization', `Bearer ${admin}`);
    expect(allowed.status).toBe(200);
  });

  it('exposes the leaderboard to every authenticated user', async () => {
    const res = await request(app.getHttpServer())
      .get('/monitoring/top-users')
      .set('Authorization', `Bearer ${user}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('prevents Guest accounts from posting', async () => {
    const res = await request(app.getHttpServer())
      .post('/posts')
      .set('Authorization', `Bearer ${guest}`)
      .send({ title: 'guest post', content: 'should fail' });
    expect(res.status).toBe(403);
  });

  it('closes anonymous reads (401) on posts and comments', async () => {
    const anonList = await request(app.getHttpServer()).get('/posts');
    expect(anonList.status).toBe(401);

    const anonOne = await request(app.getHttpServer()).get('/posts/1');
    expect(anonOne.status).toBe(401);

    const anonComments = await request(app.getHttpServer()).get('/posts/1/comments');
    expect(anonComments.status).toBe(401);
  });

  it('lets authenticated users (incl. Guest) read posts read-only', async () => {
    const created = await request(app.getHttpServer())
      .post('/posts')
      .set('Authorization', `Bearer ${user}`)
      .send({ title: 'Guard test post', content: 'read me' });
    expect(created.status).toBe(201);
    const id = created.body.id;

    const list = await request(app.getHttpServer())
      .get('/posts')
      .set('Authorization', `Bearer ${guest}`);
    expect(list.status).toBe(200);

    const one = await request(app.getHttpServer())
      .get(`/posts/${id}`)
      .set('Authorization', `Bearer ${guest}`);
    expect(one.status).toBe(200);

    const comments = await request(app.getHttpServer())
      .get(`/posts/${id}/comments`)
      .set('Authorization', `Bearer ${guest}`);
    expect(comments.status).toBe(200);
  });
});

describe('Rate limiting on /auth/login', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp();
  });
  afterAll(async () => {
    await app.close();
  });

  it('allows 5 attempts per minute, then returns 429', async () => {
    const server = app.getHttpServer();
    const statuses: number[] = [];
    let lastBody: any = null;
    for (let i = 0; i < 6; i++) {
      const res = await request(server)
        .post('/auth/login')
        .send({ username: 'user', password: 'password' });
      statuses.push(res.status);
      lastBody = res.body;
    }
    expect(statuses).toEqual([201, 201, 201, 201, 201, 429]);
    expect(String(lastBody?.message)).toContain('ThrottlerException');
  });
});

describe('New-post WebSocket notifications', () => {
  let app: INestApplication;
  let port: number;
  let dataSource: DataSource;
  let authorToken: string;
  let recipientToken: string;

  beforeAll(async () => {
    app = await createApp();
    dataSource = app.get(DataSource);
    await app.listen(0);
    const address = app.getHttpServer().address() as { port: number };
    port = address.port;
    app.get(RealtimeService).init(app.getHttpServer());
    authorToken = mint(app, 2, 'moderator', Role.Moderator);
    recipientToken = mint(app, 3, 'user', Role.RegularUser);
  });
  afterAll(async () => {
    await app.close();
  });

  const connect = (token: string) =>
    new Promise<WebSocket>((resolve, reject) => {
      const ws = new WebSocket(
        `ws://127.0.0.1:${port}/ws?token=${encodeURIComponent(token)}`,
      );
      ws.on('open', () => resolve(ws));
      ws.on('error', reject);
    });

  type WsMessage = { ok: false } | { ok: true; message: Record<string, unknown> };

  const waitForMessage = (ws: WebSocket, timeoutMs: number) =>
    new Promise<WsMessage>((resolve) => {
      const timer = setTimeout(() => resolve({ ok: false }), timeoutMs);
      ws.on('message', (data) => {
        clearTimeout(timer);
        resolve({ ok: true, message: JSON.parse(data.toString()) });
      });
    });

  it('pushes notifications:new to recipients (author excluded) and stores DB rows', async () => {
    const recipient = await connect(recipientToken);
    const author = await connect(authorToken);
    // Give the server a moment to verify both JWTs and register the sockets.
    await sleep(300);

    const recipientMsgP = waitForMessage(recipient, 5000);
    const authorMsgP = waitForMessage(author, 1200);

    const created = await request(app.getHttpServer())
      .post('/posts')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ title: 'WS notification test', content: 'hello everyone' });
    expect(created.status).toBe(201);
    const postId = created.body.id;

    const recipientMsg = await recipientMsgP;
    if (!recipientMsg.ok) throw new Error('timed out waiting for notifications:new');
    expect(recipientMsg.message.type).toBe('notifications:new');
    const notification = recipientMsg.message.notification as {
      recipientId: number;
      postId: number;
      actorUsername: string;
    };
    expect(notification.recipientId).toBe(3);
    expect(notification.postId).toBe(postId);
    expect(notification.actorUsername).toBe('moderator');

    // The author's own sockets must not be notified about their own post.
    const authorMsg = await authorMsgP;
    expect(authorMsg.ok).toBe(false);

    // One DB row per active user except the author.
    const activeUsers = await dataSource
      .getRepository(User)
      .count({ where: { isActive: true } });
    const rows = await dataSource.getRepository(Notification).find({
      where: { postId },
    });
    expect(rows.length).toBe(activeUsers - 1);
    expect(rows.every((r) => r.postId === postId && r.recipientId !== 2)).toBe(true);

    recipient.close();
    author.close();
  });
});