import { createConnection } from 'mysql2/promise';

export default async function globalSetup() {
  const conn = await createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3307,
    user: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || '',
  });
  await conn.query(
    'CREATE DATABASE IF NOT EXISTS `connect_social_test` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci',
  );
  await conn.end();
}