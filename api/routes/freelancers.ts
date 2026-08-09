import { Router } from 'express';
import { FreelancerController } from '../controllers';
import { authenticateToken, requirePermission, requireAnyPermission, selfOrAdmin, freelancerOnly } from '../middleware/auth';
import { validate, validateQuery, validateParams } from '../middleware/validation';
import { userSchemas, taskSchemas, freelancerSchemas } from '../middleware/validation';

const router = Router();
const freelancerController = new FreelancerController();

// Get all freelancers (with filters and pagination)
router.get('/',
  authenticateToken,
  requireAnyPermission(['freelancers:view:all', 'freelancers:manage']),
  validateQuery(freelancerSchemas.getFreelancersQuery),
  freelancerController.getAllFreelancers
);

// Get freelancer profile by ID
router.get('/:id',
  authenticateToken,
  requireAnyPermission(['freelancers:view:all', 'freelancers:view:own', 'freelancers:manage', 'settings:manage:profile', 'tasks:view:assigned']),
  validateParams(userSchemas.userIdParam),
  freelancerController.getFreelancerProfile
);

// Update freelancer profile (self or admin)
router.put('/:id/profile',
  authenticateToken,
  requireAnyPermission(['settings:manage:profile', 'freelancers:manage']),
  selfOrAdmin('id'),
  validateParams(userSchemas.userIdParam),
  validate(freelancerSchemas.updateProfile),
  freelancerController.updateFreelancerProfile
);

// Get freelancer bank accounts
router.get('/:id/bank-accounts',
  authenticateToken,
  requireAnyPermission(['settings:manage:profile', 'freelancers:manage']),
  selfOrAdmin('id'),
  validateParams(userSchemas.userIdParam),
  freelancerController.getFreelancerBankAccounts
);

// Create freelancer bank account
router.post('/:id/bank-accounts',
  authenticateToken,
  requireAnyPermission(['settings:manage:profile', 'freelancers:manage']),
  selfOrAdmin('id'),
  validateParams(userSchemas.userIdParam),
  validate(freelancerSchemas.createBankAccount),
  freelancerController.createFreelancerBankAccount
);

// Update freelancer bank account
router.put('/:id/bank-accounts/:accountId',
  authenticateToken,
  requireAnyPermission(['settings:manage:profile', 'freelancers:manage']),
  selfOrAdmin('id'),
  validateParams(freelancerSchemas.bankAccountParams),
  validate(freelancerSchemas.updateBankAccount),
  freelancerController.updateFreelancerBankAccount
);

// Delete freelancer bank account
router.delete('/:id/bank-accounts/:accountId',
  authenticateToken,
  requireAnyPermission(['settings:manage:profile', 'freelancers:manage']),
  selfOrAdmin('id'),
  validateParams(freelancerSchemas.bankAccountParams),
  freelancerController.deleteFreelancerBankAccount
);

// Update freelancer availability (freelancer only - self)
router.patch('/:id/availability',
  authenticateToken,
  requirePermission('settings:manage:profile'),
  freelancerOnly,
  selfOrAdmin,
  validateParams(userSchemas.userIdParam),
  validate(freelancerSchemas.updateAvailability),
  freelancerController.updateAvailability
);

// Get freelancer's assigned tasks
router.get('/:id/tasks',
  authenticateToken,
  requireAnyPermission(['tasks:view:assigned', 'tasks:view:all']),
  selfOrAdmin,
  validateParams(userSchemas.userIdParam),
  validateQuery(taskSchemas.getTasksQuery),
  freelancerController.getFreelancerTasks
);

// Apply for a task (freelancer only)
router.post('/tasks/:taskId/apply',
  authenticateToken,
  requirePermission('tasks:view:assigned'),
  freelancerOnly,
  validateParams(taskSchemas.taskIdParam),
  freelancerController.applyForTask
);

// Get freelancer dashboard stats (freelancer only - self)
router.get('/:id/dashboard',
  authenticateToken,
  requirePermission('tasks:view:assigned'),
  freelancerOnly,
  selfOrAdmin,
  validateParams(userSchemas.userIdParam),
  freelancerController.getFreelancerDashboard
);

// Get available tasks for freelancer
router.get('/:id/available-tasks',
  authenticateToken,
  requirePermission('tasks:view:assigned'),
  freelancerOnly,
  selfOrAdmin,
  validateParams(userSchemas.userIdParam),
  validateQuery(taskSchemas.getTasksQuery),
  freelancerController.getAvailableTasks
);

export default router;