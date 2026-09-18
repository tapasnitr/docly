import { createClient } from 'redis';

// Load environment variables
const env = process.env;

// Database configuration
export const DATABASE_URL = env.DATABASE_URL || 'postgresql://docly:docly_password@localhost:5432/docly_db?schema=public';

// Redis configuration
const REDIS_URL = env.REDIS_URL || 'redis://localhost:6379';
export const REDIS_HOST = env.REDIS_HOST || 'localhost';
export const REDIS_PORT = parseInt(env.REDIS_PORT || '6379');

// Create and export Redis client
export const redis = createClient({
  url: REDIS_URL,
});

// Handle connection errors
redis.on('error', (err) => {
  console.error('Redis connection error:', err);
});

// Connect Redis
redis.connect().catch((err) => {
  console.error('Failed to connect to Redis:', err);
  process.exit(1);
});

// API configuration
export const API_HOST = env.API_HOST || '0.0.0.0';
export const API_PORT = parseInt(env.API_PORT || '3001');

// Node environment
export const NODE_ENV = env.NODE_ENV || 'development';
export const LOG_LEVEL = env.LOG_LEVEL || 'info';

// JWT configuration
export const JWT_SECRET = env.JWT_SECRET || 'your_jwt_secret_change_in_production';
export const JWT_EXPIRY = env.JWT_EXPIRY || '15m';
export const JWT_REFRESH_EXPIRY = env.JWT_REFRESH_EXPIRY || '7d';

// Worker configuration
export const WORKER_CONCURRENCY = parseInt(env.WORKER_CONCURRENCY || '5');

// AWS configuration
export const AWS_REGION = env.AWS_REGION || 'us-east-1';
export const AWS_S3_BUCKET = env.AWS_S3_BUCKET || 'docly-documents';
export const AWS_ACCESS_KEY_ID = env.AWS_ACCESS_KEY_ID || '';
export const AWS_SECRET_ACCESS_KEY = env.AWS_SECRET_ACCESS_KEY || '';

// LLM configuration
export const OPENAI_API_KEY = env.OPENAI_API_KEY || '';

export const config = {
  NODE_ENV,
  LOG_LEVEL,
  DATABASE_URL,
  REDIS_URL,
  REDIS_HOST,
  REDIS_PORT,
  API_HOST,
  API_PORT,
  JWT_SECRET,
  JWT_EXPIRY,
  JWT_REFRESH_EXPIRY,
  WORKER_CONCURRENCY,
  AWS_REGION,
  AWS_S3_BUCKET,
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  OPENAI_API_KEY,
};

export default config;
