import { createClient, type RedisClientType } from 'redis';

export type RedisClient = RedisClientType;

export interface RedisConnectOptions {
  url: string;
  onError?: (err: Error) => void;
  // node-redis retries forever by default, so a plain `await client.connect()`
  // never rejects when Redis is unreachable - it just hangs while logging
  // errors. Bounding the initial attempt with a timeout makes startup
  // actually fail fast, as intended.
  connectTimeoutMs?: number;
}

let client: RedisClient | null = null;

// Pure factory - no side effects, does not connect.
export function createRedisClient(url: string): RedisClient {
  return createClient({ url });
}

// Connects (or returns the existing) singleton client. Call once during app startup.
export async function connectRedis(options: RedisConnectOptions): Promise<RedisClient> {
  if (client) {
    return client;
  }

  const newClient = createRedisClient(options.url);
  newClient.on('error', (err: Error) => {
    options.onError?.(err);
  });

  const connectTimeoutMs = options.connectTimeoutMs ?? 10_000;

  try {
    await withTimeout(newClient.connect(), connectTimeoutMs);
  } catch (err) {
    // Stop the client's background reconnect loop - otherwise its retry
    // timers keep the process alive even after we've given up and thrown.
    await newClient.disconnect().catch(() => {
      // Already disconnected/never connected - nothing left to clean up.
    });
    throw err;
  }

  client = newClient;
  return client;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Redis: failed to connect within ${timeoutMs}ms`)),
      timeoutMs
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

// Returns the already-connected singleton. Throws if connectRedis() has not run yet,
// so callers fail fast instead of silently talking to an unconnected client.
export function getRedisClient(): RedisClient {
  if (!client) {
    throw new Error('Redis client has not been initialized. Call connectRedis() during app startup first.');
  }
  return client;
}

export async function disconnectRedis(): Promise<void> {
  if (client) {
    await client.quit();
    client = null;
  }
}
