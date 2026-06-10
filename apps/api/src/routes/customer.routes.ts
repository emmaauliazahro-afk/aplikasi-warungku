import { Router } from 'express';
import { asyncHandler } from '../middleware/error';
import { authenticate } from '../middleware/auth';
import {
  listCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from '../controllers/customer.controller';

const router = Router();

router.use(authenticate);

router.get('/', asyncHandler(listCustomers));
router.get('/:id', asyncHandler(getCustomer));
router.post('/', asyncHandler(createCustomer));
router.put('/:id', asyncHandler(updateCustomer));
router.delete('/:id', asyncHandler(deleteCustomer));

export default router;
