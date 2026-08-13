export const jwtConstants = {
  // Override in production with a long random value, e.g. `JWT_SECRET`.
  secret: process.env.JWT_SECRET || 'dev-only-change-me-secret',
};
