import { resolve } from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

// Loads the repo-root .env into process.env for local/bare-metal dev and test
// runs (`npm run dev`, `vitest run`), where nothing else populates it. npm/turbo
// run workspace scripts with cwd set to that workspace's own directory, and
// every workspace lives exactly two levels under the repo root (apps/* or
// packages/*), so this relative path is stable regardless of which workspace
// triggered it. Never overrides variables already set in the environment
// (e.g. by docker-compose), and is a silent no-op if the file doesn't exist
// (production deployments don't ship one).
loadDotenv({ path: resolve(process.cwd(), '../../.env') });

const isProduction = process.env.NODE_ENV === 'production';

// Environment configuration strategy: every variable is declared here with a type,
// a safe development default (where one makes sense), and stricter rules for
// production (e.g. JWT_SECRET can't fall back to a placeholder). Parsing happens
// once at import time so a misconfigured deployment fails fast on startup with a
// readable error instead of surfacing as a confusing runtime failure later.
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  DATABASE_URL: z
    .string()
    .default('postgresql://docly:docly_password@localhost:5432/docly_db?schema=public'),

  REDIS_URL: z.string().default('redis://localhost:6379'),

  API_HOST: z.string().default('0.0.0.0'),
  API_PORT: z.coerce.number().int().positive().default(3001),
  CORS_ORIGIN: z.string().default('*'),

  JWT_SECRET: isProduction
    ? z.string().min(32, 'JWT_SECRET must be at least 32 characters in production')
    : z.string().default('dev_jwt_secret_change_in_production_min_32_chars'),
  JWT_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),

  // Base URL of the web app, used to build links embedded in emails
  // (verify-email, reset-password) - never derived from request headers,
  // which a client can spoof.
  WEB_APP_URL: z.string().default('http://localhost:3000'),

  // Email via SMTP (e.g. Gmail: smtp.gmail.com:465 with an App Password). When
  // SMTP_HOST is unset, lib/email.ts logs emails instead of sending them.
  SMTP_HOST: z.string().default(''),
  SMTP_PORT: z.coerce.number().default(465),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  EMAIL_FROM: z.string().default('Docly <you@example.com>'),
  EMAIL_VERIFICATION_EXPIRY: z.string().default('24h'),
  PASSWORD_RESET_EXPIRY: z.string().default('1h'),

  // Account lockout: consecutive failed login attempts before a temporary
  // lock kicks in, and how long that lock lasts.
  LOGIN_LOCKOUT_THRESHOLD: z.coerce.number().int().positive().default(5),
  LOGIN_LOCKOUT_DURATION: z.string().default('15m'),

  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(5),

  // Document storage. Files go through the StorageProvider abstraction
  // (apps/api/src/storage); the local-disk provider writes under STORAGE_DIR
  // (default: <repo root>/storage, resolved like the .env path above - in
  // Docker, point it at a mounted volume). MAX_UPLOAD_MB caps a single upload.
  STORAGE_DIR: z.string().default(resolve(process.cwd(), '../../storage')),
  MAX_UPLOAD_MB: z.coerce.number().positive().default(10),

  AWS_REGION: z.string().default('us-east-1'),
  AWS_S3_BUCKET: z.string().default('docly-documents'),
  AWS_ACCESS_KEY_ID: z.string().default(''),
  AWS_SECRET_ACCESS_KEY: z.string().default(''),

  OPENAI_API_KEY: z.string().default(''),
});

export type Config = z.infer<typeof envSchema>;

function loadConfig(): Config {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return result.data;
}

export const config = loadConfig();

export default config;
