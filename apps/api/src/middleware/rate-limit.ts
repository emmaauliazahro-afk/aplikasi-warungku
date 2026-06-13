import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { env } from '../config/env';

function getClientIp(req: any): string {
  const forwardedFor = req.headers?.['x-forwarded-for'];
  const forwarded = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
  const rawIp = String(forwarded || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  const normalizedIp = rawIp.replace(/^::ffff:/, '').replace(/:\d+$/, '');
  return normalizedIp === 'unknown' ? 'unknown' : ipKeyGenerator(normalizedIp);
}

/**
 * Global rate limit — applied to every route, keyed by IP. Backstops the
 * per-endpoint limiters and provides a baseline against accidental DoS.
 */
export const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientIp,
  message: { success: false, message: 'Terlalu banyak permintaan. Coba lagi nanti.' },
});

/**
 * Per-user limiter for financial / mutating endpoints. Uses IP-based limiting
 * with proper IPv6 support. Future enhancement: combine with user ID when authenticated.
 */
export const userLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientIp,
  message: { success: false, message: 'Terlalu banyak aksi. Coba lagi sebentar.' },
  // Trust the proxy in production (compose/nginx). env.isProduction gates this
  // so dev still works behind `localhost`.
  validate: { trustProxy: env.isProduction },
});
