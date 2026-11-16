// Credentials for the public read-only demo account. Intentionally not a
// secret - anyone can use these to explore the product without registering.
// The account itself is VIEWER-only everywhere (see packages/database/seed.ts,
// which is the source of truth for these values and must be kept in sync),
// so nothing it can do is destructive even though the credentials are public.
export const DEMO_EMAIL = 'demo@docly.dev';
export const DEMO_PASSWORD = 'DemoAccess123';
