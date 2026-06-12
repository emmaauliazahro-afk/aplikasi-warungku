import { Router } from 'express';
import { asyncHandler } from '../middleware/error';
import { authenticate, authorize } from '../middleware/auth';
import { getSalesReport, exportSalesCsv, getTopProducts } from '../controllers/report.controller';

const router = Router();
router.use(authenticate);
// Reports contain business-wide revenue/profit data — restrict to OWNER.
router.get('/sales', authorize('OWNER'), asyncHandler(getSalesReport));
router.get('/sales/export', authorize('OWNER'), asyncHandler(exportSalesCsv));
router.get('/top-products', authorize('OWNER'), asyncHandler(getTopProducts));

export default router;
