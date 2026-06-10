import { Router } from 'express';
import { asyncHandler } from '../middleware/error';
import { authenticate } from '../middleware/auth';
import {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../controllers/category.controller';

const router = Router();

router.use(authenticate);

router.get('/', asyncHandler(listCategories));
router.post('/', asyncHandler(createCategory));
router.put('/:id', asyncHandler(updateCategory));
router.delete('/:id', asyncHandler(deleteCategory));

export default router;
