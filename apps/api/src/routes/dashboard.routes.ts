import { Router } from 'express';
import { asyncHandler } from '../middleware/error';
import { authenticate, authorize } from '../middleware/auth';
import { getStats } from '../controllers/dashboard.controller';

const router = Router();

router.use(authenticate);
// Dashboard stats include today's revenue + outstanding debt — restrict to OWNER.
router.get('/stats', authorize('OWNER'), asyncHandler(getStats));

export default router;
