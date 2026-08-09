import { Request, Response } from 'express';
import { In } from 'typeorm';
import { AppDataSource } from '../config/database';
import { Task, TaskStatus } from '../models/Task';
import { TaskStatusOption } from '../models/TaskStatusOption';
import { SupportTypeOption } from '../models/SupportTypeOption';
import { EquipmentCode } from '../models/EquipmentCode';
import { User, UserStatus } from '../models/User';
import { TaskAttachment } from '../models/TaskAttachment';
import { TaskLink } from '../models/TaskLink';
import { TaskReport } from '../models/TaskReport';
import { TaskFeedback } from '../models/TaskFeedback';
import { Notification, NotificationType } from '../models/Notification';
import { TaskReminder } from '../models/TaskReminder';
import { TaskPart } from '../models/TaskPart';
import { TaskOffer } from '../models/TaskOffer';
import { TaskWaitingList } from '../models/TaskWaitingList';
import { TaskDone } from '../models/TaskDone';
import { Payment } from '../models/Payment';
import { AuthService } from '../services/authService';
import { ActivityType } from '../models/ActivityLog';
import { AuditService } from '../services/auditService';
import { getFileInfo } from '../middleware/upload';
import path from 'path';
import fs from 'fs';

const DEFAULT_SUPPORT_TYPE_NAMES = [
  'Perkakasan Komputer',
  'Perisian',
  'Rangkaian',
  'Printer',
  'Server',
  'Lain-lain'
];


export class TaskController {
  private taskRepository = AppDataSource.getRepository(Task);
  private taskStatusRepository = AppDataSource.getRepository(TaskStatusOption);
  private supportTypeRepository = AppDataSource.getRepository(SupportTypeOption);
  private equipmentCodeRepository = AppDataSource.getRepository(EquipmentCode);
  private userRepository = AppDataSource.getRepository(User);
  private taskAttachmentRepository = AppDataSource.getRepository(TaskAttachment);
  private taskLinkRepository = AppDataSource.getRepository(TaskLink);
  private taskReportRepository = AppDataSource.getRepository(TaskReport);
  private taskFeedbackRepository = AppDataSource.getRepository(TaskFeedback);
  private notificationRepository = AppDataSource.getRepository(Notification);
  private taskReminderRepository = AppDataSource.getRepository(TaskReminder);
  private taskPartRepository = AppDataSource.getRepository(TaskPart);
  private taskOfferRepository = AppDataSource.getRepository(TaskOffer);
  private taskWaitingListRepository = AppDataSource.getRepository(TaskWaitingList);
  private taskDoneRepository = AppDataSource.getRepository(TaskDone);
  private paymentRepository = AppDataSource.getRepository(Payment);
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  private isAdminOrStaffRole(role?: string | null): boolean {
    const normalizedRole = String(role || '').trim().toLowerCase();
    return normalizedRole.includes('admin') || normalizedRole.includes('staff');
  }

  private sanitizeUser(user: any) {
    if (!user) return user;
    return {
      id: user.id,
      name: user.name ?? null,
      email: user.email ?? null,
      role_id: user.role_id ?? user.role?.id ?? null,
      role: user.role?.name ?? user.role ?? null,
      status: user.status ?? null
    };
  }

  private formatTaskResponse(task: any) {
    if (!task) return task;

    const statusName = task.statusSetting?.name || null;
    const supportTypeName = task.supportTypeSetting?.name || task.support_type || null;

    return {
      ...task,
      creator: task.creator ? this.sanitizeUser(task.creator) : task.creator,
      assignee: task.assignee ? this.sanitizeUser(task.assignee) : task.assignee,
      status: statusName,
      status_id: task.status_id ?? task.statusSetting?.id ?? null,
      support_type: supportTypeName,
      support_type_id: task.support_type_id ?? task.supportTypeSetting?.id ?? null,
      district_address: task.bandar_daerah ?? null,
      districtAddress: task.bandar_daerah ?? null, // Add alias for frontend
      bandar_daerah: task.bandar_daerah ?? null, // Keep original field
      equipment_types_id: task.equipment_types_id ?? null,
      equipment_types: task.equipment_types_id ?? null
    };
  }

  private async resolveEquipmentTypeIds(equipmentTypeIds?: unknown): Promise<number[] | undefined> {
    if (equipmentTypeIds === undefined || equipmentTypeIds === null) {
      return undefined;
    }

    let parsedValues: unknown[] = [];

    if (typeof equipmentTypeIds === 'string') {
      try {
        const parsed = JSON.parse(equipmentTypeIds);
        parsedValues = Array.isArray(parsed) ? parsed : [];
      } catch {
        parsedValues = [];
      }
    } else if (Array.isArray(equipmentTypeIds)) {
      parsedValues = equipmentTypeIds;
    }

    const normalizedNumericIds = parsedValues
      .map(value => Number(value))
      .filter(value => Number.isFinite(value) && value > 0);

    if (normalizedNumericIds.length > 0) {
      const uniqueIds = Array.from(new Set(normalizedNumericIds));
      const existing = await this.equipmentCodeRepository.findBy({ id: In(uniqueIds) });
      return existing.map(item => item.id);
    }

    const normalizedCodes = parsedValues
      .map(value => String(value || '').trim().toUpperCase())
      .filter(Boolean);

    if (normalizedCodes.length > 0) {
      const existing = await this.equipmentCodeRepository
        .createQueryBuilder('equipment')
        .where('equipment.code IN (:...codes)', { codes: Array.from(new Set(normalizedCodes)) })
        .getMany();
      return existing.map(item => item.id);
    }

    return [];
  }

  private async resolveTaskStatus(
    settingId?: number,
    settingValue?: string
  ): Promise<TaskStatusOption | null> {
    if (settingId) {
      const settingById = await this.taskStatusRepository.findOne({ where: { id: Number(settingId) } });
      if (settingById) {
        return settingById;
      }
    }

    const normalizedValue = typeof settingValue === 'string' ? settingValue.trim() : '';
    if (normalizedValue) {
      return await this.taskStatusRepository.findOne({ where: { name: normalizedValue } });
    }

    return null;
  }

  private async resolveSupportType(
    settingId?: number,
    settingValue?: string
  ): Promise<SupportTypeOption | null> {
    if (settingId) {
      const settingById = await this.supportTypeRepository.findOne({ where: { id: Number(settingId) } });
      if (settingById) {
        return settingById;
      }
    }

    const normalizedValue = typeof settingValue === 'string' ? settingValue.trim() : '';
    if (normalizedValue) {
      const exact = await this.supportTypeRepository.findOne({ where: { name: normalizedValue } });
      if (exact) return exact;

      let options = await this.supportTypeRepository.find();
      if (options.length === 0) {
        const seeded = DEFAULT_SUPPORT_TYPE_NAMES.map((name, index) => this.supportTypeRepository.create({
          name,
          is_active: true,
          sort_order: index + 1
        }));
        await this.supportTypeRepository.save(seeded);
        options = await this.supportTypeRepository.find();
      }
      const normalize = (value: string) => String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      const normalizedInput = normalize(normalizedValue)
        .replace(/\bcomputer\b/g, 'komputer')
        .replace(/\bpc\b/g, 'komputer')
        .replace(/\bhardware\b/g, 'perkakasan');

      const directNormalized = options.find((item) => normalize(item.name) === normalizedInput);
      if (directNormalized) return directNormalized;

      const partial = options.find((item) => {
        const optionNorm = normalize(item.name);
        return optionNorm.includes(normalizedInput) || normalizedInput.includes(optionNorm);
      });
      if (partial) return partial;

      const inputTokens = normalizedInput.split(' ').filter((token) => token.length >= 3);
      let best: SupportTypeOption | null = null;
      let bestScore = 0;

      for (const option of options) {
        const optionNorm = normalize(option.name);
        const score = inputTokens.reduce((total, token) => total + (optionNorm.includes(token) ? 1 : 0), 0);
        if (score > bestScore) {
          bestScore = score;
          best = option;
        }
      }

      if (best && bestScore > 0) return best;
    }

    return null;
  }

