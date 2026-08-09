import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { authService, JWTPayload } from '../services/authService.js';
import { AppDataSource } from '../config/database.js';
import { RolePermission } from '../models/RolePermission.js';
import { User, UserStatus } from '../models/User.js';
import { ApiKey } from '../models/ApiKey.js';

// Extend Express Request interface to include user data
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
        role: string;
      };
      userPermissions?: string[];
    }
  }
}

/**
 * JWT Authentication Middleware
 * Verifies JWT token and adds user data to request
 */
export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    // No JWT token? Try x-api-key fallback
    if (!token) {
      const apiKeyHeader = req.headers['x-api-key'] as string | undefined;
      if (apiKeyHeader) {
        return authenticateApiKey(req, res, next);
      }
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    // Verify token format
    const payload = authService.verifyToken(token);
    
    // Then validate session
    const session = await authService.validateSession(token);
    if (!session) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired session'
      });
    }
    
    // Get fresh user data for additional validation
    const user = await authService.getUserById(payload.userId);
    
    if (!user || user.status !== UserStatus.AKTIF) {
      await authService.invalidateSession(authService.createSessionHash(token));
      return res.status(401).json({
        success: false,
        message: 'User not found or inactive'
      });
    }
    
    // Verify that session belongs to correct user
    if (session.user_id !== user.id) {
      await authService.invalidateSession(authService.createSessionHash(token));
      return res.status(401).json({
        success: false,
        message: 'Invalid session'
      });
    }

    // Add user data to request in the format expected by controllers
    req.user = {
      id: payload.userId,
      email: payload.email,
      role: payload.roleName
    };
    next();

  } catch (error) {
    return res.status(403).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
};

/**
 * Optional Authentication Middleware
 * Adds user data to request if token is provided, but doesn't require it
 */
export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const payload = authService.verifyToken(token);
      const user = await authService.getUserById(payload.userId);
      
      if (user && user.status === UserStatus.AKTIF) {
        req.user = {
          id: payload.userId,
          email: payload.email,
          role: payload.roleName
        };
      }
    }

    next();
  } catch (error) {
    // Continue without authentication if token is invalid
    next();
  }
};

/**
 * Role-based Authorization Middleware
 * Checks if user has required role
 */
export const requireRole = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const userRole = req.user.role.toLowerCase();
    const allowed = allowedRoles.some(role => role.toLowerCase() === userRole);
    if (!allowed) {
      console.log('Role check failed:', { userRole, allowedRoles });
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    next();
  };
};

/**
 * Permission-based Authorization Middleware
 * Checks if user has required permission
 */
export const requirePermission = (requiredPermission: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      // Admin bypass
      if (req.user.role?.toLowerCase() === 'admin') {
        return next();
      }

      // Get user permissions if not already loaded
      if (!req.userPermissions) {
        const rolePermissionRepository = AppDataSource.getRepository(RolePermission);
        // Get role ID from user data
        const userRepository = AppDataSource.getRepository(User);
        const user = await userRepository.findOne({
          where: { id: req.user.id },
          relations: ['role']
        });
        
        if (!user) {
          return res.status(401).json({
            success: false,
            message: 'User not found'
          });
        }
        
        const permissions = await rolePermissionRepository.find({
          where: { role_id: user.role_id }
        });
        req.userPermissions = permissions.map(p => p.permission);
      }

      if (!req.userPermissions.includes(requiredPermission)) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions'
        });
      }

      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Error checking permissions'
      });
    }
  };
};

function hashApiKey(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

/**
 * API Key Authentication Middleware
 * Verifies the x-api-key header against stored API key hashes.
 * On success, attaches basic API key context to the request.
 */
export const authenticateApiKey = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const apiKeyHeader = req.headers['x-api-key'] as string | undefined;
    if (!apiKeyHeader) {
      return res.status(401).json({
        success: false,
        message: 'API key required. Provide it in the x-api-key header.'
      });
    }

    const normalizedKey = apiKeyHeader.trim();
    if (!normalizedKey) {
      return res.status(401).json({
        success: false,
        message: 'API key cannot be empty.'
      });
    }

    const hash = hashApiKey(normalizedKey);

    const apiKeyRepository = AppDataSource.getRepository(ApiKey);
    const apiKey = await apiKeyRepository.findOne({
      where: { key_hash: hash, status: 'active' }
    });

    if (!apiKey) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or revoked API key.'
      });
    }

    if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
      return res.status(401).json({
        success: false,
        message: 'API key has expired.'
      });
    }

    apiKey.last_used_at = new Date();
    await apiKeyRepository.save(apiKey).catch(() => {});

    req.user = {
      id: -(apiKey.id + 1000),
      email: 'apikey-' + apiKey.id + '@system.spfit',
      role: 'Admin'
    };

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error authenticating API key'
    });
  }
};

