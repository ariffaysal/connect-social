import {
  BadRequestException,
  Controller,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { extname, join } from 'path';
import { readFile, unlink } from 'fs/promises';
import { resolveUploadDir } from './upload-dir';
import { randomUUID } from 'crypto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enum';

export const UPLOAD_DIR = resolveUploadDir();

const MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

// Verify the file content itself (magic bytes), not just the declared MIME
// type, so a renamed executable can never pass as an image.
function detectImageType(buffer: Buffer): string | null {
  if (buffer.length >= 8 &&
      buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e &&
      buffer[3] === 0x47 && buffer[4] === 0x0d && buffer[5] === 0x0a &&
      buffer[6] === 0x1a && buffer[7] === 0x0a) {
    return 'png';
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpg';
  }
  if (buffer.length >= 6) {
    const head = buffer.toString('ascii', 0, 6);
    if (head === 'GIF87a' || head === 'GIF89a') return 'gif';
  }
  if (buffer.length >= 12 &&
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP') {
    return 'webp';
  }
  return null;
}

// multer has no bundled TypeScript declarations; platform-express loads it at runtime.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const multer = require('multer') as {
  diskStorage: (options: unknown) => unknown;
};

type UploadedImage = {
  filename: string;
  originalname: string;
  mimetype: string;
  size: number;
};

@Controller('uploads')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SuperAdmin, Role.Moderator, Role.RegularUser)
export class UploadsController {
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: multer.diskStorage({
        destination: UPLOAD_DIR,
        filename: (_req: unknown, file: { mimetype: string; originalname: string }, cb: (err: Error | null, name?: string) => void) => {
          const ext = MIME_EXT[file.mimetype] ?? extname(file.originalname).toLowerCase();
          const dotExt = ext.startsWith('.') ? ext : `.${ext || 'bin'}`;
          cb(null, `${Date.now()}-${randomUUID()}${dotExt}`);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (
        _req: unknown,
        file: { mimetype: string },
        cb: (err: Error | null, ok: boolean) => void,
      ) => {
        if (MIME_EXT[file.mimetype]) cb(null, true);
        else cb(new BadRequestException('Only PNG, JPG, GIF or WebP images are allowed'), false);
      },
    }),
  )
  async upload(@UploadedFile() file: UploadedImage, @Req() req: Request) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const filePath = join(UPLOAD_DIR, file.filename);
    try {
      const buffer = await readFile(filePath);
      const declaredExt = MIME_EXT[file.mimetype];
      const detected = detectImageType(buffer);
      if (!declaredExt || detected !== declaredExt) {
        // Reject and remove the file so nothing bogus stays on disk.
        await unlink(filePath).catch(() => undefined);
        throw new BadRequestException('Uploaded file is not a valid image');
      }
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      await unlink(filePath).catch(() => undefined);
      throw new BadRequestException('Could not read uploaded file');
    }

    const url = `${req.protocol}://${req.get('host')}/uploads/${file.filename}`;
    return { url, filename: file.filename };
  }
}