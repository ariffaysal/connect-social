import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import request from 'supertest';
import WebSocket from 'ws';
import { describe, beforeAll, afterAll, it, expect } from '@jest/globals';
import { AppModule } from '../src/app.module';
import { User } from '../src/users/entities/user.entity';
import { Post } from '../src/posts/entities/post.entity';
import { Message } from '../src/messages/entities/message.entity';
import { MessageLog } from '../src/messages/entities/message-log.entity';
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

/** Mint a token directly (no login request) so tests never consume the login quota. */
function mint(app: INestApplication, userId: number, username: string, role: Role): string {
  const jwt = app.get(JwtService);
  return jwt.sign({ username, sub: userId, role }, { expiresIn: '1h' });
}

describe('Direct messages: send, thread, retention, monitoring', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let adminId = 0;
  let moderatorId = 0;
  let userId = 0;
  let guestId = 0;
  let adminToken = '';
  let moderatorToken = '';
  let guestToken = '';

  beforeAll(async () => {
    app = await createApp();
    dataSource = app.get(DataSource);
    const users = dataSource.getRepository(User);
    const [admin, moderator, regular, guest] = await Promise.all([
      users.findOne({ where: { username: 'admin' } }),
      users.findOne({ where: { username: 'moderator' } }),
      users.findOne({ where: { username: 'user' } }),
      users.findOne({ where: { username: 'guest' } }),
    ]);
    adminId = admin!.userId;
    moderatorId = moderator!.userId;
    userId = regular!.userId;
    guestId = guest!.userId;
    adminToken = mint(app, adminId, 'admin', Role.SuperAdmin);
    moderatorToken = mint(app, moderatorId, 'moderator', Role.Moderator);
    guestToken = mint(app, guestId, 'guest', Role.Guest);
  });

  afterAll(async () => {
    delete process.env.MESSAGE_RETENTION_MINUTES;
    await app.close();
  });

  it('rejects self-messaging, unknown recipients, and Guest senders', async () => {
    const self = await request(app.getHttpServer())
      .post('/messages')
      .set('Authorization', `Bearer ${mint(app, userId, 'user', Role.RegularUser)}`)
      .send({ recipientId: userId, content: 'talking to myself' });
    expect(self.status).toBe(400);

    const missing = await request(app.getHttpServer())
      .post('/messages')
      .set('Authorization', `Bearer ${mint(app, userId, 'user', Role.RegularUser)}`)
      .send({ recipientId: 999999, content: 'anyone there?' });
    expect(missing.status).toBe(404);

    const guest = await request(app.getHttpServer())
      .post('/messages')
      .set('Authorization', `Bearer ${guestToken}`)
      .send({ recipientId: moderatorId, content: 'guests are read-only' });
    expect(guest.status).toBe(403);
  });

  it('lets two users exchange messages and returns the thread to both sides', async () => {
    const userToken = mint(app, userId, 'user', Role.RegularUser);

    const sent = await request(app.getHttpServer())
      .post('/messages')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ recipientId: moderatorId, content: 'Hi Sam, quick question.' });
    expect(sent.status).toBe(201);
    expect(sent.body.senderId).toBe(userId);
    expect(sent.body.recipientId).toBe(moderatorId);

    const replied = await request(app.getHttpServer())
      .post('/messages')
      .set('Authorization', `Bearer ${moderatorToken}`)
      .send({ recipientId: userId, content: 'Sure, go ahead.' });
    expect(replied.status).toBe(201);

    const thread = await request(app.getHttpServer())
      .get(`/messages/with/${moderatorId}`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(thread.status).toBe(200);
    expect(thread.body.messages.map((m: any) => m.content)).toEqual([
      'Hi Sam, quick question.',
      'Sure, go ahead.',
    ]);
    expect(thread.body.total).toBe(2);
    expect(thread.body.retentionMinutes).toBe(60);

    // The other participant sees the same conversation, from their side.
    const otherSide = await request(app.getHttpServer())
      .get(`/messages/with/${userId}`)
      .set('Authorization', `Bearer ${moderatorToken}`);
    expect(otherSide.status).toBe(200);
    expect(otherSide.body.total).toBe(2);

    const conversations = await request(app.getHttpServer())
      .get('/messages/conversations')
      .set('Authorization', `Bearer ${userToken}`);
    expect(conversations.status).toBe(200);
    const summary = conversations.body.find((c: any) => c.otherUserId === moderatorId);
    expect(summary).toBeTruthy();
    expect(summary.messageCount).toBe(2);
    expect(summary.lastMessage).toBe('Sure, go ahead.');
    expect(summary.lastFromMe).toBe(false);
  });

  it('tracks unread messages and clears them when the thread is opened', async () => {
    const userToken = mint(app, userId, 'user', Role.RegularUser);
    const moderatorToken = mint(app, moderatorId, 'moderator', Role.Moderator);

    const before = await request(app.getHttpServer())
      .get('/messages/unread-count')
      .set('Authorization', `Bearer ${moderatorToken}`);
    expect(before.status).toBe(200);
    const startingUnread = Number(before.body.count);

    const sent = await request(app.getHttpServer())
      .post('/messages')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ recipientId: moderatorId, content: 'unread badge check' });
    expect(sent.status).toBe(201);
    expect(sent.body.readAt ?? null).toBeNull();

    // The badge count must move the instant the message lands.
    const after = await request(app.getHttpServer())
      .get('/messages/unread-count')
      .set('Authorization', `Bearer ${moderatorToken}`);
    expect(Number(after.body.count)).toBe(startingUnread + 1);

    // Conversation list surfaces the per-conversation unread count.
    const list = await request(app.getHttpServer())
      .get('/messages/conversations')
      .set('Authorization', `Bearer ${moderatorToken}`);
    const conversation = list.body.find((c: any) => c.otherUserId === userId);
    expect(conversation.unreadCount).toBeGreaterThan(0);
    expect(conversation.otherPublicId).toBeTruthy();

    // Opening the thread reads it.
    const thread = await request(app.getHttpServer())
      .get(`/messages/with/${conversation.otherPublicId}`)
      .set('Authorization', `Bearer ${moderatorToken}`);
    expect(thread.status).toBe(200);

    const cleared = await request(app.getHttpServer())
      .get('/messages/unread-count')
      .set('Authorization', `Bearer ${moderatorToken}`);
    expect(Number(cleared.body.count)).toBe(0);
  });

  it('mirrors every message into the admin audit table', async () => {
    const logs = await dataSource.getRepository(MessageLog).find({
      where: { senderId: userId, recipientId: moderatorId },
    });
    expect(logs.map((l) => l.content)).toContain('Hi Sam, quick question.');

    const live = await dataSource.getRepository(Message).count({
      where: { senderId: userId, recipientId: moderatorId },
    });
    expect(live).toBeGreaterThan(0);
  });

  it('exposes conversation monitoring to management only', async () => {
    const denied = await request(app.getHttpServer())
      .get('/messages/admin/conversations')
      .set('Authorization', `Bearer ${mint(app, userId, 'user', Role.RegularUser)}`);
    expect(denied.status).toBe(403);

    const allowed = await request(app.getHttpServer())
      .get('/messages/admin/conversations')
      .set('Authorization', `Bearer ${moderatorToken}`);
    expect(allowed.status).toBe(200);
    const pair = allowed.body.find(
      (c: any) =>
        [c.participantA.userId, c.participantB.userId].includes(userId) &&
        [c.participantA.userId, c.participantB.userId].includes(moderatorId),
    );
    expect(pair).toBeTruthy();

    const transcript = await request(app.getHttpServer())
      .get(`/messages/admin/thread?userA=${userId}&userB=${moderatorId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(transcript.status).toBe(200);
    expect(transcript.body.messages.length).toBeGreaterThanOrEqual(2);
  });

  it('purges live messages after the retention window but keeps the audit copy', async () => {
    // 0.02 minutes ≈ 1.2 seconds: a fast stand-in for the 60-minute window.
    process.env.MESSAGE_RETENTION_MINUTES = '0.02';
    const userToken = mint(app, userId, 'user', Role.RegularUser);

    const sent = await request(app.getHttpServer())
      .post('/messages')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ recipientId: moderatorId, content: 'this one expires quickly' });
    expect(sent.status).toBe(201);

    const retention = await request(app.getHttpServer())
      .get('/messages/retention')
      .set('Authorization', `Bearer ${userToken}`);
    expect(retention.body.retentionMinutes).toBeCloseTo(0.02);

    await sleep(1500);

    // Reading the thread runs the retention sweep first.
    const thread = await request(app.getHttpServer())
      .get(`/messages/with/${moderatorId}`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(thread.status).toBe(200);
    expect(thread.body.messages).toEqual([]);
    expect(thread.body.total).toBe(0);

    const live = await dataSource.getRepository(Message).count();
    expect(live).toBe(0);

    // Management can still see the purged conversation in the audit table.
    const audit = await dataSource.getRepository(MessageLog).find({
      where: { content: 'this one expires quickly' },
    });
    expect(audit.length).toBe(1);
  });
});

describe('Opaque public refs for URLs', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let token: string;

  beforeAll(async () => {
    app = await createApp();
    dataSource = app.get(DataSource);
    const admin = await dataSource.getRepository(User).findOne({ where: { username: 'admin' } });
    token = mint(app, admin!.userId, 'admin', Role.SuperAdmin);
  });
  afterAll(async () => {
    await app.close();
  });

  it('resolves profiles by publicId while still accepting legacy numeric ids', async () => {
    const user = await dataSource.getRepository(User).findOne({ where: { username: 'user' } });
    expect(user?.publicId).toMatch(/^[A-Za-z0-9_-]{20,}$/);

    const byRef = await request(app.getHttpServer())
      .get(`/users/${user!.publicId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(byRef.status).toBe(200);
    expect(byRef.body.userId).toBe(user!.userId);
    expect(byRef.body.publicId).toBe(user!.publicId);

    const byId = await request(app.getHttpServer())
      .get(`/users/${user!.userId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(byId.status).toBe(200);
    expect(byId.body.userId).toBe(user!.userId);

    const missing = await request(app.getHttpServer())
      .get('/users/definitely-not-a-real-ref')
      .set('Authorization', `Bearer ${token}`);
    expect(missing.status).toBe(404);
  });

  it('addresses posts, profile feeds and comment/reaction lists by ref', async () => {
    const feed = await request(app.getHttpServer())
      .get('/posts?limit=1')
      .set('Authorization', `Bearer ${token}`);
    expect(feed.status).toBe(200);
    const post = feed.body.posts[0];
    expect(post.publicId).toMatch(/^[A-Za-z0-9_-]{20,}$/);
    expect(post.ownerPublicId).toMatch(/^[A-Za-z0-9_-]{20,}$/);

    const permalink = await request(app.getHttpServer())
      .get(`/posts/${post.publicId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(permalink.status).toBe(200);
    expect(permalink.body.id).toBe(post.id);

    const comments = await request(app.getHttpServer())
      .get(`/posts/${post.publicId}/comments`)
      .set('Authorization', `Bearer ${token}`);
    expect(comments.status).toBe(200);

    const profilePosts = await request(app.getHttpServer())
      .get(`/posts/user/${post.ownerPublicId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(profilePosts.status).toBe(200);

    const profileComments = await request(app.getHttpServer())
      .get(`/users/${post.ownerPublicId}/comments`)
      .set('Authorization', `Bearer ${token}`);
    expect(profileComments.status).toBe(200);

    const profileReactions = await request(app.getHttpServer())
      .get(`/users/${post.ownerPublicId}/reactions`)
      .set('Authorization', `Bearer ${token}`);
    expect(profileReactions.status).toBe(200);

    const unknownPermalink = await request(app.getHttpServer())
      .get('/posts/definitely-not-a-real-ref')
      .set('Authorization', `Bearer ${token}`);
    expect(unknownPermalink.status).toBe(404);
  });

  it('gives every user and post a distinct ref', async () => {
    const userIds = (await dataSource.getRepository(User).find()).map((u) => u.publicId);
    const postIds = (await dataSource.getRepository(Post).find()).map((p) => p.publicId);
    expect(userIds.every(Boolean)).toBe(true);
    expect(postIds.every(Boolean)).toBe(true);
    expect(new Set(userIds).size).toBe(userIds.length);
    expect(new Set(postIds).size).toBe(postIds.length);
  });
});

describe('Live direct-message delivery over WebSocket', () => {
  let app: INestApplication;
  let port: number;
  let recipientId = 0;
  let recipientToken = '';
  let senderToken = '';
  let senderPublicId: string | null = null;

  beforeAll(async () => {
    app = await createApp();
    const dataSource = app.get(DataSource);
    const users = dataSource.getRepository(User);
    const [recipient, sender] = await Promise.all([
      users.findOne({ where: { username: 'user' } }),
      users.findOne({ where: { username: 'moderator' } }),
    ]);
    recipientId = recipient!.userId;
    senderPublicId = sender!.publicId ?? null;
    recipientToken = mint(app, recipient!.userId, 'user', Role.RegularUser);
    senderToken = mint(app, sender!.userId, 'moderator', Role.Moderator);

    await app.listen(0);
    const address = app.getHttpServer().address() as { port: number };
    port = address.port;
    app.get(RealtimeService).init(app.getHttpServer());
  });
  afterAll(async () => {
    await app.close();
  });

  const connect = (token: string) =>
    new Promise<WebSocket>((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?token=${encodeURIComponent(token)}`);
      ws.on('open', () => resolve(ws));
      ws.on('error', reject);
    });

  type WsMessage = { ok: false } | { ok: true; message: Record<string, any> };

  const waitForMessage = (ws: WebSocket, timeoutMs: number) =>
    new Promise<WsMessage>((resolve) => {
      const timer = setTimeout(() => resolve({ ok: false }), timeoutMs);
      ws.on('message', (data) => {
        clearTimeout(timer);
        resolve({ ok: true, message: JSON.parse(data.toString()) });
      });
    });

  it('pushes messages:new with opaque refs so the recipient gets it instantly', async () => {
    const ws = await connect(recipientToken);
    // Give the server a moment to verify the JWT and register the socket.
    await sleep(300);
    const incoming = waitForMessage(ws, 5000);

    const sent = await request(app.getHttpServer())
      .post('/messages')
      .set('Authorization', `Bearer ${senderToken}`)
      .send({ recipientId, content: 'live delivery over websocket' });
    expect(sent.status).toBe(201);

    const event = await incoming;
    if (!event.ok) throw new Error('timed out waiting for messages:new');
    expect(event.message.type).toBe('messages:new');
    expect(event.message.message.content).toBe('live delivery over websocket');
    expect(event.message.message.recipientId).toBe(recipientId);
    expect(event.message.message.readAt ?? null).toBeNull();
    expect(event.message.senderPublicId).toBe(senderPublicId);
    expect(event.message.recipientPublicId).toBeTruthy();

    ws.close();
  });
});
