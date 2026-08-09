import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { AppDataSource } from '../config/database.ts';
import { User, UserStatus } from '../models/User.ts';
import { Role } from '../models/Role.ts';
import { ActivityLog, ActivityType } from '../models/ActivityLog.ts';
import { UserSession } from '../models/UserSession.ts';

interface Session {
  id: string;
  userId: number;
  token: string;
  expiresAt: Date;
  lastActivity: Date;
}

export interface JWTPayload {
  userId: number;
  email: string;
  roleId: number;
  roleName: string;
  iat?: number;
  exp?: number;
}

export interface LoginResult {
  success: boolean;
  message: string;
  user?: {
    id: number;
    name: string;
    email: string;
    role: string;
    roleId: number;
    status: string;
    permissions?: string[];
  };
  token?: string;
  sessionId?: string;
}

interface LoginLocationPayload {
  status: 'granted' | 'denied' | 'unsupported' | 'error' | 'timeout';
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  capturedAt?: string;
  error?: string;
}

const DEFAULT_SESSION_DURATION_MS = 24 * 60 * 60 * 1000;
const DEFAULT_REMEMBER_ME_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

function parseDurationToMs(value: string | undefined, fallbackMs: number): number {
  if (!value) return fallbackMs;

  const normalized = value.trim().toLowerCase();
  const match = normalized.match(/^(\d+)(ms|s|m|h|d)?$/);
  if (!match) return fallbackMs;

  const amount = Number(match[1]);
  const unit = match[2] || 'ms';

  switch (unit) {
    case 'ms':
      return amount;
    case 's':
      return amount * 1000;
    case 'm':
      return amount * 60 * 1000;
    case 'h':
      return amount * 60 * 60 * 1000;
    case 'd':
      return amount * 24 * 60 * 60 * 1000;
    default:
      return fallbackMs;
  }
}

export class AuthService {
  private userRepository = AppDataSource.getRepository(User);
  private roleRepository = AppDataSource.getRepository(Role);
  private activityLogRepository = AppDataSource.getRepository(ActivityLog);
  private sessionRepository = AppDataSource.getRepository(UserSession);

  /**
   * Generate JWT token and create session for user
   */
  async generateTokenAndSession(payload: Omit<JWTPayload, 'iat' | 'exp'>, ipAddress?: string, userAgent?: string, rememberMe = false): Promise<{ token: string; session: Session; expiresIn: string }> {
    const secret = process.env.JWT_SECRET;
    const expiresIn = rememberMe
      ? (process.env.JWT_REMEMBER_ME_EXPIRES_IN || '30d')
      : (process.env.JWT_EXPIRES_IN || '24h');

    if (!secret) {
      throw new Error('JWT_SECRET is not configured');
    }

    const token = jwt.sign(payload, secret, { expiresIn } as jwt.SignOptions);
    
    // Create session
    const session = await this.createSession(payload.userId, token, ipAddress, userAgent, rememberMe);
    
    return { token, session, expiresIn };
  }

  /**
   * Verify JWT token
   */
  verifyToken(token: string): JWTPayload {
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      throw new Error('JWT_SECRET is not configured');
    }

    try {
      return jwt.verify(token, secret) as JWTPayload;
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Hash password
   */
  async hashPassword(password: string): Promise<string> {
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || '10');
    return bcrypt.hash(password, saltRounds);
  }

