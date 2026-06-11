import { Router } from 'express';
import { asyncHandler } from '../middleware/error';
import { authenticate, authorize } from '../middleware/auth';
import {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../controllers/category.controller';

const router = Router();

router.use(authenticate);

router.get('/', asyncHandler(listCategories));
router.post('/', authorize('OWNER'), asyncHandler(createCategory));
router.put('/:id', authorize('OWNER'), asyncHandler(updateCategory));
router.delete('/:id', authorize('OWNER'), asyncHandler(deleteCategory));

export default router;
