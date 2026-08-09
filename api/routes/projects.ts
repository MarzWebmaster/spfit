import { Router } from 'express';
import { ProjectController } from '../controllers/projectController.ts';
import { authenticateToken, requireAnyPermission, requirePermission } from '../middleware/auth.ts';
import { validate, validateParams, validateQuery, projectSchemas } from '../middleware/validation';

const router = Router();
const controller = new ProjectController();

router.use(authenticateToken);

router.get('/',
  requireAnyPermission(['projects:view:all', 'projects:view:own', 'tasks:view:all', 'tasks:view:own', 'tasks:view:assigned', 'tasks:create', 'tasks:edit:all']),
  validateQuery(projectSchemas.getProjectsQuery),
  controller.getAll
);

router.get('/:id',
  requireAnyPermission(['projects:view:all', 'projects:view:own', 'tasks:view:all', 'tasks:view:own', 'tasks:view:assigned', 'tasks:create', 'tasks:edit:all']),
  validateParams(projectSchemas.projectIdParam),
  controller.getOne
);

router.post('/',
  requirePermission('tasks:create'),
  validate(projectSchemas.createProject),
  controller.create
);

router.put('/:id',
  requirePermission('tasks:edit:all'),
  validateParams(projectSchemas.projectIdParam),
  validate(projectSchemas.updateProject),
  controller.update
);

router.delete('/:id',
  requirePermission('tasks:delete'),
  validateParams(projectSchemas.projectIdParam),
  controller.delete
);

export default router;
