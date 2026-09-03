/**
 * Base URL of the ConnectSocial backend API.
 *
 * In development this defaults to the local NestJS server.
 * In production, set the `NEXT_PUBLIC_API_URL` environment variable on
 * Vercel (or in your `.env.local`) to point at your hosted backend, e.g.
 *
 *   NEXT_PUBLIC_API_URL=https://connect-social-api.example.com
 */
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