  /**
   * Compare password with hash
   */
  async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Create session hash from token
   */
  createSessionHash(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Create user session in database
   */
  async createSession(userId: number, token: string, ipAddress?: string, userAgent?: string, rememberMe = false): Promise<Session> {
    const tokenHash = this.createSessionHash(token);
    const durationMs = rememberMe
      ? parseDurationToMs(process.env.JWT_REMEMBER_ME_EXPIRES_IN, DEFAULT_REMEMBER_ME_DURATION_MS)
      : parseDurationToMs(process.env.JWT_EXPIRES_IN, DEFAULT_SESSION_DURATION_MS);
    const expiresAt = new Date();
    expiresAt.setTime(expiresAt.getTime() + durationMs);

    const dbSession = this.sessionRepository.create({
      user_id: userId,
      token_hash: tokenHash,
      ip_address: ipAddress,
      user_agent: userAgent,
      expires_at: expiresAt,
      is_active: true,
      last_activity: new Date()
    });

    const savedSession = await this.sessionRepository.save(dbSession);

    // Convert to Session interface
    return {
      id: savedSession.id.toString(),
      userId: savedSession.user_id,
      token: token,
      expiresAt: savedSession.expires_at,
      lastActivity: savedSession.last_activity
    };
  }

  /**
   * Validate session by token
   */
  async validateSession(token: string): Promise<UserSession | null> {
    const tokenHash = this.createSessionHash(token);
    
    // Get session with user and role details
    const session = await this.sessionRepository.findOne({
      where: {
        token_hash: tokenHash,
        is_active: true
      },
      relations: ['user', 'user.role']
    });

    if (!session) {
      console.log('Session not found or inactive');
      return null;
    }

    // Check if session is expired
    if (session.expires_at < new Date()) {
      console.log('Session expired');
      await this.invalidateSession(tokenHash);
      return null;
    }

    // Validate user still exists and is active
    const user = await this.userRepository.findOne({
      where: { 
        id: session.user_id,
        status: UserStatus.AKTIF
      },
      relations: ['role']
    });

    if (!user) {
      console.log('User not found or not active');
      await this.invalidateSession(tokenHash);
      return null;
    }

    // Validate if password hasn't changed since session creation
    // This will invalidate all sessions if password is changed
    if (user.password_hash !== session.user.password_hash) {
      console.log('Password has changed since session creation');
      await this.invalidateSession(tokenHash);
      return null;
    }

    // Update last activity
    session.last_activity = new Date();
    await this.sessionRepository.save(session);

    return session;
  }

  /**
   * Invalidate session
   */
  async invalidateSession(tokenHash: string): Promise<void> {
    await this.sessionRepository.update(
      { token_hash: tokenHash },
      { is_active: false }
    );
  }

  /**
   * Invalidate all user sessions
   */
  async invalidateAllUserSessions(userId: number): Promise<void> {
    await this.sessionRepository.update(
      { user_id: userId },
      { is_active: false }
    );
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<void> {
    await this.sessionRepository
      .createQueryBuilder()
      .delete()
      .where('expires_at < :now', { now: new Date() })
      .execute();
  }

  /**
   * Authenticate user login
   */
  async login(
    email: string,
    password: string,
    ipAddress?: string,
    userAgent?: string,
    location?: LoginLocationPayload,
    rememberMe = false
  ): Promise<LoginResult & { expiresIn?: string }> {
    try {
      const shouldLog = process.env.NODE_ENV !== 'test' && !process.env.JEST_WORKER_ID;
      if (shouldLog) console.log('Login attempt for email:', email);
      
      // 1. Check if email exists and get full user data
      const user = await this.userRepository.findOne({
        where: { email },
        relations: ['role', 'role.permissions', 'sessions']
      });

      if (shouldLog) console.log('User found:', user ? 'Yes' : 'No');
      
      if (!user) {
        await this.logActivity(
          null as any,
          ActivityType.LOGIN,
          `Failed login attempt - user not found: ${email}`,
          ipAddress,
          userAgent
        );
        return {
          success: false,
          message: 'Invalid email or password'
        };
      }

      if (shouldLog) console.log('User status:', user.status);
      if (shouldLog) console.log('User role:', user.role);

      // 2. Check if user is active
      const statusVal = (user.status as any);
      const isActive = statusVal === UserStatus.AKTIF || (typeof statusVal === 'string' && statusVal.toLowerCase() === 'aktif');
      if (!isActive) {
        let message = 'Account is not active';
        if (statusVal === UserStatus.DISEKAT || (typeof statusVal === 'string' && statusVal.toLowerCase() === 'disekat')) {
          message = `Account is banned${user.ban_reason ? ': ' + user.ban_reason : ''}`;
        }
        await this.logActivity(
          user.id,
          ActivityType.LOGIN,
          `Failed login attempt - account ${user.status.toLowerCase()}: ${email}`,
          ipAddress,
          userAgent
        );
        if (shouldLog) console.log('User status check failed:', { status: user.status, expected: [UserStatus.AKTIF, 'Aktif'] });
        return {
          success: false,
          message
        };
      }

      // 3. Verify password
      const isPasswordValid = await this.comparePassword(password, user.password_hash);
      if (!isPasswordValid) {
        await this.logActivity(
          user.id,
          ActivityType.LOGIN,
          `Failed login attempt - invalid password: ${email}`,
          ipAddress,
          userAgent
        );
        return {
          success: false,
          message: 'Invalid email or password'
        };
      }

      // 4. Invalidate any existing sessions
      await this.invalidateAllUserSessions(user.id);

      // 5. Generate new JWT token and create session
      const tokenPayload: Omit<JWTPayload, 'iat' | 'exp'> = {
        userId: user.id,
        email: user.email,
        roleId: user.role_id,
        roleName: user.role.name
      };

      const { token, session, expiresIn } = await this.generateTokenAndSession(tokenPayload, ipAddress, userAgent, rememberMe);

      // 6. Log successful login
      await this.logActivity(
        user.id,
        ActivityType.LOGIN,
        `User logged in successfully`,
        ipAddress,
        userAgent,
        {
          sessionId: session.id,
          loginLocation: location || { status: 'unsupported' }
        }
      );

      // 7. Clean up expired sessions
      await this.cleanupExpiredSessions();

      return {
        success: true,
        message: 'Login successful',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role.name,
          roleId: user.role_id,
          status: user.status,
          permissions: Array.isArray(user.role?.permissions)
            ? user.role.permissions.map((p: any) => p.permission)
            : []
        },
        token,
        sessionId: session.id,
        expiresIn
      };

    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        message: 'An error occurred during login'
      };
    }
  }

