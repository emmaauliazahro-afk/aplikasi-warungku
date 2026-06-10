import { Router } from 'express';
import { asyncHandler } from '../middleware/error';
import { authenticate } from '../middleware/auth';
import { getStats } from '../controllers/dashboard.controller';

const router = Router();

router.use(authenticate);
router.get('/stats', asyncHandler(getStats));

export default router;
