import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';
import { createCashierFromSettings, getSettings, listCashiers, updateSettings } from '../controllers/settings.controller';

const router = Router();
router.use(authenticate, authorize('OWNER'));
router.get('/', asyncHandler(getSettings));
router.put('/', asyncHandler(updateSettings));
router.get('/cashiers', asyncHandler(listCashiers));
router.post('/cashiers', asyncHandler(createCashierFromSettings));
export default router;
