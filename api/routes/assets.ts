
import { Router } from 'express';
import { AssetController } from '../controllers/assetController.ts';
import { AssetImportController } from '../controllers/assetImportController.ts';
import { AssetScanController } from '../controllers/assetScanController.ts';
import { AssetIntelController } from '../controllers/assetIntelController.ts';
import { authenticateToken, requireAnyPermission, requirePermission } from '../middleware/auth.ts';
import { validate, validateParams, validateQuery, assetSchemas } from '../middleware/validation';
import { uploadMemory, uploadAssetAttachment } from '../middleware/upload.ts';
const router = Router();
const controller = new AssetController();
const importController = new AssetImportController();
const scanController = new AssetScanController();
const intelController = new AssetIntelController();

router.use(authenticateToken);

router.get('/',
  requireAnyPermission(['assets:view:all', 'assets:view:own', 'tasks:view:all', 'tasks:view:own', 'tasks:view:assigned', 'tasks:create', 'tasks:edit:all']),
  validateQuery(assetSchemas.getAssetsQuery),
  controller.getAll
);

router.get('/pairing-history',
  requireAnyPermission(['assets:view:all', 'assets:view:own', 'tasks:view:all']),
  controller.getPairingHistory
);

router.get('/intel/suggest',
  requireAnyPermission(['assets:view:all', 'assets:view:own', 'tasks:view:all', 'tasks:create', 'ai:masterlist:view']),
  intelController.suggest
);

router.get('/:id',
  requireAnyPermission(['assets:view:all', 'assets:view:own', 'tasks:view:all', 'tasks:view:own', 'tasks:view:assigned', 'tasks:create', 'tasks:edit:all']),
  validateParams(assetSchemas.assetIdParam),
  controller.getOne
);

router.get('/:id/update-logs',
  requireAnyPermission(['assets:view:all', 'assets:view:own', 'tasks:view:all', 'tasks:view:own', 'tasks:view:assigned']),
  validateParams(assetSchemas.assetIdParam),
  controller.getUpdateLogs
);

router.post('/',
  requirePermission('tasks:create'),
  validate(assetSchemas.createAsset),
  controller.create
);

router.put('/:id',
  requirePermission('tasks:edit:all'),
  validateParams(assetSchemas.assetIdParam),
  validate(assetSchemas.updateAsset),
  controller.update
);


router.delete('/:id',
  requirePermission('tasks:delete'),
  validateParams(assetSchemas.assetIdParam),
  controller.delete
);

// Import endpoints
router.post('/import/validate',
  requirePermission('tasks:create'),
  uploadMemory.single('file'),
  importController.validateFile
);

router.post('/import/process',
  requirePermission('tasks:create'),
  validate(assetSchemas.importAssets),
  importController.importAssets
);

// Scan (AI OCR) endpoints
// Step 1: Extract serial numbers from images via Gemini
router.post('/scan/extract',
  requirePermission('tasks:create'),
  uploadMemory.array('images', 10),
  scanController.extractSN
);

// Step 2: Confirm + upsert assets & assign user
router.post('/scan/upsert',
  requirePermission('tasks:create'),
  scanController.upsertAssets
);

// Asset attachments
router.post('/:id/attachments',
  requirePermission('tasks:create'),
  validateParams(assetSchemas.assetIdParam),
  uploadAssetAttachment.array('attachments', 5),
  controller.uploadAttachments
);

router.delete('/:id/attachments/:attachmentId',
  requirePermission('tasks:edit:all'),
  validateParams(assetSchemas.assetIdParam),
  controller.deleteAttachment
);

router.patch('/:id/attachments/:attachmentId',
  requirePermission('tasks:edit:all'),
  validateParams(assetSchemas.assetIdParam),
  controller.updateAttachment
);

export default router;
