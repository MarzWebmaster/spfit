
import { Router } from 'express';
import { getAuditLogs, exportAuditLogs } from '../controllers/auditController.js';
import { authenticateToken, requirePermission } from '../middleware/auth.js';

const router = Router();

// Only admin should see audit logs
router.get('/', authenticateToken, requirePermission('system.admin'), getAuditLogs);
router.get('/export', authenticateToken, requirePermission('system.admin'), exportAuditLogs);

export default router;
