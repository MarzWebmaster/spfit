import { Request, Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { AppDataSource } from '../config/database';
import { SystemSettings } from '../models/SystemSettings';
import { ActivityLog, ActivityType } from '../models/ActivityLog';
import { User, UserStatus } from '../models/User';
import { Task, TaskStatus } from '../models/Task';
import { Notification } from '../models/Notification';
import { AuthService } from '../services/authService';
import { encrypt, decrypt, isSensitiveKey, isEncrypted } from '../utils/encryption';
import nodemailer from 'nodemailer';
import { AuditService } from '../services/auditService';
import { systemUpdateService } from '../services/systemUpdateService';



export class SystemController {
  private systemSettingsRepository = AppDataSource.getRepository(SystemSettings);
  private activityLogRepository = AppDataSource.getRepository(ActivityLog);
  private userRepository = AppDataSource.getRepository(User);
  private taskRepository = AppDataSource.getRepository(Task);
  private notificationRepository = AppDataSource.getRepository(Notification);
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }



  /**
   * Get all system settings (Admin only)
   */
  getAllSettings = async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        page = 1,
        limit = 50,
        is_active,
        data_type,
        search
      } = req.query;

      const skip = (Number(page) - 1) * Number(limit);
      const queryBuilder = this.systemSettingsRepository.createQueryBuilder('setting');

      // Apply filters
      if (is_active !== undefined) {
        queryBuilder.andWhere('setting.is_active = :is_active', { 
          is_active: is_active === 'true' 
        });
      }

      if (data_type) {
        queryBuilder.andWhere('setting.data_type = :data_type', { data_type });
      }

      if (search) {
        queryBuilder.andWhere(
          '(setting.setting_key LIKE :search OR setting.description LIKE :search)',
          { search: `%${search}%` }
        );
      }

      // Apply sorting and pagination
      queryBuilder
        .orderBy('setting.setting_key', 'ASC')
        .skip(skip)
        .take(Number(limit));

      const [settings, total] = await queryBuilder.getManyAndCount();

      // Decrypt sensitive settings for admin view
      const decryptedSettings = settings.map(setting => {
        if (isSensitiveKey(setting.setting_key)) {
            const decrypted = decrypt(setting.setting_value);
            if (decrypted) {
                return { ...setting, setting_value: decrypted };
            }
        }
        return setting;
      });

      res.json({
        success: true,
        message: 'System settings retrieved successfully',
        data: {
          settings: decryptedSettings,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            pages: Math.ceil(total / Number(limit))
          }
        }
      });
    } catch (error) {
      console.error('Get system settings error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Get system setting by key
   */
  getSettingByKey = async (req: Request, res: Response): Promise<void> => {
    try {
      const { key } = req.params;

      const setting = await this.systemSettingsRepository.findOne({
        where: { setting_key: key }
      });

      if (!setting) {
        res.status(404).json({
          success: false,
          message: 'System setting not found'
        });
        return;
      }

      // Decrypt if sensitive
      if (isSensitiveKey(setting.setting_key)) {
          const decrypted = decrypt(setting.setting_value);
          if (decrypted) {
              setting.setting_value = decrypted;
              
              // Log sensitive key access
              if (req.user?.id) {
                await this.authService.logActivity(
                  req.user.id,
                  ActivityType.SYSTEM_SETTING_VIEWED,
                  `Viewed sensitive setting: ${key}`,
                  req.ip || 'unknown',
                  req.get('User-Agent') || 'unknown'
                );
              }
          }
      }

      res.json({
        success: true,
        message: 'System setting retrieved successfully',
        data: { setting }
      });
    } catch (error) {
      console.error('Get system setting error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Create new system setting (Admin only)
   */
  createSetting = async (req: Request, res: Response): Promise<void> => {
    try {
      const { key, value, description, category, is_public } = req.body;
      const userId = req.user?.id;
      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';

      // Check if setting already exists
      const existingSetting = await this.systemSettingsRepository.findOne({
        where: { setting_key: key }
      });

      if (existingSetting) {
        res.status(409).json({
          success: false,
          message: 'Setting with this key already exists'
        });
        return;
      }

      // Create new setting
      const finalValue = isSensitiveKey(key) ? encrypt(value) : value;

      const newSetting = this.systemSettingsRepository.create({
        setting_key: key,
        setting_value: finalValue,
        description,
        data_type: 'string',
        is_active: true,
        created_at: new Date()
      });

      const savedSetting = await this.systemSettingsRepository.save(newSetting);

      // Log setting creation
      if (userId) {
        await this.authService.logActivity(
          userId,
          ActivityType.SYSTEM_SETTING_CREATED,
          `Created system setting: ${key}`,
          clientIp,
          userAgent,
          { settingKey: key, settingValue: value }
        );
      }

      res.status(201).json({
        success: true,
        message: 'System setting created successfully',
        data: { setting: savedSetting }
      });
    } catch (error) {
      console.error('Create system setting error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Update system setting (Admin only)
   */
  updateSetting = async (req: Request, res: Response): Promise<void> => {
    try {
      const { key } = req.params;
      // Accept both `setting_value` (preferred) and legacy `value`
      const { setting_value, value, description, is_active } = req.body as any;
      const newValue = setting_value !== undefined ? setting_value : value;
      const userId = req.user?.id;
      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';

      const setting = await this.systemSettingsRepository.findOne({
        where: { setting_key: key }
      });

      if (!setting) {
        res.status(404).json({
          success: false,
          message: 'System setting not found'
        });
        return;
      }

      const oldValue = setting.setting_value;

      // Update setting
      const updateData: Partial<SystemSettings> = {
        updated_at: new Date()
      };

      if (newValue !== undefined) {
        updateData.setting_value = isSensitiveKey(key) ? encrypt(newValue) : newValue;
      }

      if (description !== undefined) {
        updateData.description = description;
      }

      if (is_active !== undefined) {
        updateData.is_active = is_active;
      }

      await this.systemSettingsRepository.update(setting.id, updateData);

      const updatedSetting = await this.systemSettingsRepository.findOne({
        where: { id: setting.id }
      });

      // Log system setting update
      if (userId) {
        await this.authService.logActivity(
          userId,
          ActivityType.SYSTEM_SETTING_UPDATED,
          `Updated system setting: ${key}`,
          clientIp,
          userAgent,
          {
            settingKey: key,
            oldValue,
            newValue,
            changes: updateData
          }
        );
      }

      res.json({
        success: true,
        message: 'System setting updated successfully',
        data: { setting: updatedSetting }
      });
    } catch (error) {
      console.error('Update system setting error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Create system setting (Admin only)
   */
  createSystemSetting = async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        setting_key,
        setting_value,
        description,
        data_type = 'string',
        is_active = true
      } = req.body;
      const userId = req.user?.id;
      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';

      // Check if setting already exists
      const existingSetting = await this.systemSettingsRepository.findOne({
        where: { setting_key }
      });

      if (existingSetting) {
        res.status(400).json({
          success: false,
          message: 'System setting with this key already exists'
        });
        return;
      }

      // Create new setting
      const finalValue = isSensitiveKey(setting_key) ? encrypt(setting_value) : setting_value;

      const setting = this.systemSettingsRepository.create({
        setting_key,
        setting_value: finalValue,
        description,
        data_type,
        is_active,
        created_at: new Date(),
        updated_at: new Date()
      });

      const savedSetting = await this.systemSettingsRepository.save(setting);

      // Log system setting creation
      if (userId) {
        await this.authService.logActivity(
          userId,
          ActivityType.SYSTEM_SETTING_CREATED,
          `Created system setting: ${setting_key}`,
          clientIp,
          userAgent,
          {
            settingKey: setting_key,
            settingValue: setting_value,
            dataType: data_type
          }
        );
      }

      res.status(201).json({
        success: true,
        message: 'System setting created successfully',
        data: { setting: savedSetting }
      });
    } catch (error) {
      console.error('Create system setting error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Delete system setting (Admin only)
   */
  deleteSystemSetting = async (req: Request, res: Response): Promise<void> => {
    try {
      const { key } = req.params;
      const userId = req.user?.id;
      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';

      const setting = await this.systemSettingsRepository.findOne({
        where: { setting_key: key }
      });

      if (!setting) {
        res.status(404).json({
          success: false,
          message: 'System setting not found'
        });
        return;
      }

      // Delete setting
      await this.systemSettingsRepository.remove(setting);

      // Log system setting deletion
      if (userId) {
        await this.authService.logActivity(
          userId,
          ActivityType.SYSTEM_SETTING_DELETED,
          `Deleted system setting: ${key}`,
          clientIp,
          userAgent,
          {
            settingKey: key,
            deletedValue: setting.setting_value
          }
        );
      }

      res.json({
        success: true,
        message: 'System setting deleted successfully'
      });
    } catch (error) {
      console.error('Delete system setting error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Get system dashboard statistics (Admin/Staff only)
   */
  getDashboardStats = async (req: Request, res: Response): Promise<void> => {
    try {
      const { period = '30' } = req.query; // days
      const periodDays = Number(period);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - periodDays);

      // Get user statistics
      const totalUsers = await this.userRepository.count();
      const activeUsers = await this.userRepository.count({
        where: { status: UserStatus.AKTIF }
      });
      const newUsers = await this.userRepository
        .createQueryBuilder('user')
        .where('user.created_at >= :startDate', { startDate })
        .getCount();

      // Get task statistics
      const totalTasks = await this.taskRepository.count();
      const activeTasks = await this.taskRepository
        .createQueryBuilder('task')
        .leftJoin('task.statusSetting', 'statusSetting')
        .where('statusSetting.name = :status', { status: TaskStatus.TELAH_DIAMBIL })
        .getCount();
      const completedTasks = await this.taskRepository
        .createQueryBuilder('task')
        .leftJoin('task.statusSetting', 'statusSetting')
        .where('statusSetting.name = :status', { status: TaskStatus.SELESAI })
        .getCount();
      const newTasks = await this.taskRepository
        .createQueryBuilder('task')
        .where('task.created_at >= :startDate', { startDate })
        .getCount();

      // Get notification statistics
      const totalNotifications = await this.notificationRepository.count();
      const unreadNotifications = await this.notificationRepository.count({
        where: { is_read: false }
      });

      // Get activity statistics - simplified to avoid sort memory issues
      const recentActivities = await this.activityLogRepository
        .createQueryBuilder('activity')
        .select(['activity.id', 'activity.activity_type', 'activity.description', 'activity.created_at', 'user.id', 'user.name', 'user.email'])
        .leftJoin('activity.user', 'user')
        .where('activity.created_at >= :startDate', { startDate })
        .orderBy('activity.id', 'DESC')
        .limit(10)
        .getMany();

      // Get task status distribution
      const taskStatusStats = await this.taskRepository
        .createQueryBuilder('task')
        .leftJoin('task.statusSetting', 'statusSetting')
        .select('COALESCE(statusSetting.name, \"Tiada Status\")', 'status')
        .addSelect('COUNT(*)', 'count')
        .groupBy('statusSetting.name')
        .getRawMany();

      // Get user role distribution with proper join
      let userRoleStats = [];
      try {
        userRoleStats = await this.userRepository
          .createQueryBuilder('user')
          .innerJoin('user.role', 'role')
          .select('role.name', 'role')
          .addSelect('COUNT(*)', 'count')
          .groupBy('role.name')
          .getRawMany();
      } catch (roleError) {
        console.error('Error getting user role stats:', roleError);
        // Return empty array if role stats fail
        userRoleStats = [];
      }

      // Get daily activity for the period - simplified without complex join
      const dailyActivity = await this.activityLogRepository
        .createQueryBuilder('activity')
        .select('DATE(activity.created_at)', 'date')
        .addSelect('COUNT(*)', 'count')
        .where('activity.created_at >= :startDate', { startDate })
        .groupBy('DATE(activity.created_at)')
        .orderBy('DATE(activity.created_at)', 'ASC')
        .limit(30)
        .getRawMany();

      res.json({
        success: true,
        message: 'Dashboard statistics retrieved successfully',
        data: {
          period_days: periodDays,
          users: {
            total: totalUsers,
            active: activeUsers,
            new: newUsers,
            by_role: userRoleStats
          },
          tasks: {
            total: totalTasks,
            active: activeTasks,
            completed: completedTasks,
            new: newTasks,
            by_status: taskStatusStats
          },
          notifications: {
            total: totalNotifications,
            unread: unreadNotifications
          },
          recent_activities: recentActivities,
          daily_activity: dailyActivity
        }
      });
    } catch (error) {
      console.error('Get dashboard stats error:', error);
      console.error('Error details:', error instanceof Error ? error.message : 'Unknown error');
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * Get activity logs (Admin/Staff only)
   */
  getActivityLogs = async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        page = 1,
        limit = 50,
        user_id,
        activity_type,
        dateFrom,
        dateTo,
        search
      } = req.query;

      const skip = (Number(page) - 1) * Number(limit);
      const queryBuilder = this.activityLogRepository.createQueryBuilder('activity')
        .leftJoinAndSelect('activity.user', 'user')
        .select([
          'activity.id',
          'activity.activity_type',
          'activity.description',
          'activity.ip_address',
          'activity.user_agent',
          'activity.metadata',
          'activity.created_at',
          'user.id',
          'user.name',
          'user.email'
        ]);

      // Apply filters
      if (user_id) {
        queryBuilder.andWhere('activity.user_id = :user_id', { user_id });
      }

      if (activity_type) {
        queryBuilder.andWhere('activity.activity_type = :activity_type', { activity_type });
      }

      if (dateFrom) {
        queryBuilder.andWhere('activity.created_at >= :dateFrom', { dateFrom });
      }

      if (dateTo) {
        queryBuilder.andWhere('activity.created_at <= :dateTo', { dateTo });
      }

      if (search) {
        queryBuilder.andWhere(
          '(activity.description LIKE :search OR user.name LIKE :search OR user.email LIKE :search)',
          { search: `%${search}%` }
        );
      }

      // Apply sorting and pagination
      queryBuilder
        .orderBy('activity.created_at', 'DESC')
        .skip(skip)
        .take(Number(limit));

      const [activities, total] = await queryBuilder.getManyAndCount();

      res.json({
        success: true,
        message: 'Activity logs retrieved successfully',
        data: {
          activities,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            pages: Math.ceil(total / Number(limit))
          }
        }
      });
    } catch (error) {
      console.error('Get activity logs error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Export activity logs (Admin only)
   */
  exportActivityLogs = async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        format = 'csv',
        user_id,
        activity_type,
        dateFrom,
        dateTo
      } = req.query;

      const queryBuilder = this.activityLogRepository.createQueryBuilder('activity')
        .leftJoinAndSelect('activity.user', 'user');

      // Apply filters
      if (user_id) {
        queryBuilder.andWhere('activity.user_id = :user_id', { user_id });
      }

      if (activity_type) {
        queryBuilder.andWhere('activity.activity_type = :activity_type', { activity_type });
      }

      if (dateFrom) {
        queryBuilder.andWhere('activity.created_at >= :dateFrom', { dateFrom });
      }

      if (dateTo) {
        queryBuilder.andWhere('activity.created_at <= :dateTo', { dateTo });
      }

      const activities = await queryBuilder
        .orderBy('activity.created_at', 'DESC')
        .getMany();

      if (format === 'csv') {
        // Generate CSV
        const csvHeader = 'ID,User,Email,Activity Type,Description,IP Address,Date\n';
        const csvRows = activities.map(activity => 
          `${activity.id},"${activity.user?.name || 'N/A'}","${activity.user?.email || 'N/A'}","${activity.activity_type}","${activity.description}","${activity.ip_address}","${activity.created_at}"`
        ).join('\n');
        
        const csvContent = csvHeader + csvRows;
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="activity_logs_${new Date().toISOString().split('T')[0]}.csv"`);
        res.send(csvContent);
      } else {
        // Return JSON
        res.json({
          success: true,
          message: 'Activity logs exported successfully',
          data: { activities }
        });
      }
    } catch (error) {
      console.error('Export activity logs error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Delete system setting (Admin only)
   */
  deleteSetting = async (req: Request, res: Response): Promise<void> => {
    try {
      const { key } = req.params;
      const userId = req.user?.id;
      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';

      const setting = await this.systemSettingsRepository.findOne({
        where: { setting_key: key }
      });

      if (!setting) {
        res.status(404).json({
          success: false,
          message: 'System setting not found'
        });
        return;
      }

      await this.systemSettingsRepository.remove(setting);

      // Log activity
      if (userId) {
        await this.authService.logActivity(
          userId,
          ActivityType.SYSTEM_SETTING_DELETED,
          `Deleted system setting: ${key}`,
          clientIp,
          userAgent
        );
      }

      res.json({
        success: true,
        message: 'System setting deleted successfully'
      });
    } catch (error) {
      console.error('Delete system setting error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Get system health status (Admin only)
   */
  getSystemHealth = async (req: Request, res: Response): Promise<void> => {
    try {
      const healthChecks = {
        database: false,
        storage: false,
        memory: false
      };

      // Check database connection
      try {
        await AppDataSource.query('SELECT 1');
        healthChecks.database = true;
      } catch (error) {
        console.error('Database health check failed:', error);
      }

      // Check storage (basic check)
      try {
        const fs = require('fs');
        const path = require('path');
        const uploadsDir = path.join(process.cwd(), 'uploads');
        
        if (fs.existsSync(uploadsDir)) {
          healthChecks.storage = true;
        }
      } catch (error) {
        console.error('Storage health check failed:', error);
      }

      // Check memory usage
      try {
        const memoryUsage = process.memoryUsage();
        const totalMemory = memoryUsage.heapTotal;
        const usedMemory = memoryUsage.heapUsed;
        const memoryUsagePercent = (usedMemory / totalMemory) * 100;
        
        healthChecks.memory = memoryUsagePercent < 90; // Consider healthy if < 90%
      } catch (error) {
        console.error('Memory health check failed:', error);
      }

      const overallHealth = Object.values(healthChecks).every(check => check);

      res.json({
        success: true,
        message: 'System health status retrieved',
        data: {
          overall_health: overallHealth,
          checks: healthChecks,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Get system health error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Get public system settings (No authentication required)
   */
  getPublicSettings = async (req: Request, res: Response): Promise<void> => {
    try {
      // Only return settings that are marked as public or commonly needed for frontend initialization
      const publicSettingKeys = [
        'spfit_webhooks',
        'spfit_notification_templates',
        'spfit_roles',
        'spfit_default_freelancer_role_id',
        'spfit_smtp_settings'
      ];

      const settings = await this.systemSettingsRepository.find({
        where: publicSettingKeys.map(key => ({ setting_key: key })),
        select: ['setting_key', 'setting_value', 'description']
      });

      // Convert to key-value format for easier frontend consumption
      const settingsMap: Record<string, string> = {};
      settings.forEach(setting => {
        let val = setting.setting_value;
        // Special handling for SMTP settings to remove password from public view
        if (setting.setting_key === 'spfit_smtp_settings') {
            try {
                // If encrypted, decrypt first (shouldn't be for public list but good to be safe)
                if (isEncrypted(val)) {
                    const decrypted = decrypt(val);
                    if (decrypted) val = decrypted;
                }
                
                const parsed = JSON.parse(val);
                if (parsed.password) {
                    parsed.password = ''; // Remove password
                }
                val = JSON.stringify(parsed);
            } catch (e) {
                // If parse fails, return empty or as is? Better safe than sorry.
                val = '{}';
            }
        }
        // Do NOT decrypt other sensitive keys for public endpoint
        
        settingsMap[setting.setting_key] = val;
      });

      res.json({
        success: true,
        message: 'Public system settings retrieved successfully',
        data: {
          settings: settingsMap
        }
      });
    } catch (error) {
      console.error('Get public system settings error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Send SMTP test email and store audit trail
   */
  sendTestEmail = async (req: Request, res: Response): Promise<void> => {
    const { recipient_email, smtp } = req.body as {
      recipient_email: string;
      smtp: {
        server: string;
        port: number;
        username: string;
        password: string;
        fromAddress: string;
        security: 'TLS' | 'SSL' | 'None';
      };
    };

    try {
      const normalizedUser = (smtp.username || '').trim();
      const normalizedPass = (smtp.password || '').replace(/\s+/g, '');
      const normalizedFrom = (smtp.fromAddress || '').trim();

      if (!normalizedUser || !normalizedUser.includes('@')) {
        res.status(400).json({
          success: false,
          message: 'Nama pengguna SMTP mesti alamat e-mel yang sah (contoh: support@domain.com).',
        });
        return;
      }

      if (!normalizedPass) {
        res.status(400).json({
          success: false,
          message: 'Kata laluan SMTP diperlukan.',
        });
        return;
      }

      const secure = smtp.security === 'SSL';

      const transporter = nodemailer.createTransport({
        host: smtp.server,
        port: Number(smtp.port),
        secure,
        auth: normalizedUser
          ? {
              user: normalizedUser,
              pass: normalizedPass,
            }
          : undefined,
      });

      await transporter.verify();

      const info = await transporter.sendMail({
        from: normalizedFrom,
        to: recipient_email,
        subject: 'SPFIT - E-mel Ujian SMTP',
        text: `Ini adalah e-mel ujian SMTP SPFIT.\n\nMasa: ${new Date().toLocaleString('ms-MY')}`,
        html: `<p>Ini adalah e-mel ujian SMTP SPFIT.</p><p>Masa: ${new Date().toLocaleString('ms-MY')}</p>`,
      });

      await AuditService.log({
        req,
        actionType: 'SYSTEM',
        tableName: 'smtp_test_email',
        newValues: {
          recipient_email,
          smtp_server: smtp.server,
          smtp_port: smtp.port,
          smtp_security: smtp.security,
          smtp_username: normalizedUser,
          from_address: normalizedFrom,
          status: 'SENT',
          message_id: info.messageId,
        },
        description: `SMTP test email dihantar ke ${recipient_email}`,
      });

      res.json({
        success: true,
        message: `E-mel ujian berjaya dihantar ke ${recipient_email}`,
        data: {
          recipient_email,
          message_id: info.messageId,
        },
      });
    } catch (error: any) {
      await AuditService.log({
        req,
        actionType: 'SYSTEM',
        tableName: 'smtp_test_email',
        newValues: {
          recipient_email,
          smtp_server: smtp?.server,
          smtp_port: smtp?.port,
          smtp_security: smtp?.security,
          smtp_username: smtp?.username,
          from_address: smtp?.fromAddress,
          status: 'FAILED',
          error: error?.message || 'Unknown error',
        },
        description: `SMTP test email gagal dihantar ke ${recipient_email}`,
      });

      const rawError = error?.message || 'Unknown error';
      const friendlyMessage =
        /Application-specific password required|InvalidSecondFactor/i.test(rawError)
          ? 'Gmail memerlukan App Password (16 aksara) untuk SMTP. Sila gunakan App Password, bukan kata laluan akaun biasa.'
          : /Username and Password not accepted|BadCredentials/i.test(rawError)
          ? 'Nama pengguna atau kata laluan SMTP tidak sah. Pastikan nama pengguna ialah alamat e-mel penuh dan kata laluan ialah App Password.'
          : /Missing credentials/i.test(rawError)
          ? 'Maklumat log masuk SMTP tidak lengkap. Sila isi nama pengguna e-mel dan kata laluan.'
          : 'Gagal menghantar e-mel ujian. Sila semak konfigurasi SMTP.';

      res.status(400).json({
        success: false,
        message: friendlyMessage,
        error: rawError,
      });
    }
  };

  /**
   * Get updater runtime status
   */
  getUpdateStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const clearLogs = req.query.clearLogs === '1' || req.query.clearLogs === 'true';
      const status = systemUpdateService.getStatus({ resetLastOutput: clearLogs });
      res.json({
        success: true,
        message: 'Status updater berjaya diperoleh',
        data: status
      });
    } catch (error: any) {
      console.error('Get update status error:', error);
      res.status(500).json({
        success: false,
        message: 'Gagal mendapatkan status updater',
        error: error?.message || 'Unknown error'
      });
    }
  };

  /**
   * Check latest commit on remote branch
   */
  checkSystemUpdate = async (req: Request, res: Response): Promise<void> => {
    try {
      const branch = typeof req.query.branch === 'string' ? req.query.branch : undefined;
      const status = await systemUpdateService.checkForUpdate(branch);

      if (req.user?.id) {
        await this.authService.logActivity(
          req.user.id,
          ActivityType.SYSTEM_ACCESS,
          `Semak kemas kini sistem (branch: ${status.branch})`,
          req.ip || 'unknown',
          req.get('User-Agent') || 'unknown',
          {
            currentCommit: status.currentCommit,
            latestCommit: status.latestCommit,
            hasUpdate: status.hasUpdate
          }
        );
      }

      res.json({
        success: true,
        message: status.hasUpdate ? 'Kemas kini ditemui' : 'Sistem sudah terkini',
        data: status
      });
    } catch (error: any) {
      console.error('Check system update error:', error);
      res.status(400).json({
        success: false,
        message: 'Gagal semak kemas kini sistem',
        error: error?.message || 'Unknown error'
      });
    }
  };

  /**
   * Trigger update script on server
   */
  applySystemUpdate = async (req: Request, res: Response): Promise<void> => {
    try {
      const branch = typeof req.body?.branch === 'string' ? req.body.branch : undefined;
      const status = await systemUpdateService.startUpdate(branch, req.user?.id);

      if (req.user?.id) {
        await this.authService.logActivity(
          req.user.id,
          ActivityType.SYSTEM_ACCESS,
          `Trigger kemas kini sistem (branch: ${status.branch})`,
          req.ip || 'unknown',
          req.get('User-Agent') || 'unknown',
          {
            scriptPath: status.scriptPath,
            logPath: status.logPath,
            branch: status.branch,
            authMode: 'PAT_ONLY'
          }
        );
      }

      res.status(202).json({
        success: true,
        message: 'Proses kemas kini telah dimulakan',
        data: status
      });
    } catch (error: any) {
      console.error('Apply system update error:', error);
      res.status(400).json({
        success: false,
        message: 'Gagal memulakan kemas kini sistem',
        error: error?.message || 'Unknown error'
      });
    }
  };

  /**
   * List available backup files (Admin only)
   * Shows metadata: filename, size, created/modified dates
   */
  listBackups = async (req: Request, res: Response): Promise<void> => {
    try {
      const backupPath = process.env.BACKUP_PATH || path.join(__dirname, '../SPFIT_Backups');

      // Check if directory exists
      if (!fs.existsSync(backupPath)) {
        res.json({
          success: true,
          data: {
            files: [],
            total: 0,
            message: 'Tiada backup fail dijumpai'
          }
        });
        return;
      }

      // Read directory
      const files = fs.readdirSync(backupPath);
      const backupFiles = files
        .filter(f => !fs.statSync(path.join(backupPath, f)).isDirectory())
        .map(f => {
          const fullPath = path.join(backupPath, f);
          const stat = fs.statSync(fullPath);
          return {
            name: f,
            size: stat.size,
            sizeHuman: `${(stat.size / (1024 * 1024)).toFixed(2)} MB`,
            createdAt: stat.birthtime,
            modifiedAt: stat.mtime
          };
        })
        .sort((a, b) => (b.modifiedAt as any) - (a.modifiedAt as any));

      res.json({
        success: true,
        data: {
          files: backupFiles,
          total: backupFiles.length
        }
      });
    } catch (error: any) {
      console.error('List backups error:', error);
      res.status(500).json({
        success: false,
        message: 'Gagal senaraikan fail backup',
        error: error?.message || 'Unknown error'
      });
    }
  };

  /**
   * Get system update version history (latest updates first)
   * Admin only - shows successful and failed update attempts with timestamps
   */
  getSystemUpdateVersionHistory = async (req: Request, res: Response): Promise<void> => {
    try {
      const history = systemUpdateService.getVersionHistory();

      if (req.user?.id) {
        await this.authService.logActivity(
          req.user.id,
          ActivityType.SYSTEM_ACCESS,
          'Lihat sejarah versi sistem update',
          req.ip || 'unknown',
          req.get('User-Agent') || 'unknown',
          { action: 'view_version_history' }
        );
      }

      res.json({
        success: true,
        message: 'Sejarah versi sistem berjaya diambil',
        data: {
          versions: history,
          total: history.length,
          latest: history[0] || null
        }
      });
    } catch (error: any) {
      console.error('Get version history error:', error);
      res.status(500).json({
        success: false,
        message: 'Gagal mendapatkan sejarah versi sistem',
        error: error?.message || 'Unknown error'
      });
    }
  };

  /**
   * Get paginated system update logs
   * Admin only - allows scrolling through old logs with pagination
   * Latest logs shown first, page param allows fetching older logs
   */
  getSystemUpdateLogs = async (req: Request, res: Response): Promise<void> => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const pageSize = Math.min(100, Math.max(10, parseInt(req.query.pageSize as string) || 50));

      const logPage = systemUpdateService.getSystemUpdateLogs(page, pageSize);

      if (req.user?.id) {
        await this.authService.logActivity(
          req.user.id,
          ActivityType.SYSTEM_ACCESS,
          `Lihat log sistem update (page: ${page})`,
          req.ip || 'unknown',
          req.get('User-Agent') || 'unknown',
          { action: 'view_update_logs', page, pageSize }
        );
      }

      res.json({
        success: true,
        message: 'Log sistem update berjaya diambil',
        data: logPage
      });
    } catch (error: any) {
      console.error('Get system update logs error:', error);
      res.status(500).json({
        success: false,
        message: 'Gagal mendapatkan log sistem update',
        error: error?.message || 'Unknown error'
      });
    }
  };

  /**
   * Download specific backup file (Admin only)
   * Security features:
   * - Path traversal prevention (no ../ or / in filename)
   * - Directory boundary check (file must be in backup folder)
   * - Activity logging (who downloaded what, when, from where)
   * - File existence validation
   */
  downloadBackup = async (req: Request, res: Response): Promise<void> => {
    try {
      const { fileName } = req.params;

      // Validation: prevent path traversal attacks
      if (!fileName || fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
        res.status(400).json({
          success: false,
          message: 'Nama file tidak sah'
        });
        return;
      }

      // Get backup path from env - MUST be absolute path
      const backupPath = process.env.BACKUP_PATH || path.join(__dirname, '../SPFIT_Backups');
      const filePath = path.join(backupPath, fileName);

      // Security: Verify file is within backup directory (prevent directory traversal)
      const resolvedBackupPath = path.resolve(backupPath);
      const resolvedFilePath = path.resolve(filePath);

      if (!resolvedFilePath.startsWith(resolvedBackupPath)) {
        res.status(403).json({
          success: false,
          message: 'Akses ditolak - fail berada di luar direktori backup'
        });
        return;
      }

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        res.status(404).json({
          success: false,
          message: 'Fail backup tidak dijumpai'
        });
        return;
      }

      // Log activity
      if (req.user?.id) {
        const stat = fs.statSync(filePath);
        await this.authService.logActivity(
          req.user.id,
          ActivityType.SYSTEM_ACCESS,
          `Muat turun fail backup: ${fileName}`,
          req.ip || 'unknown',
          req.get('User-Agent') || 'unknown',
          { 
            fileName,
            fileSize: stat.size,
            action: 'backup_download'
          }
        );
      }

      // Send file
      res.download(filePath, fileName);
    } catch (error: any) {
      console.error('Download backup error:', error);
      res.status(500).json({
        success: false,
        message: 'Gagal muat turun fail backup',
        error: error?.message || 'Unknown error'
      });
    }
  };
}