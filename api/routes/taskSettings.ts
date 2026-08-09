import { Router } from 'express';
import { authenticateToken, requireAnyPermission, requireRole } from '../middleware/auth';
import { TaskSettingController } from '../controllers/taskSettingController.ts';

const router = Router();
const taskSettingController = new TaskSettingController();

router.get('/',
  authenticateToken,
  requireAnyPermission(['tasks:view:all', 'tasks:view:assigned', 'tasks:create', 'tasks:edit:all', 'settings:view', 'settings:manage:api']),
  taskSettingController.getAllActive
);

router.post('/statuses',
  authenticateToken,
  requireAnyPermission(['settings:manage:api', 'tasks:edit:all']),
  taskSettingController.createStatus
);

router.put('/statuses/:id',
  authenticateToken,
  requireAnyPermission(['settings:manage:api', 'tasks:edit:all']),
  taskSettingController.updateStatus
);

router.delete('/statuses/:id',
  authenticateToken,
  requireRole(['Admin']),
  taskSettingController.deleteStatus
);

router.post('/support-types',
  authenticateToken,
  requireAnyPermission(['settings:manage:api', 'tasks:edit:all']),
  taskSettingController.createSupportType
);

router.put('/support-types/:id',
  authenticateToken,
  requireAnyPermission(['settings:manage:api', 'tasks:edit:all']),
  taskSettingController.updateSupportType
);

router.delete('/support-types/:id',
  authenticateToken,
  requireAnyPermission(['settings:manage:api', 'tasks:edit:all']),
  taskSettingController.deleteSupportType
);

router.post('/equipment-codes',
  authenticateToken,
  requireAnyPermission(['settings:manage:api', 'tasks:edit:all']),
  taskSettingController.createEquipmentCode
);

router.put('/equipment-codes/:id',
  authenticateToken,
  requireAnyPermission(['settings:manage:api', 'tasks:edit:all']),
  taskSettingController.updateEquipmentCode
);

router.delete('/equipment-codes/:id',
  authenticateToken,
  requireAnyPermission(['settings:manage:api', 'tasks:edit:all']),
  taskSettingController.deleteEquipmentCode
);

export default router;