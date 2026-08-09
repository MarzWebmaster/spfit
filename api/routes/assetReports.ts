import { Router } from 'express';
import { AssetReportController } from '../controllers/assetReportController.ts';
import { authenticateToken } from '../middleware/auth.ts';

const router = Router();
const controller = new AssetReportController();

router.use(authenticateToken);

router.get('/top-updaters', controller.getTopUpdaters);
router.get('/update-logs', controller.getAssetUpdateLogs);

export default router;
