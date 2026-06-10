import { Router } from 'express';
import { asyncHandler } from '../middleware/error';
import { authenticate } from '../middleware/auth';
import {
  createTransaction,
  listTransactions,
  getTransaction,
} from '../controllers/transaction.controller';

const router = Router();

router.use(authenticate);

router.get('/', asyncHandler(listTransactions));
router.get('/:id', asyncHandler(getTransaction));
router.post('/', asyncHandler(createTransaction));

export default router;
