import { mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

/**
 * Pick a writable directory for uploaded post images and ensure it exists.
 *
 * Local/self-hosted runs store uploads next to the process (backend/uploads).
 * Serverless hosts (Vercel) have a read-only filesystem outside /tmp, so the
 * bare mkdir throws there; fall back to the OS temp dir in that case.
 *
 * Note: on Vercel /tmp is per-instance and ephemeral, so uploaded images can
 * disappear when the function instance is recycled. That is an acceptable
 * limitation for the hosted demo (uploads are validated, but not durable).
 */
export function resolveUploadDir(): string {
  const candidates = process.env.UPLOAD_DIR
    ? [process.env.UPLOAD_DIR]
    : [join(process.cwd(), 'uploads'), join(tmpdir(), 'connect-social-uploads')];

  for (const dir of candidates) {
    try {
      mkdirSync(dir, { recursive: true });
      return dir;
    } catch {
      // Not writable — try the next candidate.
    }
  }
  // Last resort: surface the error to multer at upload time rather than
  // crashing the whole app at boot.
  return candidates[candidates.length - 1];
}