/**
 * Hybrid Authentication Middleware
 * Tries JWT Bearer token first, falls back to x-api-key if no Authorization header.
 * Sets req.user in both paths so permission/role middleware works transparently.
 */
export const authenticateTokenOrApiKey = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const authHeader = req.headers.authorization;
    const apiKeyHeader = req.headers['x-api-key'] as string | undefined;

    if (authHeader) {
      return authenticateToken(req, res, next);
    }

    if (apiKeyHeader) {
      return authenticateApiKey(req, res, next);
    }

    return res.status(401).json({
      success: false,
      message: 'Authentication required. Provide Authorization: Bearer <token> or x-api-key header.'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error authenticating request'
    });
  }
};

/**
 * Permission-based Authorization Middleware (ANY)
 * Checks if user has at least one of required permissions
 */
export const requireAnyPermission = (requiredPermissions: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      // Admin bypass
      if (req.user.role?.toLowerCase() === 'admin') {
        return next();
      }

      if (!req.userPermissions) {
        const rolePermissionRepository = AppDataSource.getRepository(RolePermission);
        const userRepository = AppDataSource.getRepository(User);

        const user = await userRepository.findOne({
          where: { id: req.user.id },
          relations: ['role']
        });

        if (!user) {
          return res.status(401).json({
            success: false,
            message: 'User not found'
          });
        }

        const permissions = await rolePermissionRepository.find({
          where: { role_id: user.role_id }
        });

        req.userPermissions = permissions.map(p => p.permission);
      }

      const hasAny = requiredPermissions.some(permission => req.userPermissions!.includes(permission));
      if (!hasAny) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions'
        });
      }

      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Error checking permissions'
      });
    }
  };
};

/**
 * Admin Only Middleware
 * Shortcut for admin-only routes
 */
export const adminOnly = requireRole(['Admin', 'ADMIN']);

/**
 * Staff or Admin Middleware
 * For routes accessible by staff and admin
 */
export const staffOrAdmin = requireRole(['Staff', 'Admin']);

/**
 * Supervisor or Admin Middleware
 * For routes accessible by supervisor and admin
 */
export const supervisorOrAdmin = requireRole(['Supervisor', 'Admin']);

/**
 * Freelancer Only Middleware
 * For freelancer-specific routes
 */
export const freelancerOnly = requireRole(['Freelancer']);

/**
 * Self or Admin Middleware
 * Allows users to access their own data or admin to access any data
 */
export const selfOrAdmin = (userIdParam: string = 'id') => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const targetUserId = parseInt(req.params[userIdParam]);
    const isAdmin = req.user.role === 'Admin';
    const isSelf = req.user.id === targetUserId;

    if (!isAdmin && !isSelf) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    next();
  };
};

/**
 * Rate Limiting Middleware
 * Basic rate limiting based on IP address
 */
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export const rateLimit = (maxRequests: number = 100, windowMs: number = 15 * 60 * 1000) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();
    
    const clientData = rateLimitStore.get(clientIp);
    
    if (!clientData || now > clientData.resetTime) {
      // Reset or initialize
      rateLimitStore.set(clientIp, {
        count: 1,
        resetTime: now + windowMs
      });
      return next();
    }
    
    if (clientData.count >= maxRequests) {
      return res.status(429).json({
        success: false,
        message: 'Too many requests, please try again later'
      });
    }
    
    clientData.count++;
    next();
  };
};

/**
 * Permission-based Authorization Middleware (Strict)
 * Checks if user has required permission without admin bypass
 */
export const requirePermissionStrict = (requiredPermission: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      if (!req.userPermissions) {
        const rolePermissionRepository = AppDataSource.getRepository(RolePermission);
        const userRepository = AppDataSource.getRepository(User);

        const user = await userRepository.findOne({
          where: { id: req.user.id },
          relations: ['role']
        });

        if (!user) {
          return res.status(401).json({
            success: false,
            message: 'User not found'
          });
        }

        const permissions = await rolePermissionRepository.find({
          where: { role_id: user.role_id }
        });

        req.userPermissions = permissions.map(p => p.permission);
      }

      if (!req.userPermissions.includes(requiredPermission)) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions'
        });
      }

      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Error checking permissions'
      });
    }
  };
};