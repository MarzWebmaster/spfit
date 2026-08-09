import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { authenticateToken, optionalAuth, rateLimit } from '../middleware/auth';
import { validate, authSchemas } from '../middleware/validation';

const router = Router();
const authController = new AuthController();

// Rate limiting for auth routes
const authRateLimit = rateLimit(50, 15 * 60 * 1000); // 50 requests per 15 minutes (increased to handle refresh token requests)
const loginRateLimit = rateLimit(5, 15 * 60 * 1000); // 5 attempts per 15 min (brute force protection) // 50 login attempts per 15 minutes (increased for testing)
const registerRateLimit = rateLimit(3, 60 * 60 * 1000); // 3 registration attempts per hour

/**
 * @route POST /api/auth/register
 * @desc User registration
 * @access Public
 */
router.post('/register', 
  registerRateLimit,
  validate(authSchemas.register),
  authController.register
);

/**
 * @route POST /api/auth/login
 * @desc User login
 * @access Public
 */
router.post('/login', 
  loginRateLimit,
  validate(authSchemas.login),
  authController.login
);

/**
 * @route POST /api/auth/logout
 * @desc User logout
 * @access Private
 */
router.post('/logout', 
  authenticateToken,
  authController.logout
);

/**
 * @route POST /api/auth/refresh-token
 * @desc Refresh access token
 * @access Public (requires refresh token in cookie)
 */
router.post('/refresh-token', 
  authRateLimit,
  authController.refreshToken
);

/**
 * @route GET /api/auth/profile
 * @desc Get current user profile
 * @access Private
 */
router.get('/profile', 
  authenticateToken,
  authController.getProfile
);

/**
 * @route PUT /api/auth/profile
 * @desc Update current user profile
 * @access Private
 */
router.put('/profile', 
  authenticateToken,
  validate(authSchemas.updateProfile),
  authController.updateProfile
);

/**
 * @route PUT /api/auth/change-password
 * @desc Change user password
 * @access Private
 */
router.put('/change-password', 
  authenticateToken,
  validate(authSchemas.changePassword),
  authController.changePassword
);

/**
 * @route GET /api/auth/status
 * @desc Check authentication status
 * @access Public (optional auth)
 */
router.get('/status', 
  optionalAuth,
  authController.checkAuth
);

/**
 * @route GET /api/auth/verify-session
 * @desc Verify session token
 * @access Private
 */
router.get('/verify-session', 
  authenticateToken,
  authController.verifySession
);

/**
 * @route POST /api/auth/forgot-password
 * @desc Request password reset
 * @access Public
 */
router.post('/forgot-password',
  authRateLimit,
  validate(authSchemas.forgotPassword),
  authController.forgotPassword
);

/**
 * @route POST /api/auth/reset-password
 * @desc Reset password with token
 * @access Public
 */
router.post('/reset-password',
  authRateLimit,
  validate(authSchemas.resetPassword),
  authController.resetPassword
);

export default router;