  private isNonAssetSupportTypeName(value?: string | null): boolean {
    const normalized = String(value || '').trim().toLowerCase();
    return normalized.includes('deployment') || normalized.includes('preventive') || normalized.includes('preventif');
  }

  private isRequiredAssetSupportTypeName(value?: string | null): boolean {
    const normalized = String(value || '').trim().toLowerCase();
    const isAddHoc = normalized.includes('adhoc') || normalized.includes('ad-hoc') || (normalized.includes('add') && normalized.includes('hoc'));
    return normalized.includes('corrective') || isAddHoc;
  }

  private hasAssetIdentifier(assetTagId?: unknown, assetSerialNumber?: unknown): boolean {
    const tag = String(assetTagId || '').trim();
    const serial = String(assetSerialNumber || '').trim();
    return Boolean(tag || serial);
  }

  /**
   * Generate unique log number for task
   */
  private async generateLogNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const prefix = `SPFIT-${year}${month}-`;

    const latest = await this.taskRepository
      .createQueryBuilder('task')
      .select(['task.log_number'])
      .where('task.log_number LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('task.log_number', 'DESC')
      .getOne();

    const latestLogNumber = latest?.log_number ? String(latest.log_number) : '';
    const match = latestLogNumber.match(/-(\d{4})$/);
    const latestSequence = match ? Number(match[1]) : 0;

    const nextSequence = Number.isFinite(latestSequence) && latestSequence > 0 ? latestSequence + 1 : 1;
    const sequence = String(nextSequence).padStart(4, '0');
    return `${prefix}${sequence}`;
  }

  /**
   * Create notification
   */
  private async createNotification(
    userId: number,
    taskId: number,
    type: NotificationType,
    title: string,
    message: string,
    options?: {
      req?: Request;
      triggerUserId?: number;
    }
  ): Promise<void> {
    const notification = this.notificationRepository.create({
      user_id: userId,
      task_id: taskId,
      type,
      title,
      message,
      is_read: false,
      created_at: new Date()
    });
    
    const savedNotification = await this.notificationRepository.save(notification);

    await AuditService.log({
      req: options?.req,
      userId: options?.triggerUserId,
      actionType: 'CREATE',
      tableName: 'notifications',
      recordId: savedNotification.id,
      newValues: {
        user_id: userId,
        task_id: taskId,
        type,
        title,
        message,
        is_read: false,
        channel: 'in_app'
      },
      description: `Notifikasi automatik dihantar kepada pengguna ${userId}: ${title}`
    });
  }

