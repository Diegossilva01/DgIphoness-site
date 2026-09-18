import { Redis } from '@upstash/redis';

let client;

export function redisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '';
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '';
  return { url, token, configured: Boolean(url && token) };
}

export function getRedis() {
  if (client) return client;
  const { url, token, configured } = redisConfig();
  if (!configured) {
    const err = new Error('REDIS_NOT_CONFIGURED');
    err.code = 'REDIS_NOT_CONFIGURED';
    throw err;
  }
  client = new Redis({ url, token });
  return client;
}
