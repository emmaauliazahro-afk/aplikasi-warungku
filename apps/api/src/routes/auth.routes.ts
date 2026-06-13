import { Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { asyncHandler } from '../middleware/error';
import { authenticate, authorize } from '../middleware/auth';
import { createCashier, register, login, me, logout } from '../controllers/auth.controller';

const router = Router();

function getClientIp(req: any): string {
  const forwardedFor = req.headers?.['x-forwarded-for'];
  const forwarded = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
  const rawIp = String(forwarded || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  const normalizedIp = rawIp.replace(/^::ffff:/, '').replace(/:\d+$/, '');
  return normalizedIp === 'unknown' ? 'unknown' : ipKeyGenerator(normalizedIp);
}

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientIp,
  message: {
    success: false,
    message: 'Terlalu banyak percobaan. Coba lagi dalam 15 menit.',
  },
});

const meLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientIp,
  message: {
    success: false,
    message: 'Terlalu banyak permintaan. Coba lagi nanti.',
  },
});

router.post('/register', authLimiter, asyncHandler(register));
router.post('/login', authLimiter, asyncHandler(login));
router.post('/cashiers', authenticate, authorize('OWNER'), asyncHandler(createCashier));
router.post('/logout', asyncHandler(logout));
router.get('/me', authenticate, meLimiter, asyncHandler(me));

export default router;
