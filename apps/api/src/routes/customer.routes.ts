import { Router } from 'express';
import { asyncHandler } from '../middleware/error';
import { authenticate, authorize } from '../middleware/auth';
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
router.post('/', authorize('OWNER'), asyncHandler(createCustomer));
router.put('/:id', authorize('OWNER'), asyncHandler(updateCustomer));
router.delete('/:id', authorize('OWNER'), asyncHandler(deleteCustomer));

export default router;
