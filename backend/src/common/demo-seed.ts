/**
 * Demo-data seeding policy.
 *
 * The backend can seed a demo dataset (accounts with *known* passwords, sample
 * departments, sample posts) so a fresh local database is immediately usable.
 * That must never happen silently on a real deployment: `admin` / `password`
 * is a public credential.
 *
 * Rules:
 *   - `SEED_DEMO_DATA=true`  -> always seed (explicit opt-in, e.g. demos/staging)
 *   - `SEED_DEMO_DATA=false` -> never seed, in any environment
 *   - unset                  -> seed only outside production (`NODE_ENV !== 'production'`)
 */
const TRUTHY = ['true', '1', 'yes', 'on'];
const FALSY = ['false', '0', 'no', 'off'];

export function shouldSeedDemoData(): boolean {
  const raw = process.env.SEED_DEMO_DATA?.trim().toLowerCase();
  if (raw && TRUTHY.includes(raw)) return true;
  if (raw && FALSY.includes(raw)) return false;
  return process.env.NODE_ENV !== 'production';
}

export type BootstrapAdmin = {
  username: string;
  password: string;
  email?: string;
  fullName?: string;
  jobTitle?: string;
};

/** Minimum length for a bootstrap password. */
export const BOOTSTRAP_MIN_PASSWORD_LENGTH = 12;

/**
 * The first SuperAdmin for a deployment where demo seeding is disabled.
 * Supplied by the operator through the environment for a single boot, so no
 * password in this system is ever a default.
 */
export function bootstrapAdminFromEnv(): BootstrapAdmin | null {
  const username = process.env.BOOTSTRAP_ADMIN_USERNAME?.trim();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!username || !password) return null;
  return {
    username,
    password,
    email: process.env.BOOTSTRAP_ADMIN_EMAIL?.trim() || undefined,
    fullName: process.env.BOOTSTRAP_ADMIN_FULL_NAME?.trim() || username,
    jobTitle: process.env.BOOTSTRAP_ADMIN_JOB_TITLE?.trim() || undefined,
  };
}
