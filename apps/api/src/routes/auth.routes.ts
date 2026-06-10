import { Router } from 'express';
import { asyncHandler } from '../middleware/error';
import { authenticate } from '../middleware/auth';
import { register, login, me, logout } from '../controllers/auth.controller';

const router = Router();

router.post('/register', asyncHandler(register));
router.post('/login', asyncHandler(login));
router.post('/logout', asyncHandler(logout));
router.get('/me', authenticate, asyncHandler(me));

export default router;
