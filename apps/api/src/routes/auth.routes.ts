import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { asyncHandler } from '../middleware/error';
import { authenticate, authorize } from '../middleware/auth';
import { createCashier, register, login, me, logout } from '../controllers/auth.controller';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Terlalu banyak percobaan. Coba lagi dalam 15 menit.',
  },
});

router.post('/register', authLimiter, asyncHandler(register));
router.post('/login', authLimiter, asyncHandler(login));
router.post('/cashiers', authenticate, authorize('OWNER'), asyncHandler(createCashier));
router.post('/logout', asyncHandler(logout));
router.get('/me', authenticate, asyncHandler(me));

export default router;
