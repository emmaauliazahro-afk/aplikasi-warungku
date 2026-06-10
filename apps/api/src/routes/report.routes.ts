import { Router } from 'express';
import { asyncHandler } from '../middleware/error';
import { authenticate } from '../middleware/auth';
import { getSalesReport, exportSalesCsv, getTopProducts } from '../controllers/report.controller';

const router = Router();
router.use(authenticate);

router.get('/sales', asyncHandler(getSalesReport));
router.get('/sales/export', asyncHandler(exportSalesCsv));
router.get('/top-products', asyncHandler(getTopProducts));

export default router;
