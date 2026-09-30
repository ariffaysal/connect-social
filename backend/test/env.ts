// Runs before every test file via jest `setupFiles`: must execute before
// AppModule (and its env-driven config) is imported.
process.env.DB_HOST = '127.0.0.1';
process.env.DB_PORT = '3307';
process.env.DB_USERNAME = 'root';
process.env.DB_PASSWORD = '';
process.env.DB_NAME = 'connect_social_test';
process.env.DB_SYNCHRONIZE = 'true';
process.env.DB_DROP_SCHEMA = 'true';
process.env.JWT_SECRET = 'test-only-secret-0123456789abcdefghijklmnopqrstuvwxyz';
// Make the seeding and message-audit behaviour explicit instead of relying on
// the NODE_ENV defaults: the suite needs the demo accounts and audit rows.
process.env.SEED_DEMO_DATA = 'true';
process.env.MESSAGE_AUDIT_ENABLED = 'true';