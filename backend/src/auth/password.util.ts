import * as bcrypt from 'bcryptjs';

const BCRYPT_SALT_ROUNDS = 10;

/** Whether a stored value looks like a bcrypt hash (`$2a$`, `$2b$` or `$2y$`). */
export function isBcryptHash(value: string): boolean {
  return /^\$2[aby]\$\d{2}\$/.test(value);
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}