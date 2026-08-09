import { Router } from 'express';
import { MasterlistController } from '../controllers/masterlistController.ts';
import { authenticateToken, requireAnyPermission, requirePermission } from '../middleware/auth.ts';
import { validate, validateParams, validateQuery, masterlistSchemas } from '../middleware/validation';
import { uploadMasterlistDocument, uploadMemory } from '../middleware/upload.ts';

const router = Router();
const controller = new MasterlistController();

router.use(authenticateToken);

router.get('/',
  requireAnyPermission(['masterlists:view:all', 'masterlists:view:own', 'tasks:view:all', 'tasks:view:own', 'tasks:view:assigned', 'tasks:create', 'tasks:edit:all']),
  validateQuery(masterlistSchemas.getMasterlistsQuery),
  controller.getAll
);

router.get('/:id',
  requireAnyPermission(['masterlists:view:all', 'masterlists:view:own', 'tasks:view:all', 'tasks:view:own', 'tasks:view:assigned', 'tasks:create', 'tasks:edit:all']),
  validateParams(masterlistSchemas.masterlistIdParam),
  controller.getOne
);

router.post('/:id/duplicate',
  requirePermission('tasks:create'),
  validateParams(masterlistSchemas.masterlistIdParam),
  validate(masterlistSchemas.duplicateMasterlist),
  controller.duplicate
);

router.post('/import/validate',
  requirePermission('tasks:create'),
  uploadMemory.single('file'),
  controller.importValidate
);

router.post('/import/process',
  requirePermission('tasks:create'),
  controller.importProcess
);

router.post('/',
  requirePermission('tasks:create'),
  uploadMasterlistDocument.single('document'),
  validate(masterlistSchemas.createMasterlist),
  controller.create
);

router.put('/:id',
  requirePermission('tasks:edit:all'),
  validateParams(masterlistSchemas.masterlistIdParam),
  uploadMasterlistDocument.single('document'),
  validate(masterlistSchemas.updateMasterlist),
  controller.update
);

router.get('/:id/export',
  requireAnyPermission(['masterlists:view:all', 'masterlists:view:own', 'tasks:view:all', 'tasks:view:own', 'tasks:view:assigned', 'tasks:create', 'tasks:edit:all']),
  validateParams(masterlistSchemas.masterlistIdParam),
  controller.exportData
);

router.delete('/:id/work-links/:index',
  requirePermission('tasks:edit:all'),
  validateParams(masterlistSchemas.masterlistItemIndexParam),
  controller.deleteWorkLink
);

router.delete('/:id/work-documents/:index',
  requirePermission('tasks:edit:all'),
  validateParams(masterlistSchemas.masterlistItemIndexParam),
  controller.deleteWorkDocument
);

router.delete('/:id',
  requirePermission('tasks:delete'),
  validateParams(masterlistSchemas.masterlistIdParam),
  controller.delete
);

export default router;
