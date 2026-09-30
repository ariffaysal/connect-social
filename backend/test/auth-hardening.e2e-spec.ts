import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { describe, beforeAll, afterAll, it, expect } from '@jest/globals';
import { AppModule } from '../src/app.module';
import { User } from '../src/users/entities/user.entity';
import { Role } from '../src/auth/roles.enum';

async function createApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  return app;
}

function mint(
  app: INestApplication,
  userId: number,
  username: string,
  role: Role,
  version = 0,
): string {
  const jwt = app.get(JwtService);
  return jwt.sign({ username, sub: userId, role, ver: version }, { expiresIn: '1h' });
}

describe('Authorization is validated against the account on every request', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    app = await createApp();
    dataSource = app.get(DataSource);
  });
  afterAll(async () => {
    await app.close();
  });

  it('rejects a token whose user does not exist', async () => {
    // Previously the API trusted `sub`/`role` from the token and answered 200.
    const ghost = mint(app, 999999, 'ghost', Role.SuperAdmin);
    const res = await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${ghost}`);
    expect(res.status).toBe(401);
  });

  it('ignores a role claimed in the token and uses the stored role instead', async () => {
    const user = await dataSource
      .getRepository(User)
      .findOne({ where: { username: 'user' } });
    expect(user?.role).toBe(Role.RegularUser);

    // Same account, but the token claims SuperAdmin.
    const escalated = mint(app, user!.userId, 'user', Role.SuperAdmin);
    const denied = await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${escalated}`);
    expect(denied.status).toBe(403);

    // ...and a legitimate SuperAdmin still works.
    const admin = await dataSource
      .getRepository(User)
      .findOne({ where: { username: 'admin' } });
    const allowed = await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${mint(app, admin!.userId, 'admin', Role.SuperAdmin)}`);
    expect(allowed.status).toBe(200);
  });

  it('rejects the tokens of an account that has been deactivated', async () => {
    const users = dataSource.getRepository(User);
    const guest = await users.findOne({ where: { username: 'guest' } });
    const token = mint(app, guest!.userId, 'guest', Role.Guest);

    const before = await request(app.getHttpServer())
      .get('/notifications')
      .set('Authorization', `Bearer ${token}`);
    expect(before.status).toBe(200);

    // Admin deactivates the account.
    await request(app.getHttpServer())
      .patch(`/users/${guest!.userId}`)
      .set(
        'Authorization',
        `Bearer ${mint(
          app,
          (await users.findOne({ where: { username: 'admin' } }))!.userId,
          'admin',
          Role.SuperAdmin,
        )}`,
      )
      .send({ isActive: false })
      .expect(200);

    // The pre-existing token stops working on the very next request.
    const after = await request(app.getHttpServer())
      .get('/notifications')
      .set('Authorization', `Bearer ${token}`);
    expect(after.status).toBe(401);
  });

  it('revokes existing sessions when a password is changed', async () => {
    const users = dataSource.getRepository(User);
    const admin = await users.findOne({ where: { username: 'admin' } });
    const adminToken = mint(app, admin!.userId, 'admin', Role.SuperAdmin);

    // A dedicated account, so the test never mutates a seeded one.
    const created = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        username: 'pw-reset-subject',
        password: 'initial-password-123',
        role: Role.RegularUser,
      });
    expect(created.status).toBe(201);
    const subjectId = created.body.userId;

    const victimToken = mint(app, subjectId, 'pw-reset-subject', Role.RegularUser);
    const ok = await request(app.getHttpServer())
      .get('/notifications')
      .set('Authorization', `Bearer ${victimToken}`);
    expect(ok.status).toBe(200);

    await request(app.getHttpServer())
      .patch(`/users/${subjectId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ password: 'brand-new-password-123' })
      .expect(200);

    const revoked = await request(app.getHttpServer())
      .get('/notifications')
      .set('Authorization', `Bearer ${victimToken}`);
    expect(revoked.status).toBe(401);

    // The new credentials work, and the token they return is accepted.
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'pw-reset-subject', password: 'brand-new-password-123' });
    expect(login.status).toBe(201);
    const fresh = await request(app.getHttpServer())
      .get('/notifications')
      .set('Authorization', `Bearer ${login.body.access_token}`);
    expect(fresh.status).toBe(200);
  });

  it('rejects a token carrying an outdated session generation', async () => {
    const user = await dataSource
      .getRepository(User)
      .findOne({ where: { username: 'user' } });
    const stale = mint(app, user!.userId, 'user', Role.RegularUser, 99);
    const res = await request(app.getHttpServer())
      .get('/notifications')
      .set('Authorization', `Bearer ${stale}`);
    expect(res.status).toBe(401);
  });
});

describe('Demo seeding is gated and never invents a credential', () => {
  afterAll(() => {
    delete process.env.SEED_DEMO_DATA;
    delete process.env.BOOTSTRAP_ADMIN_USERNAME;
    delete process.env.BOOTSTRAP_ADMIN_PASSWORD;
  });

  it('creates no accounts at all when SEED_DEMO_DATA=false', async () => {
    process.env.SEED_DEMO_DATA = 'false';
    delete process.env.BOOTSTRAP_ADMIN_USERNAME;
    delete process.env.BOOTSTRAP_ADMIN_PASSWORD;

    const app = await createApp();
    try {
      const users = await app.get(DataSource).getRepository(User).find();
      // The critical finding: no admin/password, moderator/password, ...
      expect(users).toHaveLength(0);
    } finally {
      await app.close();
    }
  });

  it('creates exactly one SuperAdmin from BOOTSTRAP_ADMIN_* when the table is empty', async () => {
    process.env.SEED_DEMO_DATA = 'false';
    process.env.BOOTSTRAP_ADMIN_USERNAME = 'root-admin';
    process.env.BOOTSTRAP_ADMIN_PASSWORD = 'bootstrap-password-strong';

    const app = await createApp();
    try {
      const users = await app.get(DataSource).getRepository(User).find();
      expect(users).toHaveLength(1);
      expect(users[0].username).toBe('root-admin');
      expect(users[0].role).toBe(Role.SuperAdmin);
      expect(users[0].password).toMatch(/^\$2[aby]\$\d{2}\$/);

      const login = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'root-admin', password: 'bootstrap-password-strong' });
      expect(login.status).toBe(201);
    } finally {
      await app.close();
    }
  });

  it('refuses a bootstrap password that is too short', async () => {
    process.env.SEED_DEMO_DATA = 'false';
    process.env.BOOTSTRAP_ADMIN_USERNAME = 'root-admin';
    process.env.BOOTSTRAP_ADMIN_PASSWORD = 'short';

    const app = await createApp();
    try {
      const users = await app.get(DataSource).getRepository(User).find();
      expect(users).toHaveLength(0);
    } finally {
      await app.close();
    }
  });
});
