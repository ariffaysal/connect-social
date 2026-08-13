import { API_URL } from './api';

export type Profile = {
  userId: number;
  username: string;
  role: string;
  fullName?: string;
  email?: string;
  jobTitle?: string;
  bio?: string;
  avatarUrl?: string;
  departmentId?: number;
  departmentName?: string;
  departmentColor?: string;
  isActive?: boolean;
  postCount?: number;
  commentCount?: number;
  reactionCount?: number;
  receivedReactions?: number;
  createdAt?: string;
};

export const TOKEN_KEY = 'connectsocial_token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
}

export function isAuthed(): boolean {
  return Boolean(getToken());
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const message =
      (data as { message?: string | string[] }).message ?? 'Request failed';
    throw new Error(Array.isArray(message) ? message.join(', ') : message);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function fetchProfile(): Promise<Profile> {
  return apiFetch<Profile>('/auth/profile');
}

export function isModOrAdmin(role: string): boolean {
  return role === 'SuperAdmin' || role === 'Moderator';
}

export function canPost(role: string): boolean {
  return role === 'SuperAdmin' || role === 'Moderator' || role === 'RegularUser';
}
