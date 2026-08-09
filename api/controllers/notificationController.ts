import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Notification, NotificationType } from '../models/Notification';
import { User } from '../models/User';
import { AuthService } from '../services/authService';
import { ActivityType } from '../models/ActivityLog';



export class NotificationController {
  private notificationRepository = AppDataSource.getRepository(Notification);
  private userRepository = AppDataSource.getRepository(User);
  private authService: AuthService;

  private hasViewAllPermission(req: Request): boolean {
    const permissions = req.userPermissions || [];
    return req.user?.role?.toLowerCase() === 'admin'
      || permissions.includes('notifications:view:all')
      || permissions.includes('notifications:view');
  }

  private hasViewOwnPermission(req: Request): boolean {
    const permissions = req.userPermissions || [];
    return permissions.includes('notifications:view:own')
      || permissions.includes('notifications:view');
  }

  constructor() {
    this.authService = new AuthService();
  }

  /**
   * Get user notifications with pagination and filtering
   */
  getUserNotifications = async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        page = 1,
        limit = 20,
        type,
        is_read,
        dateFrom,
        dateTo
      } = req.query;
      const userId = req.user?.id;
      const canViewAll = this.hasViewAllPermission(req);
      const canViewOwn = this.hasViewOwnPermission(req);

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
        return;
      }

      const skip = (Number(page) - 1) * Number(limit);
      const queryBuilder = this.notificationRepository.createQueryBuilder('notification')
        .leftJoinAndSelect('notification.task', 'task')
        .select([
          'notification.id',
          'notification.type',
          'notification.title',
          'notification.message',
          'notification.is_read',
          'notification.created_at',
          'task.id',
          'task.title',
          'task.log_number'
        ]);

      if (!canViewAll && canViewOwn) {
        queryBuilder.where('notification.user_id = :userId', { userId });
      }

      // Apply filters
      if (type) {
        queryBuilder.andWhere('notification.type = :type', { type });
      }

      if (is_read !== undefined) {
        queryBuilder.andWhere('notification.is_read = :is_read', { 
          is_read: is_read === 'true' 
        });
      }

      if (dateFrom) {
        queryBuilder.andWhere('notification.created_at >= :dateFrom', { dateFrom });
      }

      if (dateTo) {
        queryBuilder.andWhere('notification.created_at <= :dateTo', { dateTo });
      }

      // Apply sorting and pagination
      queryBuilder
        .orderBy('notification.created_at', 'DESC')
        .skip(skip)
        .take(Number(limit));

      const [notifications, total] = await queryBuilder.getManyAndCount();

      // Get unread count
      const unreadCount = await this.notificationRepository.count({
        where: {
          user_id: userId,
          is_read: false
        }
      });

      res.json({
        success: true,
        message: 'Notifications retrieved successfully',
        data: {
          notifications,
          unread_count: unreadCount,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            pages: Math.ceil(total / Number(limit))
          }
        }
      });
    } catch (error) {
      console.error('Get notifications error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Get notification by ID
   */
  getNotificationById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const canViewAll = this.hasViewAllPermission(req);
      const canViewOwn = this.hasViewOwnPermission(req);

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
        return;
      }

      const qb = this.notificationRepository.createQueryBuilder('notification')
        .leftJoinAndSelect('notification.task', 'task')
        .leftJoinAndSelect('task.creator', 'creator')
        .leftJoinAndSelect('task.assignee', 'assignee')
        .where('notification.id = :id', { id: Number(id) });

      if (!canViewAll && canViewOwn) {
        qb.andWhere('notification.user_id = :userId', { userId });
      }

      const notification = await qb.getOne();

      if (!notification) {
        res.status(404).json({
          success: false,
          message: 'Notification not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Notification retrieved successfully',
        data: { notification }
      });
    } catch (error) {
      console.error('Get notification by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Mark notification as read
   */
  markAsRead = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const canViewAll = this.hasViewAllPermission(req);
      const canViewOwn = this.hasViewOwnPermission(req);
      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
        return;
      }

      const qb = this.notificationRepository.createQueryBuilder('notification')
        .where('notification.id = :id', { id: Number(id) });

      if (!canViewAll && canViewOwn) {
        qb.andWhere('notification.user_id = :userId', { userId });
      }

      const notification = await qb.getOne();

      if (!notification) {
        res.status(404).json({
          success: false,
          message: 'Notification not found'
        });
        return;
      }

      if (notification.is_read) {
        res.json({
          success: true,
          message: 'Notification already marked as read'
        });
        return;
      }

      // Mark as read
      await this.notificationRepository.update(Number(id), {
        is_read: true
      });

      // Log notification read
      await this.authService.logActivity(
        userId,
        ActivityType.NOTIFICATION_READ,
        `Read notification: ${notification.title}`,
        clientIp,
        userAgent,
        { notificationId: Number(id) }
      );

      res.json({
        success: true,
        message: 'Notification marked as read'
      });
    } catch (error) {
      console.error('Mark notification as read error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Mark all notifications as read
   */
  markAllAsRead = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
        return;
      }

      // Get count of unread notifications
      const unreadCount = await this.notificationRepository.count({
        where: {
          user_id: userId,
          is_read: false
        }
      });

      if (unreadCount === 0) {
        res.json({
          success: true,
          message: 'No unread notifications found'
        });
        return;
      }

      // Mark all as read
      await this.notificationRepository.update(
        { user_id: userId, is_read: false },
        { is_read: true }
      );

      // Log bulk notification read
      await this.authService.logActivity(
        userId,
        ActivityType.NOTIFICATION_READ,
        `Marked ${unreadCount} notifications as read`,
        clientIp,
        userAgent,
        { unreadCount }
      );

      res.json({
        success: true,
        message: `${unreadCount} notifications marked as read`
      });
    } catch (error) {
      console.error('Mark all notifications as read error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Delete notification
   */
  deleteNotification = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const canViewAll = this.hasViewAllPermission(req);
      const canViewOwn = this.hasViewOwnPermission(req);
      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
        return;
      }

      const qb = this.notificationRepository.createQueryBuilder('notification')
        .where('notification.id = :id', { id: Number(id) });

      if (!canViewAll && canViewOwn) {
        qb.andWhere('notification.user_id = :userId', { userId });
      }

      const notification = await qb.getOne();

      if (!notification) {
        res.status(404).json({
          success: false,
          message: 'Notification not found'
        });
        return;
      }

      // Delete notification
      await this.notificationRepository.remove(notification);

      // Log notification deletion
      await this.authService.logActivity(
        userId,
        ActivityType.NOTIFICATION_DELETED,
        `Deleted notification: ${notification.title}`,
        clientIp,
        userAgent,
        { deletedNotificationId: Number(id) }
      );

      res.json({
        success: true,
        message: 'Notification deleted successfully'
      });
    } catch (error) {
      console.error('Delete notification error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Delete all read notifications
   */
  deleteAllRead = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
        return;
      }

      // Get count of read notifications
      const readNotifications = await this.notificationRepository.find({
        where: {
          user_id: userId,
          is_read: true
        }
      });

      if (readNotifications.length === 0) {
        res.json({
          success: true,
          message: 'No read notifications found'
        });
        return;
      }

      // Delete all read notifications
      await this.notificationRepository.remove(readNotifications);

      // Log bulk notification deletion
      await this.authService.logActivity(
        userId,
        ActivityType.NOTIFICATION_DELETED,
        `Deleted ${readNotifications.length} read notifications`,
        clientIp,
        userAgent,
        { deletedCount: readNotifications.length }
      );

      res.json({
        success: true,
        message: `${readNotifications.length} read notifications deleted`
      });
    } catch (error) {
      console.error('Delete all read notifications error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Get notification statistics
   */
  getNotificationStats = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
        return;
      }

      // Get notification counts by type and status
      const stats = await this.notificationRepository
        .createQueryBuilder('notification')
        .select([
          'notification.type',
          'notification.is_read',
          'COUNT(*) as count'
        ])
        .where('notification.user_id = :userId', { userId })
        .groupBy('notification.type, notification.is_read')
        .getRawMany();

      // Get total counts
      const totalCount = await this.notificationRepository.count({
        where: { user_id: userId }
      });

      const unreadCount = await this.notificationRepository.count({
        where: {
          user_id: userId,
          is_read: false
        }
      });

      const readCount = totalCount - unreadCount;

      // Process stats by type
      const typeStats: Record<string, { total: number; read: number; unread: number }> = {};
      
      stats.forEach(stat => {
        if (!typeStats[stat.notification_type]) {
          typeStats[stat.notification_type] = { total: 0, read: 0, unread: 0 };
        }
        
        const count = Number(stat.count);
        typeStats[stat.notification_type].total += count;
        
        if (stat.notification_is_read) {
          typeStats[stat.notification_type].read += count;
        } else {
          typeStats[stat.notification_type].unread += count;
        }
      });

      res.json({
        success: true,
        message: 'Notification statistics retrieved successfully',
        data: {
          summary: {
            total: totalCount,
            read: readCount,
            unread: unreadCount
          },
          by_type: typeStats
        }
      });
    } catch (error) {
      console.error('Get notification stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Create notification (Admin/Staff only)
   */
  createNotification = async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        user_id,
        task_id,
        type,
        title,
        message
      } = req.body;
      const creatorId = req.user?.id;
      const userRole = req.user?.role;
      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';

      // Check permission
      if (!['Admin', 'Staff', 'Supervisor'].includes(userRole || '')) {
        res.status(403).json({
          success: false,
          message: 'Permission denied'
        });
        return;
      }

      // Verify target user exists
      const targetUser = await this.userRepository.findOne({
        where: { id: user_id }
      });

      if (!targetUser) {
        res.status(404).json({
          success: false,
          message: 'Target user not found'
        });
        return;
      }

      // Create notification
      const notification = this.notificationRepository.create({
        user_id,
        task_id: task_id || null,
        type: type as NotificationType,
        title,
        message,
        is_read: false,
        created_at: new Date()
      });

      const savedNotification = await this.notificationRepository.save(notification);

      // Log notification creation
      if (creatorId) {
        await this.authService.logActivity(
          creatorId,
          ActivityType.NOTIFICATION_CREATED,
          `Created notification for ${targetUser.name}: ${title}`,
          clientIp,
          userAgent,
          { notificationId: savedNotification.id, targetUserId: user_id }
        );
      }

      res.status(201).json({
        success: true,
        message: 'Notification created successfully',
        data: { notification: savedNotification }
      });
    } catch (error) {
      console.error('Create notification error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Broadcast notification to multiple users (Admin/Staff only)
   */
  broadcastNotification = async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        user_ids,
        role_name,
        type,
        title,
        message
      } = req.body;
      const creatorId = req.user?.id;
      const userRole = req.user?.role;
      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';

      // Check permission
      if (!['Admin', 'Staff', 'Supervisor'].includes(userRole || '')) {
        res.status(403).json({
          success: false,
          message: 'Permission denied'
        });
        return;
      }

      let targetUsers: User[] = [];

      if (user_ids && Array.isArray(user_ids)) {
        // Send to specific users
        targetUsers = await this.userRepository.findByIds(user_ids);
      } else if (role_name) {
        // Send to all users with specific role
        targetUsers = await this.userRepository.find({
          where: { role: { name: role_name } },
          relations: ['role']
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'Either user_ids or role_name must be provided'
        });
        return;
      }

      if (targetUsers.length === 0) {
        res.status(404).json({
          success: false,
          message: 'No target users found'
        });
        return;
      }

      // Create notifications for all target users
      const notifications = targetUsers.map(user => 
        this.notificationRepository.create({
          user_id: user.id,
          task_id: null,
          type: type as NotificationType,
          title,
          message,
          is_read: false,
          created_at: new Date()
        })
      );

      await this.notificationRepository.save(notifications);

      // Log broadcast notification
      if (creatorId) {
        await this.authService.logActivity(
          creatorId,
          ActivityType.NOTIFICATION_CREATED,
          `Broadcasted notification to ${targetUsers.length} users: ${title}`,
          clientIp,
          userAgent,
          { 
            recipientCount: targetUsers.length,
            roleName: role_name,
            userIds: user_ids 
          }
        );
      }

      res.status(201).json({
        success: true,
        message: `Notification sent to ${targetUsers.length} users`,
        data: { recipient_count: targetUsers.length }
      });
    } catch (error) {
      console.error('Broadcast notification error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Get ALL notifications unified (WhatsApp, in-app, templates)
   * Returns a comprehensive view of all notification data
   */
  getAllNotifications = async (req: Request, res: Response): Promise<void> => {
    try {
      // Fetch WhatsApp messages (last 50, newest first)
      const whatsappRaw = await AppDataSource.query(
        `SELECT id, \`to\`, message, template_name, template_params, status, attempts, last_error, 
                provider_message_id, correlation_id, queued_at, sent_at, delivered_at, updated_at
         FROM whatsapp_messages 
         ORDER BY queued_at DESC 
         LIMIT 50`
      );

      // Fetch in-app notifications (last 50, newest first)
      const inAppRaw = await AppDataSource.query(
        `SELECT id, user_id, task_id, type, title, message, is_read, created_at
         FROM notifications 
         ORDER BY created_at DESC 
         LIMIT 50`
      );

      // Fetch notification templates from system_settings
      const templatesRaw = await AppDataSource.query(
        `SELECT setting_value FROM system_settings WHERE setting_key = 'spfit_notification_templates' LIMIT 1`
      );

      let templates: any[] = [];
      if (templatesRaw.length > 0 && templatesRaw[0].setting_value) {
        try {
          const parsed = typeof templatesRaw[0].setting_value === 'string'
            ? JSON.parse(templatesRaw[0].setting_value)
            : templatesRaw[0].setting_value;
          templates = Array.isArray(parsed) ? parsed : [];
        } catch (e) {
          templates = [];
        }
      }

      // Count total whatsapp messages
      const whatsappCountRaw = await AppDataSource.query(
        `SELECT COUNT(*) as total FROM whatsapp_messages`
      );
      const totalWhatsapp = whatsappCountRaw[0]?.total || 0;

      // Count total in-app notifications
      const inAppCountRaw = await AppDataSource.query(
        `SELECT COUNT(*) as total FROM notifications`
      );
      const totalInApp = inAppCountRaw[0]?.total || 0;

      // Identify unique channels from templates
      const channelsSet = new Set<string>();
      templates.forEach((t: any) => {
        if (t.channel) channelsSet.add(t.channel);
      });
      // Always include these channels
      channelsSet.add('Whatsapp');
      channelsSet.add('E-mel');
      channelsSet.add('Web Notification');
      const channels = Array.from(channelsSet);

      res.json({
        success: true,
        message: 'All notifications retrieved successfully',
        data: {
          whatsapp: whatsappRaw,
          inApp: inAppRaw,
          templates,
          summary: {
            total_whatsapp: Number(totalWhatsapp),
            total_inapp: Number(totalInApp),
            channels
          }
        }
      });
    } catch (error) {
      console.error('Get all notifications error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };
}