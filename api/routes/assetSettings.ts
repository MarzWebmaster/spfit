import { Router } from 'express';
import { authenticateToken, requireAnyPermission } from '../middleware/auth';
import { AssetSettingController } from '../controllers/assetSettingController.ts';

const router = Router();
const assetSettingController = new AssetSettingController();

router.get('/',
  authenticateToken,
  requireAnyPermission(['settings:view', 'settings:manage:api', 'tasks:edit:all']),
  assetSettingController.getAllActive
);

router.post('/categories',
  authenticateToken,
  requireAnyPermission(['settings:manage:api', 'tasks:edit:all']),
  assetSettingController.createCategory
);

router.put('/categories/:id',
  authenticateToken,
  requireAnyPermission(['settings:manage:api', 'tasks:edit:all']),
  assetSettingController.updateCategory
);

router.delete('/categories/:id',
  authenticateToken,
  requireAnyPermission(['settings:manage:api', 'tasks:edit:all']),
  assetSettingController.deleteCategory
);

router.post('/brands',
  authenticateToken,
  requireAnyPermission(['settings:manage:api', 'tasks:edit:all']),
  assetSettingController.createBrand
);

router.put('/brands/:id',
  authenticateToken,
  requireAnyPermission(['settings:manage:api', 'tasks:edit:all']),
  assetSettingController.updateBrand
);

router.delete('/brands/:id',
  authenticateToken,
  requireAnyPermission(['settings:manage:api', 'tasks:edit:all']),
  assetSettingController.deleteBrand
);

export default router;
