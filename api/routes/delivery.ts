import { Router } from 'express';
import { getDeliveryLogs } from '../controllers/deliveryController.ts';
import { authenticateToken, requirePermission } from '../middleware/auth.js';

const router = Router();
router.get('/', authenticateToken, requirePermission('system.admin'), getDeliveryLogs);
export default router;
