import { Router } from 'express';
import { TaskReminderController } from '../controllers/taskReminderController.ts';
import { authenticateToken, requirePermission } from '../middleware/auth';

const router = Router();
const taskReminderController = new TaskReminderController();

router.get('/settings',
  authenticateToken,
  requirePermission('settings:manage:api'),
  taskReminderController.getGlobalSettings
);

router.put('/settings',
  authenticateToken,
  requirePermission('settings:manage:api'),
  taskReminderController.saveGlobalSettings
);

router.post('/arrival/confirm',
  taskReminderController.confirmArrival
);

router.post('/arrival/manual/:taskId',
  authenticateToken,
  requirePermission('tasks:edit:all'),
  taskReminderController.manuallyConfirmArrival
);

/**
 * @route GET /api/task-reminders
 * @desc Get all task reminders (Admin only)
 * @access Admin
 */
router.get('/',
  authenticateToken,
  requirePermission('system.admin'),
  taskReminderController.getAll
);

/**
 * @route GET /api/task-reminders/task/:taskId
 * @desc Get reminders for specific task
 * @access Authenticated
 */
router.get('/task/:taskId',
  authenticateToken,
  taskReminderController.getByTaskId
);

/**
 * @route POST /api/task-reminders
 * @desc Create new task reminder
 * @access Admin
 */
router.post('/',
  authenticateToken,
  requirePermission('system.admin'),
  taskReminderController.create
);

/**
 * @route PUT /api/task-reminders/:id
 * @desc Update task reminder
 * @access Admin
 */
router.put('/:id',
  authenticateToken,
  requirePermission('system.admin'),
  taskReminderController.update
);

/**
 * @route DELETE /api/task-reminders/:id
 * @desc Delete task reminder
 * @access Admin
 */
router.delete('/:id',
  authenticateToken,
  requirePermission('system.admin'),
  taskReminderController.delete
);

/**
 * @route POST /api/task-reminders/bulk-upsert
 * @desc Bulk upsert reminders for a task (replaces all for that task)
 * @access Admin
 */
router.post('/bulk-upsert',
  authenticateToken,
  requirePermission('system.admin'),
  taskReminderController.bulkUpsert
);

export default router;
