import { Router } from 'express';
import { asyncHandler } from '../middleware/error';
import { authenticate } from '../middleware/auth';
import { listDebts, getDebt, recordPayment } from '../controllers/debt.controller';

const router = Router();

router.use(authenticate);

router.get('/', asyncHandler(listDebts));
router.get('/:id', asyncHandler(getDebt));
router.post('/:id/payment', asyncHandler(recordPayment));

export default router;