  /**
   * Get all tasks with pagination and filtering
   */
  getAllTasks = async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        page = 1,
        limit = 10,
        sort = 'desc',
        sortBy = 'created_at',
        q,
        status,
        state,
        dateFrom,
        dateTo,
        assigned_to,
        created_by,
        project_id
      } = req.query;

      const skip = (Number(page) - 1) * Number(limit);
      const currentUserId = req.user?.id;
      const userPermissions = req.userPermissions || [];
      const canViewAllTasks = req.user?.role?.toLowerCase() === 'admin' || userPermissions.includes('tasks:view:all');
      const canViewOwnTasks = userPermissions.includes('tasks:view:own') || userPermissions.includes('tasks:view:assigned');

      const queryBuilder = this.taskRepository.createQueryBuilder('task')
        .leftJoinAndSelect('task.creator', 'creator')
        .leftJoinAndSelect('task.assignee', 'assignee')
        .leftJoinAndSelect('task.statusSetting', 'statusSetting')
        .leftJoinAndSelect('task.supportTypeSetting', 'supportTypeSetting')
        .leftJoinAndSelect('task.project', 'project')
        .leftJoinAndSelect('assignee.role', 'assigneeRole')
        .select([
          'task.id',
          'task.title',
          'task.log_number',
          'task.description',
          'task.support_type',
          'task.support_type_id',
          'task.client_location',
          'task.bandar_daerah',
          'task.state',
          'task.deadline',
          'task.offer_price',
          'task.status_id',
          'task.equipment_types_id',
          'task.remarks',
          'task.payment_date',
          'task.project_id',
          'task.created_at',
          'task.updated_at',
          'task.assigned_to',
          'statusSetting.id',
          'statusSetting.name',
          'supportTypeSetting.id',
          'supportTypeSetting.name',
          'project.id',
          'project.code',
          'project.name',
          'creator.id',
          'creator.name',
          'creator.email',
          'assignee.id',
          'assignee.name',
          'assignee.email',
          'assigneeRole.name'
        ]);

      // Non-admin users with view:own/assigned can only see tasks assigned to OR created by them.
      if (!canViewAllTasks && canViewOwnTasks && currentUserId) {
        queryBuilder.andWhere(
          '(task.assigned_to = :currentUserId OR task.created_by = :currentUserId)',
          { currentUserId }
        );
      }

      // Apply filters
      if (q) {
        queryBuilder.andWhere(
          '(task.title LIKE :search OR task.log_number LIKE :search OR task.description LIKE :search)',
          { search: `%${q}%` }
        );
      }

      if (status) {
        const statuses = (status as string).split(',');
        queryBuilder.andWhere('statusSetting.name IN (:...statuses)', { statuses });
      }

      if (state) {
        queryBuilder.andWhere('task.state = :state', { state });
      }

      // Support type filter
      const support_type = req.query.support_type || req.query.category; // handle both naming conventions
      if (support_type) {
        const types = (support_type as string).split(',');
        queryBuilder.andWhere('supportTypeSetting.name IN (:...types)', { types });
      }

      if (assigned_to) {
        queryBuilder.andWhere('task.assigned_to = :assigned_to', { assigned_to: Number(assigned_to) });
      }

      if (created_by) {
        queryBuilder.andWhere('task.created_by = :created_by', { created_by: Number(created_by) });
      }

      if (project_id) {
        queryBuilder.andWhere('task.project_id = :project_id', { project_id: Number(project_id) });
      }

      if (dateFrom) {
        queryBuilder.andWhere('task.created_at >= :dateFrom', { dateFrom });
      }

      if (dateTo) {
        queryBuilder.andWhere('task.created_at <= :dateTo', { dateTo });
      }

      // Apply sorting
      queryBuilder.orderBy(`task.${sortBy}`, sort.toString().toUpperCase() as 'ASC' | 'DESC');

      // Apply pagination
      queryBuilder.skip(skip).take(Number(limit));

      const [tasks, total] = await queryBuilder.getManyAndCount();
      const formattedTasks = tasks.map(task => this.formatTaskResponse(task));

      res.json({
        success: true,
        message: 'Tasks retrieved successfully',
        data: {
          tasks: formattedTasks,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            pages: Math.ceil(total / Number(limit))
          }
        }
      });
    } catch (error) {
      console.error('Get tasks error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Get task by ID
   */
  getTaskById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const currentUserId = req.user?.id;
      const userPermissions = req.userPermissions || [];
      const canViewAllTasks = req.user?.role?.toLowerCase() === 'admin' || userPermissions.includes('tasks:view:all');
      const canViewOwnTasks = userPermissions.includes('tasks:view:own') || userPermissions.includes('tasks:view:assigned');

      const task = await this.taskRepository.findOne({
        where: { id: Number(id) },
        relations: [
          'creator',
          'assignee',
          'assignee.role',
          'mainCon',
          'statusSetting',
          'supportTypeSetting',
          'attachments',
          'links',
          'parts',
          'report',
          'feedback'
          ,'project'
        ]
      });

      if (!task) {
        res.status(404).json({
          success: false,
          message: 'Task not found'
        });
        return;
      }

      if (!canViewAllTasks && canViewOwnTasks && currentUserId && task.assigned_to !== currentUserId) {
        res.status(403).json({
          success: false,
          message: 'Anda hanya boleh melihat tugasan yang diassign kepada anda'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Task retrieved successfully',
        data: { task: this.formatTaskResponse(task) }
      });
    } catch (error) {
      console.error('Get task by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Create new task
   */
  createTask = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!this.isAdminOrStaffRole(req.user?.role)) {
        res.status(403).json({
          success: false,
          message: 'Hanya Admin atau Staff dibenarkan mencipta tugasan'
        });
        return;
      }

        const {
          title,
          log_number,
          description,
          support_type,
          support_type_id,
          client_location,
          bandar_daerah,
          state,
          deadline,
          deadline_time,
          requirement_date,
          requirement_time,
          offer_price,
          status,
          status_id,
          remarks,
          links,
          project_id,
          main_con_id,
          pic_name,
          pic_phone,
          client_name,
          asset_tag_id,
          asset_brand,
          asset_model,
          asset_serial_number,
          branch_name,
          service_start_date,
          service_start_time,
          equipment_types_id
        } = req.body;

      let parsedLinks: any[] | undefined = undefined;
      if (links) {
        if (Array.isArray(links)) {
          parsedLinks = links;
        } else if (typeof links === 'string') {
          try {
            const jsonLinks = JSON.parse(links);
            if (Array.isArray(jsonLinks)) parsedLinks = jsonLinks;
          } catch (_) {
            parsedLinks = undefined;
          }
        }
      }

      const creatorId = req.user?.id;
      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';

      if (!creatorId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
        return;
      }

      const requestedLogNumber = typeof log_number === 'string' ? log_number.trim() : '';
      let logNumber = requestedLogNumber;

      if (!logNumber) {
        logNumber = await this.generateLogNumber();
      } else {
        const duplicateTask = await this.taskRepository.findOne({ where: { log_number: logNumber } });
        if (duplicateTask) {
          res.status(409).json({
            success: false,
            message: `No Log sudah wujud: ${logNumber}. Sila gunakan No Log lain atau kosongkan untuk auto.`
          });
          return;
        }
      }

      const resolvedSupportType = await this.resolveSupportType(
        support_type_id ? Number(support_type_id) : undefined,
        support_type
      );

      if (!resolvedSupportType) {
        res.status(400).json({
          success: false,
          message: 'Jenis sokongan tidak sah. Sila pilih dari tetapan tugasan.'
        });
        return;
      }

      if (this.isRequiredAssetSupportTypeName(resolvedSupportType.name) && !this.hasAssetIdentifier(asset_tag_id, asset_serial_number)) {
        res.status(400).json({
          success: false,
          message: 'Untuk jenis sokongan ini, sekurang-kurangnya Tag ID atau Serial Number aset perlu diisi.'
        });
        return;
      }

      const requestedStatus = typeof status === 'string' ? status : TaskStatus.BARU;
      const resolvedStatus = await this.resolveTaskStatus(
        status_id ? Number(status_id) : undefined,
        requestedStatus
      );

      const resolvedEquipmentTypeIds = await this.resolveEquipmentTypeIds(equipment_types_id);

      if (!resolvedStatus) {
        res.status(400).json({
          success: false,
          message: 'Status tugasan tidak sah. Sila pilih dari tetapan tugasan.'
        });
        return;
      }

      // Create task
      const normalizedRequirementDate = requirement_date ? new Date(requirement_date) : undefined;
      const normalizedRequirementTime = requirement_time ? String(requirement_time) : undefined;
      const normalizedDeadlineDate = deadline ? new Date(deadline) : normalizedRequirementDate;
      const normalizedDeadlineTime = deadline_time ? String(deadline_time) : normalizedRequirementTime;
      const normalizedServiceStartDate = service_start_date ? new Date(service_start_date) : normalizedRequirementDate;
      const normalizedServiceStartTime = service_start_time ? String(service_start_time) : normalizedRequirementTime;

      const task = this.taskRepository.create({
        title: (title && String(title).trim().length >= 1)
          ? String(title).trim()
          : [resolvedSupportType.name, client_name || branch_name || client_location].filter(Boolean).join(' - ') || 'Tugasan Baru',
        log_number: logNumber,
        description: description || '',
        support_type: resolvedSupportType.name,
        support_type_id: resolvedSupportType.id,
        client_location,
        bandar_daerah,
        state,
        deadline: normalizedDeadlineDate,
        deadline_time: normalizedDeadlineTime,
        requirement_date: normalizedRequirementDate,
        requirement_time: normalizedRequirementTime,
        offer_price: offer_price !== undefined && offer_price !== '' ? Number(offer_price) : 0,
        status_id: resolvedStatus.id,
        created_by: creatorId,
        remarks: remarks || '',
        project_id: project_id ? Number(project_id) : undefined,
        main_con_id: main_con_id ? Number(main_con_id) : undefined,
        pic_name,
        pic_phone,
        client_name,
        asset_tag_id,
        asset_brand,
        asset_model,
        asset_serial_number,
        branch_name,
        service_start_date: normalizedServiceStartDate,
        service_start_time: normalizedServiceStartTime,
        equipment_types_id: resolvedEquipmentTypeIds,
        created_at: new Date(),
        updated_at: new Date()
      });

      const savedTask = await this.taskRepository.save(task);

      // Handle file attachments
      const uploadedCreateFiles = ((req as any).files || []) as any[];
      if (Array.isArray(uploadedCreateFiles) && uploadedCreateFiles.length > 0) {
        const attachments = uploadedCreateFiles.map(file => {
          const fileInfo = getFileInfo(file);
          return this.taskAttachmentRepository.create({
            task_id: savedTask.id,
            file_name: fileInfo.originalname,
            file_path: fileInfo.relativePath,
            file_type: fileInfo.mimetype,
            file_size: fileInfo.size,
            created_at: new Date()
          });
        });
        
        await this.taskAttachmentRepository.save(attachments);
      }

      // Handle links
      if (parsedLinks && Array.isArray(parsedLinks)) {
        const linkEntities = parsedLinks.map(link => 
          this.taskLinkRepository.create({
            task_id: savedTask.id,
            url: link.url,
            description: link.description || '',
            created_at: new Date()
          })
        );
        
        await this.taskLinkRepository.save(linkEntities);
      }

      // Log task creation
      await this.authService.logActivity(
        creatorId,
        ActivityType.TASK_CREATED,
          `Created task: ${savedTask.title} (${logNumber})`,
        clientIp,
        userAgent,
        { taskId: savedTask.id, logNumber }
      );

      // Audit Trail
      await AuditService.log({
        req,
        userId: creatorId,
        actionType: 'CREATE',
        tableName: 'tasks',
        recordId: savedTask.id,
        newValues: savedTask,
          description: `Mencipta tugasan baru: ${savedTask.title} (${logNumber})`
      });

      // Get complete task data for response
      const completeTask = await this.taskRepository.findOne({
        where: { id: savedTask.id },
        relations: ['creator', 'statusSetting', 'supportTypeSetting', 'attachments', 'links', 'project']
      });

      res.status(201).json({
        success: true,
        message: 'Task created successfully',
        data: { task: this.formatTaskResponse(completeTask) }
      });
    } catch (error) {
      console.error('Create task error:', error);
      const debugMessage = process.env.NODE_ENV === 'development' && error instanceof Error && error.message
        ? error.message
        : 'Internal server error';
      res.status(500).json({
        success: false,
        message: debugMessage
      });
    }
  };

  duplicateTask = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!this.isAdminOrStaffRole(req.user?.role)) {
        res.status(403).json({
          success: false,
          message: 'Hanya Admin atau Staff dibenarkan menduplikasi tugasan'
        });
        return;
      }
      const creatorId = req.user?.id;
      if (!creatorId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
        return;
      }

      const id = Number(req.params.id);
      const original = await this.taskRepository.findOne({
        where: { id },
        relations: ['links', 'parts', 'supportTypeSetting', 'statusSetting', 'project']
      });

      if (!original) {
        res.status(404).json({
          success: false,
          message: 'Task not found'
        });
        return;
      }

      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';

      const resolvedStatus = await this.resolveTaskStatus(undefined, TaskStatus.BARU);
      if (!resolvedStatus) {
        res.status(400).json({
          success: false,
          message: 'Status tugasan tidak sah. Sila pilih dari tetapan tugasan.'
        });
        return;
      }

      const result = await AppDataSource.transaction(async manager => {
        const taskRepo = manager.getRepository(Task);
        const taskLinkRepo = manager.getRepository(TaskLink);
        const taskPartRepo = manager.getRepository(TaskPart);

        const baseTitle = String(original.title || '').trim() || 'Tugasan';
        const prefixTitle = `Copy of ${baseTitle}`;

        let newTitle = prefixTitle;
        for (let suffix = 2; suffix <= 200; suffix += 1) {
          const existingCount = await taskRepo.count({
            where: original.project_id
              ? ({ project_id: original.project_id, title: newTitle } as any)
              : ({ title: newTitle } as any)
          });
          if (!existingCount) break;
          newTitle = `${prefixTitle} (${suffix})`;
        }

        let savedTask: Task | null = null;
        let lastError: unknown = null;
        for (let attempt = 0; attempt < 5; attempt += 1) {
          const logNumber = await this.generateLogNumber();
          try {
            const cloned = taskRepo.create({
              title: newTitle,
              log_number: logNumber,
              description: original.description || '',
              support_type: original.support_type || original.supportTypeSetting?.name || null,
              support_type_id: original.support_type_id || original.supportTypeSetting?.id || null,
              client_location: original.client_location,
              bandar_daerah: (original as any).bandar_daerah,
              state: (original as any).state,
              deadline: (original as any).deadline,
              deadline_time: (original as any).deadline_time,
              requirement_date: (original as any).requirement_date,
              requirement_time: (original as any).requirement_time,
              offer_price: (original as any).offer_price ?? 0,
              status_id: (original as any).status_id ?? resolvedStatus.id,
              created_by: creatorId,
              remarks: (original as any).remarks || '',
              project_id: (original as any).project_id ?? null,
              main_con_id: (original as any).main_con_id ?? null,
              pic_name: (original as any).pic_name ?? null,
              pic_phone: (original as any).pic_phone ?? null,
              client_name: (original as any).client_name ?? null,
              asset_tag_id: (original as any).asset_tag_id ?? null,
              asset_brand: (original as any).asset_brand ?? null,
              asset_model: (original as any).asset_model ?? null,
              asset_serial_number: (original as any).asset_serial_number ?? null,
              branch_name: (original as any).branch_name ?? null,
              service_start_date: (original as any).service_start_date ?? null,
              service_start_time: (original as any).service_start_time ?? null,
              equipment_types_id: (original as any).equipment_types_id ?? null,
              assigned_to: (original as any).assigned_to ?? null,
              created_at: new Date(),
              updated_at: new Date()
            } as Partial<Task>);

            savedTask = await taskRepo.save(cloned);

            if (Array.isArray((original as any).links) && (original as any).links.length) {
              const linkEntities = (original as any).links.map((link: any) =>
                taskLinkRepo.create({
                  task_id: savedTask!.id,
                  url: link.url,
                  description: link.description || '',
                  created_at: new Date()
                })
              );
              await taskLinkRepo.save(linkEntities);
            }

            if (Array.isArray((original as any).parts) && (original as any).parts.length) {
              const partEntities = (original as any).parts.map((part: any) =>
                taskPartRepo.create({
                  task_id: savedTask!.id,
                  part_number: part.part_number || part.partNumber || '',
                  description: part.description || '',
                  quantity: Number(part.quantity || 0)
                })
              );
              await taskPartRepo.save(partEntities);
            }

            await this.authService.logActivity(
              creatorId,
              ActivityType.TASK_CREATED,
              `Duplicated task: ${savedTask.title} (${savedTask.log_number})`,
              clientIp,
              userAgent,
              { taskId: savedTask.id, fromTaskId: original.id }
            );

            await AuditService.log({
              req,
              userId: creatorId,
              actionType: 'CREATE',
              tableName: 'tasks',
              recordId: savedTask.id,
              newValues: savedTask,
              description: `Menduplikasi tugasan: ${savedTask.title} (${savedTask.log_number})`
            });

            break;
          } catch (error: any) {
            lastError = error;
            const code = String(error?.code || '');
            const msg = String(error?.message || '');
            if (code === 'ER_DUP_ENTRY' && msg.includes('log_number')) {
              continue;
            }
            throw error;
          }
        }

        if (!savedTask) {
          throw lastError || new Error('Failed to duplicate task');
        }

        const completeTask = await taskRepo.findOne({
          where: { id: savedTask.id },
          relations: ['creator', 'statusSetting', 'supportTypeSetting', 'attachments', 'links', 'parts', 'project']
        });

        return completeTask;
      });

      res.status(201).json({
        success: true,
        message: 'Task duplicated successfully',
        data: { task: this.formatTaskResponse(result) }
      });
    } catch (error) {
      console.error('Duplicate task error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Update task
   */
  updateTask = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!this.isAdminOrStaffRole(req.user?.role)) {
        res.status(403).json({
          success: false,
          message: 'Hanya Admin atau Staff dibenarkan mengemaskini tugasan'
        });
        return;
      }

      const { id } = req.params;
      const {
        title,
        description,
        support_type,
        support_type_id,
        status,
        status_id,
        client_location,
        bandar_daerah,
        state,
        deadline,
        deadline_time,
        requirement_date,
        requirement_time,
        offer_price,
        remarks,
        project_id,
        main_con_id,
        pic_name,
        pic_phone,
        client_name,
        asset_tag_id,
        asset_brand,
        asset_model,
        asset_serial_number,
        branch_name,
        service_start_date,
        service_start_time,
        equipment_types_id
      } = req.body;
      const updaterId = req.user?.id;
      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';

      const task = await this.taskRepository.findOne({
        where: { id: Number(id) },
        relations: ['creator']
      });

      if (!task) {
        res.status(404).json({
          success: false,
          message: 'Task not found'
        });
        return;
      }

      // Update task data
      const updateData: Partial<Task> = {
        updated_at: new Date()
      };

      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description;

      if (support_type_id !== undefined || support_type !== undefined) {
        const resolvedSupportType = await this.resolveSupportType(
          support_type_id !== undefined ? Number(support_type_id) : undefined,
          support_type
        );

        if (!resolvedSupportType) {
          res.status(400).json({
            success: false,
            message: 'Jenis sokongan tidak sah. Sila pilih dari tetapan tugasan.'
          });
          return;
        }

        updateData.support_type = resolvedSupportType.name;
        updateData.support_type_id = resolvedSupportType.id;
      }

      const effectiveSupportType = String(updateData.support_type || task.support_type || '').trim();
      const effectiveAssetTag = asset_tag_id !== undefined ? asset_tag_id : task.asset_tag_id;
      const effectiveAssetSerial = asset_serial_number !== undefined ? asset_serial_number : task.asset_serial_number;

      if (this.isRequiredAssetSupportTypeName(effectiveSupportType) && !this.hasAssetIdentifier(effectiveAssetTag, effectiveAssetSerial)) {
        res.status(400).json({
          success: false,
          message: 'Untuk jenis sokongan ini, sekurang-kurangnya Tag ID atau Serial Number aset perlu diisi.'
        });
        return;
      }

      if (status_id !== undefined || status !== undefined) {
        const resolvedStatus = await this.resolveTaskStatus(
          status_id !== undefined ? Number(status_id) : undefined,
          status
        );

        if (!resolvedStatus) {
          res.status(400).json({
            success: false,
            message: 'Status tugasan tidak sah. Sila pilih dari tetapan tugasan.'
          });
          return;
        }

        updateData.status_id = resolvedStatus.id;
      }

      if (client_location !== undefined) updateData.client_location = client_location;
      if (bandar_daerah !== undefined) updateData.bandar_daerah = bandar_daerah;
      if (state !== undefined) updateData.state = state;
      if (deadline !== undefined) updateData.deadline = deadline ? new Date(deadline) : undefined;
      if (deadline_time !== undefined) updateData.deadline_time = deadline_time ? String(deadline_time) : undefined;
      if (requirement_date !== undefined) updateData.requirement_date = requirement_date ? new Date(requirement_date) : undefined;
      if (requirement_time !== undefined) updateData.requirement_time = requirement_time ? String(requirement_time) : undefined;
      if (offer_price !== undefined) updateData.offer_price = Number(offer_price);
      if (remarks !== undefined) updateData.remarks = remarks;
      if (project_id !== undefined) {
        updateData.project_id = project_id === null || project_id === '' ? undefined : Number(project_id);
      }
      if (main_con_id !== undefined) updateData.main_con_id = Number(main_con_id);
      if (pic_name !== undefined) updateData.pic_name = pic_name;
      if (pic_phone !== undefined) updateData.pic_phone = pic_phone;
      if (client_name !== undefined) updateData.client_name = client_name;
      if (asset_tag_id !== undefined) updateData.asset_tag_id = asset_tag_id;
      if (asset_brand !== undefined) updateData.asset_brand = asset_brand;
      if (asset_model !== undefined) updateData.asset_model = asset_model;
      if (asset_serial_number !== undefined) updateData.asset_serial_number = asset_serial_number;
      if (branch_name !== undefined) updateData.branch_name = branch_name;
      if (service_start_date !== undefined) updateData.service_start_date = service_start_date ? new Date(service_start_date) : undefined;
      if (service_start_time !== undefined) updateData.service_start_time = service_start_time ? String(service_start_time) : undefined;
      if (equipment_types_id !== undefined) {
        updateData.equipment_types_id = await this.resolveEquipmentTypeIds(equipment_types_id);
      }

      const hasRequirementChange = requirement_date !== undefined || requirement_time !== undefined;
      if (hasRequirementChange) {
        const effectiveRequirementDate = requirement_date !== undefined
          ? (requirement_date ? new Date(requirement_date) : undefined)
          : (task.requirement_date || undefined);
        const effectiveRequirementTime = requirement_time !== undefined
          ? (requirement_time ? String(requirement_time) : undefined)
          : (task.requirement_time || undefined);

        if (deadline === undefined && effectiveRequirementDate) updateData.deadline = effectiveRequirementDate;
        if (deadline_time === undefined && effectiveRequirementTime) updateData.deadline_time = effectiveRequirementTime;
        if (service_start_date === undefined && effectiveRequirementDate) updateData.service_start_date = effectiveRequirementDate;
        if (service_start_time === undefined && effectiveRequirementTime) updateData.service_start_time = effectiveRequirementTime;
      }

      await this.taskRepository.update(Number(id), updateData);

      // Handle new file attachments on update
      const uploadedFiles = ((req as any).files || []) as any[];
      if (Array.isArray(uploadedFiles) && uploadedFiles.length > 0) {
        const attachments = uploadedFiles.map(file => {
          const fileInfo = getFileInfo(file);
          return this.taskAttachmentRepository.create({
            task_id: Number(id),
            file_name: fileInfo.originalname,
            file_path: fileInfo.relativePath,
            file_type: fileInfo.mimetype,
            file_size: fileInfo.size,
            created_at: new Date()
          });
        });

        await this.taskAttachmentRepository.save(attachments);
      }

      // Log task update
      if (updaterId) {
        await this.authService.logActivity(
          updaterId,
          ActivityType.TASK_UPDATED,
          `Updated task: ${task.title} (${task.log_number})`,
          clientIp,
          userAgent,
          { taskId: Number(id), updatedFields: Object.keys(updateData) }
        );

        // Audit Trail
        await AuditService.log({
            req,
            userId: updaterId,
            actionType: 'UPDATE',
            tableName: 'tasks',
            recordId: Number(id),
            oldValues: task,
            newValues: updateData,
            description: `Mengemaskini tugasan: ${task.title}`
        });
      }

      // Get updated task
      const updatedTask = await this.taskRepository.findOne({
        where: { id: Number(id) },
        relations: ['creator', 'assignee', 'statusSetting', 'supportTypeSetting', 'attachments', 'links', 'project']
      });

      res.json({
        success: true,
        message: 'Task updated successfully',
        data: { task: this.formatTaskResponse(updatedTask) }
      });
    } catch (error) {
      console.error('Update task error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Update task status
   */
  updateTaskStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { status, remarks } = req.body;
      const updaterId = req.user?.id;
      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';

      const task = await this.taskRepository.findOne({
        where: { id: Number(id) },
        relations: ['creator', 'assignee', 'statusSetting']
      });

      if (!task) {
        res.status(404).json({
          success: false,
          message: 'Task not found'
        });
        return;
      }

      const oldStatus = task.statusSetting?.name || null;

      const requesterRole = String(req.user?.role || '').toLowerCase();
      const isAdminOrStaffRequester = this.isAdminOrStaffRole(requesterRole);
      const isFreelancerRequester = requesterRole.includes('freelancer') || requesterRole.includes('freelance tech');
      if (!isAdminOrStaffRequester && !isFreelancerRequester) {
        res.status(403).json({
          success: false,
          message: 'Peranan ini hanya dibenarkan melihat tugasan. Hanya Admin/Staff boleh mengubah status, kecuali freelancer untuk hantar tugasan sendiri.'
        });
        return;
      }

      let shouldClearAssignment = false;
      if (isFreelancerRequester) {
        const isOwnAssignedTask = Number(task.assigned_to || task.assignee?.id || 0) === Number(req.user?.id || 0);
        if (!isOwnAssignedTask) {
          res.status(403).json({
            success: false,
            message: 'Freelancer hanya boleh kemaskini status tugasan sendiri'
          });
          return;
        }

        const isAcceptingOwnOffer = status === TaskStatus.TELAH_DIAMBIL && oldStatus === TaskStatus.TAWARAN_DIHANTAR;
        const isRejectingOwnOffer = status === TaskStatus.BARU && oldStatus === TaskStatus.TAWARAN_DIHANTAR;
        const isSubmittingCompletion = status === TaskStatus.SELESAI;

        if (isRejectingOwnOffer) {
          shouldClearAssignment = true;
        }

        if (!isAcceptingOwnOffer && !isRejectingOwnOffer && !isSubmittingCompletion) {
          res.status(403).json({
            success: false,
            message: 'Freelancer hanya dibenarkan Terima/Tolak tawaran sendiri atau set status ke Selesai'
          });
          return;
        }
      }

      const statusSetting = await this.resolveTaskStatus(undefined, status);

      if (!statusSetting) {
        res.status(400).json({
          success: false,
          message: 'Status tugasan tidak sah. Sila pilih dari tetapan tugasan.'
        });
        return;
      }
      
      // Update task status
      const updateData: Partial<Task> = {
        status_id: statusSetting.id,
        updated_at: new Date()
      };

      if (shouldClearAssignment) {
        // Reset assignment so task can be re-offered after freelancer rejects.
        updateData.assigned_to = null as any;
      }

      if (remarks !== undefined) {
        updateData.remarks = remarks;
      }

      // Set payment date if status is 'Telah Dibayar'
      if (status === TaskStatus.TELAH_DIBAYAR) {
        updateData.payment_date = new Date();
      }

      await this.taskRepository.update(Number(id), updateData);

      // Create notifications based on status change
      if (task.assignee && statusSetting.name !== oldStatus) {
        let notificationTitle = '';
        let notificationMessage = '';
        let notificationType = NotificationType.TASK_STATUS_CHANGED;

        switch (status) {
          case TaskStatus.BARU:
            notificationTitle = 'Task Offer Rejected';
            notificationMessage = `Offer ditolak oleh freelancer untuk tugasan: ${task.title}`;
            break;
          case TaskStatus.TAWARAN_DIHANTAR:
            notificationTitle = 'Task Offer Sent';
            notificationMessage = `An offer has been sent for task: ${task.title}`;
            break;
          case TaskStatus.TELAH_DIAMBIL:
            notificationTitle = 'Task Assigned';
            notificationMessage = `Task has been assigned to you: ${task.title}`;
            notificationType = NotificationType.TASK_ASSIGNED;
            break;
          case TaskStatus.SELESAI:
            notificationTitle = 'Task Completed';
            notificationMessage = `Task has been marked as completed: ${task.title}`;
            notificationType = NotificationType.TASK_COMPLETED;
            break;
          case TaskStatus.TELAH_DIBAYAR:
            notificationTitle = 'Payment Received';
            notificationMessage = `Payment has been processed for task: ${task.title}`;
            break;
          case TaskStatus.DIBATALKAN:
            notificationTitle = 'Task Cancelled';
            notificationMessage = `Task has been cancelled: ${task.title}`;
            break;
        }

        if (notificationTitle) {
          await this.createNotification(
            task.assignee.id,
            task.id,
            notificationType,
            notificationTitle,
            notificationMessage,
            { req, triggerUserId: updaterId }
          );
        }
      }

      // Log status change
      if (updaterId) {
        const isFreelancerAcceptAction = isFreelancerRequester && oldStatus === TaskStatus.TAWARAN_DIHANTAR && statusSetting.name === TaskStatus.TELAH_DIAMBIL;
        const isFreelancerRejectAction = isFreelancerRequester && oldStatus === TaskStatus.TAWARAN_DIHANTAR && statusSetting.name === TaskStatus.BARU;

        const activityDescription = isFreelancerAcceptAction
          ? `Freelancer menerima tawaran tugasan: ${task.title} (${task.log_number})`
          : isFreelancerRejectAction
            ? `Freelancer menolak tawaran tugasan: ${task.title} (${task.log_number})`
            : `Changed task status from ${oldStatus} to ${status}: ${task.title} (${task.log_number})`;

        const auditDescription = isFreelancerAcceptAction
          ? `Freelancer menerima tawaran tugasan ${task.title}`
          : isFreelancerRejectAction
            ? `Freelancer menolak tawaran tugasan ${task.title}`
            : `Mengubah status tugasan ${task.title} kepada ${statusSetting.name}`;

        await this.authService.logActivity(
          updaterId,
          'task_status_changed' as ActivityType,
          activityDescription,
          clientIp,
          userAgent,
          { taskId: Number(id), oldStatus, newStatus: statusSetting.name }
        );

        // Audit Trail
        await AuditService.log({
            req,
            userId: updaterId,
            actionType: 'UPDATE',
            tableName: 'tasks',
            recordId: Number(id),
            oldValues: { status: oldStatus },
            newValues: { status: statusSetting.name, status_id: statusSetting.id, remarks },
            description: auditDescription
        });
      }

      res.json({
        success: true,
        message: `Task status updated to ${statusSetting.name}`,
        data: { status: statusSetting.name, status_id: statusSetting.id }
      });
    } catch (error) {
      console.error('Update task status error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Assign task to freelancer
   */
  assignTask = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!this.isAdminOrStaffRole(req.user?.role)) {
        res.status(403).json({
          success: false,
          message: 'Hanya Admin atau Staff dibenarkan mengagihkan tugasan'
        });
        return;
      }

      const { id } = req.params;
      const { assigned_to } = req.body;
      const assignerId = req.user?.id;
      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';

      const task = await this.taskRepository.findOne({
        where: { id: Number(id) },
        relations: ['creator', 'statusSetting']
      });

      if (!task) {
        res.status(404).json({
          success: false,
          message: 'Task not found'
        });
        return;
      }

      // Handle unassign (removing assignment)
      if (assigned_to === null) {
        const baruStatus = await this.resolveTaskStatus(undefined, TaskStatus.BARU);
        await this.taskRepository.update(Number(id), {
          assigned_to: null,
          status_id: baruStatus?.id || task.status_id,
          updated_at: new Date()
        });

        res.json({
          success: true,
          message: 'Freelancer berjaya dibuang dari tugasan'
        });
        return;
      }

      // Verify assignee exists and is a freelancer
      const assignee = await this.userRepository.findOne({
        where: { id: assigned_to },
        relations: ['role']
      });

      if (!assignee) {
        res.status(404).json({
          success: false,
          message: 'Assignee not found'
        });
        return;
      }

      if (assignee.role.name !== 'Freelancer' && assignee.role.name !== 'Freelance Tech') {
        res.status(400).json({
          success: false,
          message: 'User is not a freelancer'
        });
        return;
      }

      if (assignee.status !== UserStatus.AKTIF) {
        res.status(400).json({
          success: false,
          message: 'Freelancer is not active'
        });
        return;
      }

      const assignedStatus = await this.resolveTaskStatus(undefined, TaskStatus.TELAH_DIAMBIL);
      if (!assignedStatus) {
        res.status(400).json({
          success: false,
          message: 'Status Telah Diambil tidak ditemui dalam tetapan tugasan'
        });
        return;
      }

      // Assign task
      await this.taskRepository.update(Number(id), {
        assigned_to,
        status_id: assignedStatus.id,
        updated_at: new Date()
      });

      // Create notification for assignee
      await this.createNotification(
        assigned_to,
        task.id,
        NotificationType.TASK_ASSIGNED,
        'New Task Assigned',
        `You have been assigned a new task: ${task.title}`,
        { req, triggerUserId: assignerId }
      );

      // Log task assignment
      if (assignerId) {
        await this.authService.logActivity(
          assignerId,
          ActivityType.TASK_ASSIGNED,
          `Assigned task to ${assignee.name}: ${task.title} (${task.log_number})`,
          clientIp,
          userAgent,
          { taskId: Number(id), assigneeId: assigned_to }
        );

        // Audit Trail
        await AuditService.log({
            req,
            userId: assignerId,
            actionType: 'UPDATE',
            tableName: 'tasks',
            recordId: Number(id),
            oldValues: { assigned_to: task.assigned_to, status: task.statusSetting?.name || null },
            newValues: { assigned_to, status: assignedStatus.name, status_id: assignedStatus.id },
            description: `Menugaskan ${task.title} kepada ${assignee.name}`
        });
      }

      res.json({
        success: true,
        message: 'Task assigned successfully',
        data: { assigned_to, assignee_name: assignee.name }
      });
    } catch (error) {
      console.error('Assign task error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Submit task report
   */
  submitTaskReport = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { notes } = req.body;
      const submitterId = req.user?.id;
      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';

      const task = await this.taskRepository.findOne({
        where: { id: Number(id) },
        relations: ['assignee', 'creator', 'statusSetting']
      });

      if (!task) {
        res.status(404).json({
          success: false,
          message: 'Task not found'
        });
        return;
      }

      if (!task.assignee || task.assignee.id !== submitterId) {
        res.status(403).json({
          success: false,
          message: 'Only the assigned freelancer can submit reports'
        });
        return;
      }

      const uploadedReportFiles = ((req as any).files || []) as any[];
      const uploadedReportFile = ((req as any).file || (Array.isArray(uploadedReportFiles) ? uploadedReportFiles[0] : undefined)) as any;

      if (!uploadedReportFile) {
        res.status(400).json({
          success: false,
          message: 'Report file is required'
        });
        return;
      }

      // Check if report already exists
      const existingReport = await this.taskReportRepository.findOne({
        where: { task_id: Number(id) }
      });

      if (existingReport) {
        // Delete old file
        if (fs.existsSync(existingReport.file_url)) {
          fs.unlinkSync(existingReport.file_url);
        }
        
        // Update existing report
        const fileInfo = getFileInfo(uploadedReportFile);
        await this.taskReportRepository.update(existingReport.id, {
          file_url: fileInfo.relativePath,
          notes: notes || '',
          submitted_at: new Date()
        });
      } else {
        // Create new report
        const fileInfo = getFileInfo(uploadedReportFile);
        const report = this.taskReportRepository.create({
          task_id: Number(id),
          file_url: fileInfo.relativePath,
          notes: notes || '',
          submitted_at: new Date(),
          created_at: new Date()
        });
        
        await this.taskReportRepository.save(report);
      }

      const completedStatus = await this.resolveTaskStatus(undefined, TaskStatus.SELESAI);
      if (!completedStatus) {
        res.status(400).json({
          success: false,
          message: 'Status Selesai tidak ditemui dalam tetapan tugasan'
        });
        return;
      }

      // Update task status to completed
      await this.taskRepository.update(Number(id), {
        status_id: completedStatus.id,
        updated_at: new Date()
      });

      // Create notification for task creator
      await this.createNotification(
        task.creator.id,
        task.id,
        NotificationType.TASK_COMPLETED,
        'Task Report Submitted',
        `${task.assignee.name} has submitted a report for task: ${task.title}`,
        { req, triggerUserId: submitterId }
      );

      // Log report submission
      if (submitterId) {
        await this.authService.logActivity(
          submitterId,
          ActivityType.TASK_COMPLETED,
          `Submitted report for task: ${task.title} (${task.log_number})`,
          clientIp,
          userAgent,
          { taskId: Number(id) }
        );

        // Audit Trail
        await AuditService.log({
            req,
            userId: submitterId,
            actionType: 'UPDATE',
            tableName: 'tasks',
            recordId: Number(id),
            oldValues: { status: task.statusSetting?.name || null },
            newValues: { status: completedStatus.name, status_id: completedStatus.id, report_url: existingReport ? existingReport.file_url : getFileInfo(uploadedReportFile).relativePath },
            description: `Menghantar laporan tugasan: ${task.title}`
        });
      }

      res.json({
        success: true,
        message: 'Task report submitted successfully'
      });
    } catch (error) {
      console.error('Submit task report error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Submit task feedback
   */
  submitTaskFeedback = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const {
        skill_rating,
        communication_rating,
        time_punctuality_rating,
        response_time_rating,
        overall_rating,
        comment
      } = req.body;
      const submitterId = req.user?.id;
      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';

      const task = await this.taskRepository.findOne({
        where: { id: Number(id) },
        relations: ['creator', 'assignee', 'statusSetting']
      });

      if (!task) {
        res.status(404).json({
          success: false,
          message: 'Task not found'
        });
        return;
      }

      if (task.creator.id !== submitterId) {
        res.status(403).json({
          success: false,
          message: 'Only the task creator can submit feedback'
        });
        return;
      }

      const validFeedbackStatuses = [TaskStatus.SELESAI, TaskStatus.BORANG_DISEMAK, TaskStatus.TELAH_DIBAYAR, TaskStatus.SELESAI_PENUH];
      if (!validFeedbackStatuses.includes((task.statusSetting?.name || '') as any)) {
        res.status(400).json({
          success: false,
          message: 'Task must be completed before submitting feedback'
        });
        return;
      }

      // Check if feedback already exists
      const existingFeedback = await this.taskFeedbackRepository.findOne({
        where: { task_id: Number(id) }
      });

      if (existingFeedback) {
        res.status(400).json({
          success: false,
          message: 'Feedback has already been submitted for this task'
        });
        return;
      }

      // Create feedback
      // Auto-calculate overall_rating from 4 criteria
      const autoOverall = Math.round((Number(skill_rating) + Number(communication_rating) + Number(time_punctuality_rating) + Number(response_time_rating)) / 4);

      const feedback = this.taskFeedbackRepository.create({
        task_id: Number(id),
        skill_rating: Number(skill_rating),
        communication_rating: Number(communication_rating),
        time_punctuality_rating: Number(time_punctuality_rating),
        response_time_rating: Number(response_time_rating),
        overall_rating: autoOverall,
        comment: comment || ''
      });

      await this.taskFeedbackRepository.save(feedback);

      // Update freelancer's overall rating
      if (task.assignee) {
        const freelancerFeedbacks = await this.taskFeedbackRepository
          .createQueryBuilder('feedback')
          .innerJoin('feedback.task', 'task')
          .where('task.assigned_to = :freelancerId', { freelancerId: task.assignee.id })
          .getMany();

        const totalRating = freelancerFeedbacks.reduce((sum, fb) => sum + fb.overall_rating, 0);
        const averageRating = totalRating / freelancerFeedbacks.length;

        await this.userRepository.update(task.assignee.id, {
          rating: Math.round(averageRating * 10) / 10, // Round to 1 decimal place
          updated_at: new Date()
        });
      }

      const reviewedStatus = await this.resolveTaskStatus(undefined, TaskStatus.BORANG_DISEMAK_PEMBAYARAN_TERTUNGGAK);
      if (!reviewedStatus) {
        res.status(400).json({
          success: false,
          message: 'Status Borang Disemak & Pembayaran Tertunggak tidak ditemui dalam tetapan tugasan'
        });
        return;
      }

      // Update task status
      await this.taskRepository.update(Number(id), {
        status_id: reviewedStatus.id,
        updated_at: new Date()
      });

      // Log feedback submission
      if (submitterId) {
        await this.authService.logActivity(
          submitterId,
          ActivityType.FEEDBACK_SUBMITTED,
          `Submitted feedback for task: ${task.title} (${task.log_number})`,
          clientIp,
          userAgent,
          { taskId: Number(id), overallRating: autoOverall }
        );

        // Audit Trail
        await AuditService.log({
            req,
            userId: submitterId,
            actionType: 'UPDATE',
            tableName: 'tasks',
            recordId: Number(id),
            oldValues: { status: task.statusSetting?.name || null },
            newValues: { status: reviewedStatus.name, status_id: reviewedStatus.id, feedback },
            description: `Menghantar maklum balas tugasan: ${task.title}`
        });
      }

      res.json({
        success: true,
        message: 'Task feedback submitted successfully'
      });
    } catch (error) {
      console.error('Submit task feedback error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Delete a single task attachment
   */
  deleteTaskAttachment = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!this.isAdminOrStaffRole(req.user?.role)) {
        res.status(403).json({
          success: false,
          message: 'Hanya Admin atau Staff dibenarkan memadam lampiran tugasan'
        });
        return;
      }

      const { id, attachmentId } = req.params;

      const task = await this.taskRepository.findOne({ where: { id: Number(id) } });
      if (!task) {
        res.status(404).json({ success: false, message: 'Task not found' });
        return;
      }

      const attachment = await this.taskAttachmentRepository.findOne({
        where: {
          id: Number(attachmentId),
          task_id: Number(id)
        }
      });

      if (!attachment) {
        res.status(404).json({ success: false, message: 'Attachment not found' });
        return;
      }

      const absolutePath = path.isAbsolute(attachment.file_path)
        ? attachment.file_path
        : path.resolve(process.cwd(), attachment.file_path);

      if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
      }

      await this.taskAttachmentRepository.remove(attachment);

      res.json({
        success: true,
        message: 'Lampiran berjaya dipadam',
        data: { id: Number(attachmentId) }
      });
    } catch (error) {
      console.error('Delete task attachment error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  };

  /**
   * Delete task
   */
  deleteTask = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const taskId = Number(id);
      const deleterId = req.user?.id;
      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';

      const task = await this.taskRepository.findOne({
        where: { id: taskId },
        relations: ['attachments']
      });

      if (!task) {
        res.status(404).json({
          success: false,
          message: 'Task not found'
        });
        return;
      }

      const attachmentPaths = (task.attachments || []).map(attachment => attachment.file_path);

      await AppDataSource.transaction(async (manager) => {
        const isMissingTableError = (err: any) => {
          const code = err?.code || err?.driverError?.code;
          const errno = err?.errno || err?.driverError?.errno;
          return code === 'ER_NO_SUCH_TABLE' || errno === 1146;
        };

        const safeDelete = async (entity: any, where: any) => {
          try {
            await manager.getRepository(entity).delete(where);
          } catch (err) {
            if (isMissingTableError(err)) return;
            throw err;
          }
        };

        await safeDelete(Notification, { task_id: taskId });
        await safeDelete(TaskReminder, { task_id: taskId });
        await safeDelete(TaskOffer, { task_id: taskId });
        await safeDelete(TaskWaitingList, { task_id: taskId });
        await safeDelete(Payment, { task_id: taskId });
        await safeDelete(TaskDone, { task_id: taskId });
        await safeDelete(TaskPart, { task_id: taskId });
        await safeDelete(TaskLink, { task_id: taskId });
        await safeDelete(TaskReport, { task_id: taskId });
        await safeDelete(TaskFeedback, { task_id: taskId });
        await safeDelete(TaskAttachment, { task_id: taskId });
        await safeDelete(Task, { id: taskId });
      });

      attachmentPaths.forEach((filePath) => {
        const absolutePath = path.isAbsolute(filePath)
          ? filePath
          : path.resolve(process.cwd(), filePath);

        try {
          if (fs.existsSync(absolutePath)) {
            fs.unlinkSync(absolutePath);
          }
        } catch (err) {
          console.error('Failed to delete attachment file:', absolutePath, err);
        }
      });

      // Log task deletion
      if (deleterId) {
        await this.authService.logActivity(
          deleterId,
          'task_deleted' as ActivityType,
          `Deleted task: ${task.title} (${task.log_number})`,
          clientIp,
          userAgent,
          { deletedTaskId: Number(id) }
        );

        // Audit Trail
        await AuditService.log({
            req,
            userId: deleterId,
            actionType: 'DELETE',
            tableName: 'tasks',
            recordId: taskId,
            oldValues: task,
            description: `Menghapus tugasan: ${task.title}`
        });
      }

      res.json({
        success: true,
        message: 'Task deleted successfully'
      });
    } catch (error) {
      console.error('Delete task error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };
}
