import { Router } from 'express';
import { asyncHandler } from '../middleware/error';
import { authenticate } from '../middleware/auth';
import { uploadCsv } from '../middleware/upload';
import {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  getStockMovements,
  adjustStock,
} from '../controllers/product.controller';
import { importProducts, downloadTemplate } from '../controllers/import.controller';

const router = Router();

// All product routes require authentication
router.use(authenticate);

// Import routes MUST be defined before '/:id' to avoid being captured by it
router.get('/import/template', downloadTemplate);
router.post('/import', uploadCsv, asyncHandler(importProducts));

router.get('/', asyncHandler(listProducts));
router.get('/:id', asyncHandler(getProduct));
router.post('/', asyncHandler(createProduct));
router.put('/:id', asyncHandler(updateProduct));
router.delete('/:id', asyncHandler(deleteProduct));

// Stock management
router.get('/:id/movements', asyncHandler(getStockMovements));
router.post('/:id/adjust-stock', asyncHandler(adjustStock));

export default router;
