import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

/**
 * Global rate limit — applied to every route, keyed by IP. Backstops the
 * per-endpoint limiters and provides a baseline against accidental DoS.
 */
export const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Terlalu banyak permintaan. Coba lagi nanti.' },
});

/**
 * Per-user limiter for financial / mutating endpoints. Keyed by user id when
 * authenticated, falling back to IP. The default keyGenerator combines
 * `req.user` (set by the auth middleware) and the IP. If the auth middleware
 * has not run yet the limit is per-IP only.
 */
export const userLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const userId = (req as { user?: { userId?: number } }).user?.userId;
    const ip = req.ip ?? 'unknown';
    return userId ? `u:${userId}:${ip}` : `ip:${ip}`;
  },
  message: { success: false, message: 'Terlalu banyak aksi. Coba lagi sebentar.' },
  // Trust the proxy in production (compose/nginx). env.isProduction gates this
  // so dev still works behind `localhost`.
  validate: { trustProxy: env.isProduction },
});
