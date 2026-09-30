import { randomBytes } from 'crypto';

/**
 * Public, URL-facing identifier for a user or post.
 *
 * Motivation: the API/DB use sequential integer ids, but putting those in a
 * URL (`/profile/2`, `/feed?post=24`) lets anyone walk the id space and
 * enumerate every profile and post. These refs replace the numbers in URLs
 * with a 128-bit random, URL-safe token that cannot be guessed or counted up.
 *
 * They are opaque, not reversible: there is no key to leak and nothing to
 * decrypt, which makes them strictly stronger than encrypting the id would be
 * for this purpose (query params are always visible to the visitor anyway).
 */
export function generatePublicId(): string {
  // 16 bytes -> 22 URL-safe characters (base64url, no padding).
  return randomBytes(16).toString('base64url');
}

/** True for a legacy numeric ref (an old `/profile/2` style link). */
export function isNumericRef(ref: string | undefined | null): boolean {
  return typeof ref === 'string' && /^[0-9]{1,15}$/.test(ref);
}
