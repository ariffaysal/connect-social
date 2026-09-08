import { mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

/**
 * Pick a writable directory for uploaded post images and ensure it exists.
 *
 * Uploads are stored next to the process (backend/uploads). If that directory
 * is not writable (e.g. a read-only install), fall back to the OS temp dir.
 * Note: uploaded images are only durable when `backend/uploads` is writable,
 * so keep that directory persistent on your host.
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