  /**
   * Get user by ID with role information
   */
  async getUserById(userId: number): Promise<User | null> {
    return this.userRepository.findOne({
      where: { id: userId },
      relations: ['role']
    });
  }

  /**
   * Refresh JWT token
   */
  async refreshToken(oldToken: string, ipAddress?: string, userAgent?: string): Promise<{ success: boolean; token?: string; sessionId?: string; message: string }> {
    try {
      const payload = this.verifyToken(oldToken);
      
      // Get fresh user data
      const user = await this.getUserById(payload.userId);
      if (!user || user.status !== UserStatus.AKTIF) {
        return {
          success: false,
          message: 'User not found or inactive'
        };
      }

      // Generate new token and session
      const newTokenPayload: Omit<JWTPayload, 'iat' | 'exp'> = {
        userId: user.id,
        email: user.email,
        roleId: user.role_id,
        roleName: user.role.name
      };

      const { token: newToken, session: newSession } = await this.generateTokenAndSession(newTokenPayload, ipAddress, userAgent);

      // Invalidate old session
      await this.invalidateSession(this.createSessionHash(oldToken));

      return {
        success: true,
        token: newToken,
        sessionId: newSession.id,
        message: 'Token refreshed successfully'
      };

    } catch (error) {
      return {
        success: false,
        message: 'Invalid token'
      };
    }
  }

  /**
   * Log user activity
   */
  async logActivity(
    userId: number,
    activityType: ActivityType,
    description: string,
    ipAddress?: string,
    userAgent?: string,
    metadata?: any
  ): Promise<void> {
    try {
      const activityLog = this.activityLogRepository.create({
        user_id: userId,
        activity_type: activityType,
        description,
        ip_address: ipAddress,
        user_agent: userAgent,
        metadata
      });

      await this.activityLogRepository.save(activityLog);
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  }

  /**
   * Logout user (invalidate session and log activity)
   */
  async logout(token: string, ipAddress?: string, userAgent?: string): Promise<{ success: boolean; message: string }> {
    try {
      const tokenHash = this.createSessionHash(token);
      
      // Find and validate the session
      const session = await this.sessionRepository.findOne({
        where: { token_hash: tokenHash },
        relations: ['user']
      });

      if (session) {
        // Invalidate current session
        await this.invalidateSession(tokenHash);
        
        // Also invalidate any other active sessions for this user
        await this.invalidateAllUserSessions(session.user_id);
        
        // Log logout activity
        await this.logActivity(
          session.user_id,
          ActivityType.LOGOUT,
          'User logged out (all sessions terminated)',
          ipAddress,
          userAgent
        );

        // Clear any expired sessions
        await this.cleanupExpiredSessions();
      }

      return {
        success: true,
        message: 'Logged out successfully from all devices'
      };
    } catch (error) {
      console.error('Logout error:', error);
      return {
        success: false,
        message: 'Error during logout'
      };
    }
  }
}

export const authService = new AuthService();
