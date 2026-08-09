import { Request, Response } from 'express';
import { In } from 'typeorm';
import { AuthService } from '../services/authService';
import { AppDataSource } from '../config/database';
import { User, UserStatus } from '../models/User';
import { UserProfile } from '../models/UserProfile';
import { RolePermission } from '../models/RolePermission';
import { Role } from '../models/Role';
import { Notification, NotificationType } from '../models/Notification';
import { ActivityType } from '../models/ActivityLog';
import { FreelancerLocation } from '../models/FreelancerLocation';
import { FreelancerSkill } from '../models/FreelancerSkill';
import { PasswordResetToken } from '../models/PasswordResetToken';
import { EmailService } from '../services/emailService';
import { AuditService } from '../services/auditService';
import crypto from 'crypto';

export class AuthController {
  private authService: AuthService;
  private emailService: EmailService;
  private userRepository = AppDataSource.getRepository(User);
  private userProfileRepository = AppDataSource.getRepository(UserProfile);
  private rolePermissionRepository = AppDataSource.getRepository(RolePermission);
  private roleRepository = AppDataSource.getRepository(Role);
  private notificationRepository = AppDataSource.getRepository(Notification);
  private freelancerLocationRepository = AppDataSource.getRepository(FreelancerLocation);
  private freelancerSkillRepository = AppDataSource.getRepository(FreelancerSkill);
  private passwordResetTokenRepository = AppDataSource.getRepository(PasswordResetToken);

  constructor() {
    this.authService = new AuthService();
    this.emailService = new EmailService();
  }

  /**
   * Notify all Admin & Staff users when a new freelancer registers
   */
  private async notifyAdminsNewFreelancer(newUser: User): Promise<void> {
    try {
      // Find Admin and Staff roles
      const adminStaffRoles = await this.roleRepository.find({
        where: [
          { name: 'Admin' },
          { name: 'Staff' },
          { name: 'Supervisor' }
        ]
      });

      if (adminStaffRoles.length === 0) return;

      const roleIds = adminStaffRoles.map(r => r.id);

      // Find all active Admin/Staff/Supervisor users
      const adminStaffUsers = await this.userRepository.find({
        where: {
          role_id: In(roleIds),
          status: UserStatus.AKTIF
        }
      });

      if (adminStaffUsers.length === 0) return;

      // Create notification for each admin/staff user
      const notifications = adminStaffUsers.map(adminUser =>
        this.notificationRepository.create({
          user_id: adminUser.id,
          task_id: undefined,
          type: NotificationType.REGISTRATION_FREELANCER,
          title: 'Pendaftaran Freelancer Baru',
          message: `Freelancer baru telah mendaftar: ${newUser.name} (${newUser.email || 'Tiada email'})`,
          is_read: false,
          created_at: new Date()
        })
      );

      await this.notificationRepository.save(notifications);
    } catch (error) {
      // Don't let notification failure break registration
      console.error('Failed to notify admins about new freelancer registration:', error);
    }
  }

  /**
   * User registration
   */
  register = async (req: Request, res: Response): Promise<void> => {
    try {
      const { name, email, password, phone, ic_number, locations, skills, experience } = req.body;
      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';

      // Check if user already exists
      const existingUser = await this.userRepository.findOne({
        where: { email }
      });

      if (existingUser) {
        res.status(400).json({
          success: false,
          message: 'User with this email already exists'
        });
        return;
      }

      // Hash password
      const passwordHash = await this.authService.hashPassword(password);

      // Create new user — public registration always gets Freelancer role (4)
      const newUser = this.userRepository.create({
        name,
        email,
        password_hash: passwordHash,
        role_id: 4,
        phone,
        ic_number,
        status: UserStatus.AKTIF,
        is_available: true,
        created_at: new Date(),
        updated_at: new Date()
      });

      const savedUser = await this.userRepository.save(newUser);
      await this.userProfileRepository.upsert({
        user_id: savedUser.id,
        phone,
        ic_number,
        experience: experience !== undefined ? Number(experience) : 0,
        is_available: true,
        created_at: new Date(),
        updated_at: new Date()
      }, ['user_id']);

      // Save service locations if provided
      if (Array.isArray(locations) && locations.length > 0) {
        const locationEntities = locations.map((loc: { district: string; state: string }) =>
          this.freelancerLocationRepository.create({
            user_id: savedUser.id,
            district: loc.district,
            state: loc.state,
            created_at: new Date()
          })
        );
        await this.freelancerLocationRepository.save(locationEntities);
      }

      // Save skills if provided
      if (Array.isArray(skills) && skills.length > 0) {
        const skillEntities = (skills as string[]).map(skill =>
          this.freelancerSkillRepository.create({
            user_id: savedUser.id,
            skill: skill.trim(),
            created_at: new Date()
          })
        );
        await this.freelancerSkillRepository.save(skillEntities);
      }

      // Log registration activity
      await this.authService.logActivity(
        savedUser.id,
        ActivityType.SYSTEM_ACCESS,
        'User registered successfully',
        clientIp,
        userAgent
      );

      // Notify Admin/Staff/Supervisor about new freelancer registration
      await this.notifyAdminsNewFreelancer(savedUser);

      // Get user with role information
      const userWithRole = await this.userRepository.findOne({
        where: { id: savedUser.id },
        relations: ['role', 'profile'],
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
          created_at: true,
          profile: {
            id: true,
            phone: true,
            ic_number: true,
            experience: true,
            rating: true,
            is_available: true,
            bank_name: true,
            bank_account_number: true,
            payment_email: true
          },
          role: {
            id: true,
            name: true,
            description: true
          }
        }
      });

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: { user: userWithRole }
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * User login
   */
  login = async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, password, location, rememberMe } = req.body;
      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';

