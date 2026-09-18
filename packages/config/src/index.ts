import { z } from 'zod';

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

  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(5),

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
