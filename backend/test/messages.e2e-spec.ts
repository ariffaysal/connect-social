import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { describe, beforeAll, afterAll, it, expect } from '@jest/globals';
import { AppModule } from '../src/app.module';
import { User } from '../src/users/entities/user.entity';
import { Message } from '../src/messages/entities/message.entity';
import { MessageLog } from '../src/messages/entities/message-log.entity';
import { Role } from '../src/auth/roles.enum';

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