      // 1. Invalidate any existing sessions for this IP/User-Agent
      const existingToken = req.headers.authorization?.split(' ')[1];
      if (existingToken) {
        await this.authService.logout(existingToken, clientIp, userAgent);
      }

      // 2. Attempt login
      const result = await this.authService.login(email, password, clientIp, userAgent, location, Boolean(rememberMe));

      if (!result.success) {
        res.status(401).json({
          success: false,
          message: result.message
        });
        return;
      }

      const cookieMaxAge = Boolean(rememberMe)
        ? 30 * 24 * 60 * 60 * 1000
        : 24 * 60 * 60 * 1000;

      // 3. Set session cookie
      res.cookie('sessionId', result.sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: cookieMaxAge
      });

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: result.user,
          accessToken: result.token,
          sessionId: result.sessionId, // Use actual session ID
          expiresIn: result.expiresIn || (Boolean(rememberMe) ? '30d' : '24h')
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * User logout
   */
  logout = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';

      if (userId) {
        const token = req.headers.authorization?.split(' ')[1];
        if (token) {
          await this.authService.logout(token, clientIp, userAgent);
        }
      }

      // Clear refresh token cookie
      res.clearCookie('refreshToken');

      res.json({
        success: true,
        message: 'Logout successful'
      });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Refresh access token
   */
  refreshToken = async (req: Request, res: Response): Promise<void> => {
    try {
      const refreshToken = req.cookies.refreshToken;

      if (!refreshToken) {
        res.status(401).json({
          success: false,
          message: 'Refresh token not provided'
        });
        return;
      }

      const result = await this.authService.refreshToken(refreshToken);

      if (!result.success) {
        res.clearCookie('refreshToken');
        res.status(401).json({
          success: false,
          message: result.message
        });
        return;
      }

      res.json({
        success: true,
        message: 'Token refreshed successfully',
        data: {
          accessToken: result.token,
          expiresIn: process.env.JWT_EXPIRES_IN || '1h'
        }
      });
    } catch (error) {
      console.error('Token refresh error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Get current user profile
   */
  getProfile = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
        return;
      }

      const user = await this.userRepository.findOne({
        where: { id: userId },
        relations: ['role', 'profile', 'freelancerLocations', 'freelancerSkills'],
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
          created_at: true,
          updated_at: true,
          profile: {
            id: true,
            phone: true,
            ic_number: true,
            experience: true,
            rating: true,
            is_available: true
          },
          role: {
            id: true,
            name: true,
            description: true
          }
        }
      });

      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      const normalizedUser = {
        ...user,
        phone: user.profile?.phone || user.phone,
        ic_number: user.profile?.ic_number || user.ic_number,
        experience: user.profile?.experience ?? user.experience,
        rating: user.profile?.rating ?? user.rating,
        is_available: user.profile?.is_available ?? user.is_available,
        bank_name: user.profile?.bank_name || '',
        bank_account_number: user.profile?.bank_account_number || '',
        payment_email: user.profile?.payment_email || user.email || ''
      };

      const permissions = user.role?.id
        ? (await this.rolePermissionRepository.find({ where: { role_id: user.role.id } })).map(p => p.permission)
        : [];

      res.json({
        success: true,
        message: 'Profile retrieved successfully',
        data: {
          user: {
            ...normalizedUser,
            roleId: user.role?.id,
            permissions
          }
        }
      });
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Change password
   */
  changePassword = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      const { currentPassword, newPassword } = req.body;
      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
        return;
      }

      const user = await this.userRepository.findOne({
        where: { id: userId }
      });

      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      // Verify current password
      const isCurrentPasswordValid = await this.authService.comparePassword(currentPassword, user.password_hash);
      if (!isCurrentPasswordValid) {
        // Log failed password change attempt
        await this.authService.logActivity(
          userId,
          ActivityType.PASSWORD_CHANGE_FAILED,
          'Failed password change attempt - incorrect current password',
          clientIp,
          userAgent
        );

        res.status(400).json({
          success: false,
          message: 'Current password is incorrect'
        });
        return;
      }

      // Hash new password
      const newPasswordHash = await this.authService.hashPassword(newPassword);

      // Update password
      await this.userRepository.update(userId, {
        password_hash: newPasswordHash,
        updated_at: new Date()
      });

      // Log successful password change
      await this.authService.logActivity(
        userId,
        ActivityType.PASSWORD_CHANGED,
        'Password changed successfully',
        clientIp,
        userAgent
      );

      res.json({
        success: true,
        message: 'Password changed successfully'
      });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Update user profile
   */
  updateProfile = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      const { name, phone, ic_number, experience, is_available, bank_name, bank_account_number, payment_email } = req.body;
      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
        return;
      }

      const user = await this.userRepository.findOne({
        where: { id: userId }
      });

      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      // Update users table (core account fields)
      const updateData: Partial<User> = {
        updated_at: new Date()
      };

      if (name !== undefined) updateData.name = name;

      await this.userRepository.update(userId, updateData);

      // Update user_profiles table (extended profile fields)
      await this.userProfileRepository.upsert({
        user_id: userId,
        ...(phone !== undefined && { phone }),
        ...(ic_number !== undefined && { ic_number }),
        ...(experience !== undefined && { experience }),
        ...(is_available !== undefined && { is_available }),
        ...(bank_name !== undefined && { bank_name }),
        ...(bank_account_number !== undefined && { bank_account_number }),
        ...(payment_email !== undefined && { payment_email }),
        updated_at: new Date()
      }, ['user_id']);

      // Log profile update
      await this.authService.logActivity(
        userId,
        ActivityType.PROFILE_UPDATED,
        'Profile updated successfully',
        clientIp,
        userAgent,
        { updatedFields: Object.keys(updateData) }
      );

      // Get updated user data
      const updatedUser = await this.userRepository.findOne({
        where: { id: userId },
        relations: ['role', 'profile'],
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
          created_at: true,
          updated_at: true,
          profile: {
            id: true,
            phone: true,
            ic_number: true,
            experience: true,
            rating: true,
            is_available: true,
            bank_name: true,
            bank_account_number: true,
            payment_email: true
          },
          role: {
            id: true,
            name: true,
            description: true
          }
        }
      });

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: {
          user: updatedUser ? {
            ...updatedUser,
            phone: updatedUser.profile?.phone || updatedUser.phone,
            ic_number: updatedUser.profile?.ic_number || updatedUser.ic_number,
            experience: updatedUser.profile?.experience ?? updatedUser.experience,
            rating: updatedUser.profile?.rating ?? updatedUser.rating,
            is_available: updatedUser.profile?.is_available ?? updatedUser.is_available,
            bank_name: updatedUser.profile?.bank_name || '',
            bank_account_number: updatedUser.profile?.bank_account_number || '',
            payment_email: updatedUser.profile?.payment_email || updatedUser.email || ''
          } : updatedUser
        }
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Check authentication status
   */
  checkAuth = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(200).json({
          success: false,
          authenticated: false,
          message: 'Not authenticated'
        });
        return;
      }

      const user = await this.userRepository.findOne({
        where: { id: userId },
        relations: ['role'],
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
          role: {
            id: true,
            name: true
          }
        }
      });

      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Authenticated',
        data: { user }
      });
    } catch (error) {
      console.error('Check auth error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Verify session token
   */
  verifySession = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Invalid session',
          valid: false
        });
        return;
      }

      // Check if user still exists and is active
      const user = await this.userRepository.findOne({
        where: { id: userId },
        relations: ['role'],
        select: {
          id: true,
          name: true,
          email: true,
          status: true
          ,
          role: {
            id: true,
            name: true
          }
        }
      });

      const statusVal = user?.status as any;
      const isActive = statusVal === UserStatus.AKTIF || (typeof statusVal === 'string' && statusVal.toLowerCase() === 'aktif');
      if (!user || !isActive) {
        res.status(401).json({
          success: false,
          message: 'User not found or inactive',
          valid: false
        });
        return;
      }

      const permissions = user.role?.id
        ? (await this.rolePermissionRepository.find({ where: { role_id: user.role.id } })).map(p => p.permission)
        : [];

      res.json({
        success: true,
        message: 'Session valid',
        valid: true,
        data: {
          user: {
            ...user,
            roleId: user.role?.id,
            role: user.role?.name,
            permissions
          }
        }
      });
    } catch (error) {
      console.error('Verify session error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        valid: false
      });
    }
  };

  /**
   * Forgot password - request password reset
   */
  forgotPassword = async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, captchaAnswer, number1, number2 } = req.body;
      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';

      // Validate captcha: check if captchaAnswer equals number1 + number2
      const expectedAnswer = number1 + number2;
      if (Number(captchaAnswer) !== expectedAnswer) {
        // Log failed captcha attempt in audit trail
        await AuditService.log({
          req,
          actionType: 'SYSTEM',
          tableName: 'users',
          description: `Failed password reset attempt: invalid captcha. IP: ${clientIp}, Email: ${email}`,
        });

        res.status(400).json({
          success: false,
          message: 'Jawapan keselamatan tidak betul. Sila cuba lagi.'
        });
        return;
      }

      // Find user by email
      const user = await this.userRepository.findOne({
        where: { email },
        relations: ['profile']
      });

      // Check if user exists
      if (!user) {
        // Log failed attempt in audit trail
        await AuditService.log({
          req,
          actionType: 'SYSTEM',
          tableName: 'users',
          description: `Failed password reset attempt: email not found. IP: ${clientIp}, Email: ${email}`,
        });

        // Return specific message for frontend to display
        res.json({
          success: false,
          message: 'Emel tidak dijumpai dalam sistem. Sila semak alamat emel anda.',
          errorType: 'EMAIL_NOT_FOUND'
        });
        return;
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

      // Save reset token to database
      const resetTokenEntity = this.passwordResetTokenRepository.create({
        user_id: user.id,
        token: resetToken,
        expires_at: expiresAt,
        used: false
      });

      await this.passwordResetTokenRepository.save(resetTokenEntity);

      // Send password reset email
      const emailSent = await this.emailService.sendPasswordResetEmail(
        user.email,
        user.name,
        resetToken
      );

      if (!emailSent) {
        console.warn(`Failed to send password reset email to ${user.email}`);
        // Log email send failure in audit trail
        await AuditService.log({
          req,
          userId: user.id,
          actionType: 'SYSTEM',
          tableName: 'users',
          description: `Password reset email failed to send for user ${user.email}`,
        });

        // Return specific error for email send failure
        res.json({
          success: false,
          message: 'Sistem email mengalami masalah. Sila hubungi admin untuk bantuan.',
          errorType: 'EMAIL_SEND_FAILED'
        });
        return;
      }

      // Log password reset request
      await this.authService.logActivity(
        user.id,
        ActivityType.PASSWORD_RESET_REQUESTED,
        'Password reset requested',
        clientIp,
        userAgent
      );

      // Log successful request in audit trail
      await AuditService.log({
        req,
        userId: user.id,
        actionType: 'SYSTEM',
        tableName: 'users',
        description: `Password reset request successful for user ${user.email}`,
      });

      res.json({
        success: true,
        message: 'Pautan reset kata laluan telah dihantar ke emel anda. Sila semak inbox (dan spam folder) anda.'
      });
    } catch (error) {
      console.error('Forgot password error:', error);
      
      // Log error in audit trail
      await AuditService.log({
        req: req as any,
        actionType: 'SYSTEM',
        tableName: 'users',
        description: `Password reset request error: ${error.message}`,
      });

      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Reset password with token
   */
  resetPassword = async (req: Request, res: Response): Promise<void> => {
    try {
      const { token, newPassword } = req.body;
      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';

      // Find valid reset token
      const resetToken = await this.passwordResetTokenRepository.findOne({
        where: { token, used: false },
        relations: ['user']
      });

      if (!resetToken) {
        res.status(400).json({
          success: false,
          message: 'Invalid or expired reset token'
        });
        return;
      }

      // Check if token is expired
      if (resetToken.expires_at < new Date()) {
        await this.passwordResetTokenRepository.update(resetToken.id, { used: true });
        res.status(400).json({
          success: false,
          message: 'Reset token has expired'
        });
        return;
      }

      const userId = resetToken.user_id;
      
      // Hash new password
      const newPasswordHash = await this.authService.hashPassword(newPassword);

      // Update user password
      await this.userRepository.update(userId, {
        password_hash: newPasswordHash,
        updated_at: new Date()
      });

      // Mark reset token as used
      await this.passwordResetTokenRepository.update(resetToken.id, { used: true });

      // Log successful password reset
      await this.authService.logActivity(
        userId,
        ActivityType.PASSWORD_RESET_COMPLETED,
        'Password reset completed successfully',
        clientIp,
        userAgent
      );

      res.json({
        success: true,
        message: 'Password has been reset successfully'
      });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

}
