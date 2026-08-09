import { Router } from 'express';
import { SystemController } from '../controllers';
import { authenticateToken, requirePermission, requireAnyPermission } from '../middleware/auth';
import { validate, validateQuery, validateParams, systemSchemas } from '../middleware/validation';
import Joi from 'joi';

const router = Router();
const systemController = new SystemController();

// Local system schemas for this route file
const localSystemSchemas = {
  getSettingsQuery: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    search: Joi.string().max(255),
    category: Joi.string().max(100)
  }),
  createSetting: Joi.object({
    key: Joi.string().min(1).max(100).required(),
    value: Joi.string().required(),
    description: Joi.string().max(500),
    category: Joi.string().max(100).default('general'),
    is_public: Joi.boolean().default(false)
  }),
  updateSetting: Joi.object({
    // Accept either `value` or `setting_value`; require at least one
    value: Joi.string(),
    setting_value: Joi.string(),
    description: Joi.string().max(500),
    category: Joi.string().max(100),
    is_public: Joi.boolean()
  }).or('value', 'setting_value'),
  testEmail: Joi.object({
    recipient_email: Joi.string().email().required(),
    smtp: Joi.object({
      server: Joi.string().required(),
      port: Joi.number().integer().min(1).max(65535).required(),
      username: Joi.string().allow('').required(),
      password: Joi.string().allow('').required(),
      fromAddress: Joi.string().email().required(),
      security: Joi.string().valid('TLS', 'SSL', 'None').required()
    }).required()
  }),
  checkUpdateQuery: Joi.object({
    branch: Joi.string().max(80).optional()
  }),
  applyUpdateBody: Joi.object({
    branch: Joi.string().max(80).optional()
  })
};

// Get system dashboard statistics (Admin/Staff/Supervisor only)
router.get('/dashboard',
  authenticateToken,
  requirePermission('settings:view'),
  systemController.getDashboardStats
);

// Get system health status (Admin only)
router.get('/health',
  authenticateToken,
  requirePermission('system.admin'),
  systemController.getSystemHealth
);

// Get update process status (Admin only)
router.get('/update/status',
  authenticateToken,
  requirePermission('system.admin'),
  systemController.getUpdateStatus
);

// Check latest update from GitHub/remote (Admin only)
router.get('/update/check',
  authenticateToken,
  requirePermission('system.admin'),
  validateQuery(localSystemSchemas.checkUpdateQuery),
  systemController.checkSystemUpdate
);

// Trigger update script (Admin only)
router.post('/update/apply',
  authenticateToken,
  requirePermission('system.admin'),
  validate(localSystemSchemas.applyUpdateBody),
  systemController.applySystemUpdate
);

// Get public system settings (No auth required)
router.get('/settings/public',
  systemController.getPublicSettings
);

// Get all system settings (Admin only)
router.get('/settings',
  authenticateToken,
  requireAnyPermission(['settings:view', 'settings:manage:api']),
  validateQuery(localSystemSchemas.getSettingsQuery),
  systemController.getAllSettings
);

// Get system setting by key
router.get('/settings/:key',
  authenticateToken,
  requireAnyPermission(['settings:view', 'settings:manage:api']),
  validateParams(systemSchemas.settingKeyParam),
  systemController.getSettingByKey
);

// Create new system setting (Admin only)
router.post('/settings',
  authenticateToken,
  requirePermission('settings:manage:api'),
  validate(localSystemSchemas.createSetting),
  systemController.createSetting
);

// Update system setting (Admin only)
router.put('/settings/:key',
  authenticateToken,
  requirePermission('settings:manage:api'),
  validateParams(systemSchemas.settingKeyParam),
  validate(localSystemSchemas.updateSetting),
  systemController.updateSetting
);

// Send test email with current SMTP settings (Admin only)
router.post('/settings/test-email',
  authenticateToken,
  requirePermission('settings:manage:mail'),
  validate(localSystemSchemas.testEmail),
  systemController.sendTestEmail
);

// Delete system setting (Admin only)
router.delete('/settings/:key',
  authenticateToken,
  requirePermission('settings:manage:api'),
  validateParams(systemSchemas.settingKeyParam),
  systemController.deleteSetting
);

// Get activity logs (Admin/Staff/Supervisor only)
router.get('/activity-logs',
  authenticateToken,
  requirePermission('system.admin'),
  validateQuery(systemSchemas.getActivityLogsQuery),
  systemController.getActivityLogs
);

// Export activity logs (Admin only)
router.get('/activity-logs/export',
  authenticateToken,
  requirePermission('system.admin'),
  validateQuery(systemSchemas.exportLogsQuery),
  systemController.exportActivityLogs
);

// List available backup files (Admin only)
router.get('/backups',
  authenticateToken,
  requirePermission('system.admin'),
  systemController.listBackups
);

// Download specific backup file (Admin only)
router.get('/backups/download/:fileName',
  authenticateToken,
  requirePermission('system.admin'),
  systemController.downloadBackup
);

// Get system update version history - latest updates first (Admin only)
router.get('/update/version-history',
  authenticateToken,
  requirePermission('system.admin'),
  systemController.getSystemUpdateVersionHistory
);

// Get paginated system update logs with scrolling support (Admin only)
router.get('/update/logs',
  authenticateToken,
  requirePermission('system.admin'),
  validateQuery(localSystemSchemas.checkUpdateQuery),
  systemController.getSystemUpdateLogs
);

export default router;