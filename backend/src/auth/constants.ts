const DEV_PLACEHOLDERS = [
  'dev-only-change-me-secret',
  'change-me',
  'change-me-to-a-long-random-value',
  'your-secret-key',
  'changeme',
  'secret',
];

function requireJwtSecret(): string {
  const raw = process.env.JWT_SECRET;
  const secret = raw?.trim();

  if (
    !secret ||
    secret.length < 32 ||
    DEV_PLACEHOLDERS.includes(secret.toLowerCase())
  ) {
    throw new Error(
      'JWT_SECRET is missing, too short (min 32 chars), or still set to the development placeholder. ' +
        'Generate a strong random value (e.g. `openssl rand -base64 48`) and set it in the backend environment before starting.',
    );
  }
  return secret;
}

export const jwtConstants = {
  // Evaluated at startup: throws and aborts boot when JWT_SECRET is unset or weak.
  secret: requireJwtSecret(),
};