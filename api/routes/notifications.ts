import { Router } from 'express';
import { NotificationController } from '../controllers';
import { authenticateToken, requireAnyPermission, requirePermission } from '../middleware/auth';
import { validate, validateQuery, validateParams, notificationSchemas } from '../middleware/validation';
import { commonSchemas } from '../middleware/validation';
import Joi from 'joi';

const router = Router();
const notificationController = new NotificationController();

// Local notification schemas for this route file
const localNotificationSchemas = {
  getNotificationsQuery: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    is_read: Joi.boolean(),
    type: Joi.string().valid('task_assigned', 'task_completed', 'task_feedback', 'system_announcement', 'task_application'),
    priority: Joi.string().valid('low', 'medium', 'high'),
    date_from: Joi.date().iso(),
    date_to: Joi.date().iso().min(Joi.ref('date_from'))
  })
};

// Get user's notifications (with pagination and filters)
router.get('/',
  authenticateToken,
  requireAnyPermission(['notifications:view:all', 'notifications:view:own', 'notifications:view']),
  validateQuery(localNotificationSchemas.getNotificationsQuery),
  notificationController.getUserNotifications
);

// Get all unified notifications (WhatsApp, in-app, templates)
router.get('/all',
  authenticateToken,
  requireAnyPermission(['notifications:view:all', 'notifications:view:own', 'notifications:view']),
  notificationController.getAllNotifications
);

// Get notification by ID
router.get('/:id',
  authenticateToken,
  requireAnyPermission(['notifications:view:all', 'notifications:view:own', 'notifications:view']),
  validateParams(notificationSchemas.notificationIdParam),
  notificationController.getNotificationById
);

// Mark notification as read
router.patch('/:id/read',
  authenticateToken,
  requireAnyPermission(['notifications:view:all', 'notifications:view:own', 'notifications:view']),
  validateParams(notificationSchemas.notificationIdParam),
  notificationController.markAsRead
);

// Mark all notifications as read
router.patch('/mark-all-read',
  authenticateToken,
  requireAnyPermission(['notifications:view:all', 'notifications:view:own', 'notifications:view']),
  notificationController.markAllAsRead
);

// Delete notification
router.delete('/:id',
  authenticateToken,
  requireAnyPermission(['notifications:view:all', 'notifications:view:own', 'notifications:view']),
  validateParams(notificationSchemas.notificationIdParam),
  notificationController.deleteNotification
);

// Delete all read notifications
router.delete('/read/all',
  authenticateToken,
  requireAnyPermission(['notifications:view:all', 'notifications:view:own', 'notifications:view']),
  notificationController.deleteAllRead
);

// Get notification statistics
router.get('/stats/summary',
  authenticateToken,
  requireAnyPermission(['notifications:view:all', 'notifications:view:own', 'notifications:view']),
  notificationController.getNotificationStats
);

// Create notification (Admin/Staff/Supervisor only)
router.post('/',
  authenticateToken,
  requirePermission('notifications:view'),
  validate(notificationSchemas.createNotification),
  notificationController.createNotification
);

// Broadcast notification to multiple users/roles (Admin only)
router.post('/broadcast',
  authenticateToken,
  requirePermission('notifications:view'),
  validate(notificationSchemas.broadcastNotification),
  notificationController.broadcastNotification
);

export default router;