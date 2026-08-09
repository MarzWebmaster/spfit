import { Router } from 'express';
import { TaskController } from '../controllers';
import { authenticateToken, requirePermission, requireAnyPermission } from '../middleware/auth';
import { validate, validateQuery, validateParams } from '../middleware/validation';
import { taskSchemas, reportSchemas, feedbackSchemas } from '../middleware/validation';
import { uploadTaskAttachment, uploadTaskReport } from '../middleware/upload';

const router = Router();
const taskController = new TaskController();

// Get all tasks (with pagination and filters)
router.get('/',
  authenticateToken,
  requireAnyPermission(['tasks:view:all', 'tasks:view:own', 'tasks:view:assigned']),
  validateQuery(taskSchemas.getTasksQuery),
  taskController.getAllTasks
);

// Get task by ID
router.get('/:id',
  authenticateToken,
  requireAnyPermission(['tasks:view:all', 'tasks:view:own', 'tasks:view:assigned']),
  validateParams(taskSchemas.taskIdParam),
  taskController.getTaskById
);

router.post('/:id/duplicate',
  authenticateToken,
  requirePermission('tasks:create'),
  validateParams(taskSchemas.taskIdParam),
  taskController.duplicateTask
);

// Create new task (Admin/Staff/Supervisor only)
router.post('/',
  authenticateToken,
  requirePermission('tasks:create'),
  uploadTaskAttachment.array('attachments', 5), // Max 5 attachments
  validate(taskSchemas.createTask),
  taskController.createTask
);

// Update task (Admin/Staff/Supervisor only)
router.put('/:id',
  authenticateToken,
  requirePermission('tasks:edit:all'),
  uploadTaskAttachment.array('attachments', 5), // Max 5 attachments
  validateParams(taskSchemas.taskIdParam),
  validate(taskSchemas.updateTask),
  taskController.updateTask
);

// Update task status (Admin/Staff/Supervisor only)
router.patch('/:id/status',
  authenticateToken,
  requireAnyPermission(['tasks:edit:all', 'tasks:submit_report', 'tasks:verify_report', 'payments:approve', 'payments:mark_paid']),
  validateParams(taskSchemas.taskIdParam),
  validate(taskSchemas.updateTaskStatus),
  taskController.updateTaskStatus
);

// Assign task to freelancer (Admin/Staff/Supervisor only)
router.patch('/:id/assign',
  authenticateToken,
  requirePermission('tasks:assign'),
  validateParams(taskSchemas.taskIdParam),
  validate(taskSchemas.assignTask),
  taskController.assignTask
);

// Delete one task attachment (Admin/Staff/Supervisor only)
router.delete('/:id/attachments/:attachmentId',
  authenticateToken,
  requirePermission('tasks:edit:all'),
  validateParams(taskSchemas.deleteAttachmentParam),
  taskController.deleteTaskAttachment
);

// Submit task report (Freelancer only - assigned to the task)
router.post('/:id/report',
  authenticateToken,
  requirePermission('tasks:submit_report'),
  uploadTaskReport.array('report_files', 10), // Max 10 report files
  validateParams(taskSchemas.taskIdParam),
  validate(reportSchemas.submitReport),
  taskController.submitTaskReport
);

// Submit task feedback (Admin/Staff/Supervisor only)
router.post('/:id/feedback',
  authenticateToken,
  requirePermission('tasks:verify_report'),
  validateParams(taskSchemas.taskIdParam),
  validate(feedbackSchemas.submitFeedback),
  taskController.submitTaskFeedback
);

// Delete task (Admin only)
router.delete('/:id',
  authenticateToken,
  requirePermission('tasks:delete'),
  validateParams(taskSchemas.taskIdParam),
  taskController.deleteTask
);

export default router;
