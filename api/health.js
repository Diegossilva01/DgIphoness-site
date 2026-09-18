import { getRedis, redisConfig } from '../lib/store.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method !== 'GET') return res.status(405).json({ ok:false, error:'METHOD_NOT_ALLOWED' });

  const cfg = redisConfig();
  if (!cfg.configured) {
    return res.status(503).json({
      ok:false,
      error:'REDIS_NOT_CONFIGURED',
      message:'Banco Redis não conectado ao projeto da Vercel.'
    });
  }

  try {
    const redis = getRedis();
    await redis.ping();
    return res.status(200).json({ ok:true, service:'ludo-api', storage:'redis' });
  } catch (error) {
    console.error('health redis error', error);
    return res.status(503).json({
      ok:false,
      error:'REDIS_UNAVAILABLE',
      message:'Não foi possível acessar o Redis.'
    });
  }
}
