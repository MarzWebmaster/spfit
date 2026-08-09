import { Router } from 'express';
import { MainConController } from '../controllers/mainConController.ts';
import { authenticateToken, requireAnyPermission, requirePermission } from '../middleware/auth.ts';

const router = Router();
const controller = new MainConController();

// All routes protected
router.use(authenticateToken);

router.get('/', requireAnyPermission(['maincons:view:all', 'maincons:view:own', 'tasks:view:all', 'tasks:view:own', 'tasks:view:assigned', 'tasks:create', 'tasks:edit:all']), controller.getAll);
router.get('/:id', requireAnyPermission(['maincons:view:all', 'maincons:view:own', 'tasks:view:all', 'tasks:view:own', 'tasks:view:assigned', 'tasks:create', 'tasks:edit:all']), controller.getOne);
router.post('/', requirePermission('tasks:create'), controller.create);
router.put('/:id', requirePermission('tasks:edit:all'), controller.update);
router.delete('/:id', requirePermission('tasks:edit:all'), controller.delete);

export default router;
