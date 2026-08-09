import { Router } from 'express';
import { UserController } from '../controllers/userController';
import { 
  authenticateToken, 
  requirePermission,
  selfOrAdmin 
} from '../middleware/auth';
import { validate, validateQuery, userSchemas } from '../middleware/validation';
import { uploadProfilePicture } from '../middleware/upload';

const router = Router();
const userController = new UserController();

/**
 * @route GET /api/users
 * @desc Get all users with pagination and filtering
 * @access Private (Staff/Admin)
 */
router.get('/', 
  authenticateToken,
  requirePermission('settings:manage:users'),
  validateQuery(userSchemas.getUsersQuery),
  userController.getUsers
);

/**
 * @route GET /api/users/:id
 * @desc Get user by ID
 * @access Private (Self/Admin)
 */
router.get('/:id', 
  authenticateToken,
  selfOrAdmin('id'),
  userController.getUserById
);

/**
 * @route POST /api/users
 * @desc Create new user
 * @access Private (Admin only)
 */
router.post('/', 
  authenticateToken,
  requirePermission('settings:manage:users'),
  validate(userSchemas.createUser),
  userController.createUser
);

/**
 * @route PUT /api/users/:id
 * @desc Update user details
 * @access Private (Self/Admin)
 */
router.put('/:id', 
  authenticateToken,
  requirePermission('settings:manage:users'),
  validate(userSchemas.updateUser),
  userController.updateUser
);

/**
 * @route PUT /api/users/:id/status
 * @desc Update user status (activate/deactivate/ban)
 * @access Private (Admin only)
 */
router.put('/:id/status', 
  authenticateToken,
  requirePermission('settings:manage:users'),
  validate(userSchemas.updateUserStatus),
  userController.updateUserStatus
);

/**
 * @route DELETE /api/users/:id
 * @desc Delete user (soft delete)
 * @access Private (Admin only)
 */
router.delete('/:id', 
  authenticateToken,
  requirePermission('settings:manage:users'),
  userController.deleteUser
);

/**
 * @route GET /api/users/freelancers/list
 * @desc Get freelancers with location and skills
 * @access Private (Staff/Admin)
 */
router.get('/freelancers/list', 
  authenticateToken,
  requirePermission('freelancers:view:all'),
  validateQuery(userSchemas.getFreelancersQuery),
  userController.getFreelancers
);

/**
 * @route PUT /api/users/:id/freelancer-profile
 * @desc Update freelancer profile (location and skills)
 * @access Private (Self/Admin)
 */
router.put('/:id/freelancer-profile', 
  authenticateToken,
  selfOrAdmin('id'),
  validate(userSchemas.updateFreelancerProfile),
  userController.updateFreelancerProfile
);

/**
 * @route POST /api/users/:id/upload-avatar
 * @desc Upload user profile image
 * @access Private (Self/Admin)
 */
router.post('/:id/upload-avatar', 
  authenticateToken,
  selfOrAdmin('id'),
  uploadProfilePicture.single('avatar'),
  userController.uploadAvatar
);

export default router;