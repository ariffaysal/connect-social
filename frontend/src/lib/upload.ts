import { API_URL } from './api';
import { getToken } from './auth';

export async function uploadImage(file: File): Promise<string> {
  if (!/^image\/(png|jpeg|gif|webp)$/i.test(file.type)) {
    throw new Error('Only PNG, JPG, GIF or WebP images can be uploaded.');
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Image must be 5 MB or smaller.');
  }

  const body = new FormData();
  body.append('file', file);

  const res = await fetch(`${API_URL}/uploads`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}` },
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (data as { message?: string }).message || 'Image upload failed',
    );
  }
  return (data as { url: string }).url;
}
