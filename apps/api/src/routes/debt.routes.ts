import { Router } from 'express';
import { asyncHandler } from '../middleware/error';
import { authenticate, authorize } from '../middleware/auth';
import { userLimiter } from '../middleware/rate-limit';
import { listDebts, getDebt, recordPayment } from '../controllers/debt.controller';

const router = Router();

router.use(authenticate);

router.get('/', asyncHandler(listDebts));
router.get('/:id', asyncHandler(getDebt));
// Settling a debt is a financial control action — restrict to OWNER, with
// per-user rate limiting as a backstop.
router.post(
  '/:id/payment',
  authorize('OWNER'),
  userLimiter,
  asyncHandler(recordPayment)
);

export default router;
