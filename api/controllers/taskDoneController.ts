import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { AppDataSource } from '../config/database.ts';
import { TaskDone, Task, User, TaskStatus, TaskDoneFile } from '../models/index.ts';
import { TaskStatusOption } from '../models/TaskStatusOption.ts';
import { getFileInfo, deleteUploadedFiles } from '../middleware/upload.ts';

export class TaskDoneController {
  private static readonly MAX_SUPPORT_FILES = 10;
  private static readonly MAX_SUPPORT_FILE_SIZE_BYTES = 10 * 1024 * 1024;

  private taskDoneRepository = AppDataSource.getRepository(TaskDone);
  private taskRepository = AppDataSource.getRepository(Task);
  private taskStatusRepository = AppDataSource.getRepository(TaskStatusOption);
  private userRepository = AppDataSource.getRepository(User);
  private taskDoneFileRepository = AppDataSource.getRepository(TaskDoneFile);

  private isAdminOrStaff = (role: string | undefined): boolean => {
    const normalizedRole = String(role || '').toLowerCase();
    return normalizedRole.includes('admin') || normalizedRole.includes('staff');
  };

  private getUploadedFiles = (req: Request): any[] => {
    const singleFile = (req as any).file as any | undefined;
    const multipleFiles = (Array.isArray((req as any).files) ? (req as any).files : []) as any[];
    if (singleFile) return [singleFile];
    return multipleFiles;
  };

  private validatePdfFiles = (files: any[]): boolean => {
    return files.every((file) => {
      const isPdfMime = file.mimetype?.toLowerCase().includes('pdf');
      const isPdfExt = file.originalname?.toLowerCase().endsWith('.pdf');
      return Boolean(isPdfMime && isPdfExt);
    });
  };

  private validateSupportFiles = (files: any[]): { valid: boolean; message?: string } => {
    if (!files.length) {
      return { valid: true };
    }

    if (files.length > TaskDoneController.MAX_SUPPORT_FILES) {
      return {
        valid: false,
        message: `Maksimum ${TaskDoneController.MAX_SUPPORT_FILES} fail PDF dibenarkan bagi setiap penghantaran.`
      };
    }

    const oversized = files.find((file) => file.size > TaskDoneController.MAX_SUPPORT_FILE_SIZE_BYTES);
    if (oversized) {
      return {
        valid: false,
        message: `Fail "${oversized.originalname}" melebihi had 10MB.`
      };
    }

    if (!this.validatePdfFiles(files)) {
      return {
        valid: false,
        message: 'Hanya fail PDF dibenarkan untuk medan sokongan.'
      };
    }

    return { valid: true };
  };

  private async saveTaskDoneFiles(taskDoneId: number, files: any[]): Promise<string | undefined> {
    if (!files.length) return undefined;

    const entities = files.map((uploadedFile) => {
      const fileInfo = getFileInfo(uploadedFile);
      const fileUrl = '/' + fileInfo.relativePath.replace(/\\/g, '/');
      return this.taskDoneFileRepository.create({
        task_done_id: taskDoneId,
        file_url: fileUrl,
        original_name: uploadedFile.originalname
      });
    });

    const saved = await this.taskDoneFileRepository.save(entities);
    return saved[0]?.file_url;
  }

  private isSubmittedStatus(status?: string): boolean {
    return [
      TaskStatus.SELESAI,
      TaskStatus.BORANG_DISEMAK_PEMBAYARAN_TERTUNGGAK,
      TaskStatus.TELAH_DIBAYAR,
      TaskStatus.SELESAI_PENUH
    ].includes(status as TaskStatus);
  }

  private async resolveStatusId(statusName: TaskStatus): Promise<number> {
    const statusOption = await this.taskStatusRepository.findOne({ where: { name: statusName, is_active: true } });
    if (!statusOption) {
      throw new Error(`Task status option not found for ${statusName}`);
    }
    return statusOption.id;
  }

  /**
   * Get all completed task submissions (Tugasan Siap)
   */
  getAllCompletedTasks = async (req: Request, res: Response): Promise<void> => {
    try {
      const { page = 1, limit = 10, freelancer_id } = req.query;
      const skip = (Number(page) - 1) * Number(limit);
      const currentUserId = req.user?.id;
      const userPermissions = req.userPermissions || [];
      const canViewAllTasks = req.user?.role?.toLowerCase() === 'admin' || userPermissions.includes('tasks:view:all');
      const canViewOwnTasks = userPermissions.includes('tasks:view:own') || userPermissions.includes('tasks:view:assigned');

      const queryBuilder = this.taskDoneRepository.createQueryBuilder('taskDone')
        .leftJoinAndSelect('taskDone.task', 'task')
        .leftJoinAndSelect('task.statusSetting', 'statusSetting')
        .leftJoinAndSelect('task.assignee', 'assignee')
        .leftJoinAndSelect('taskDone.freelancer', 'freelancer')
        .select([
          'taskDone',
          'task.id',
          'task.title',
          'task.log_number',
          'task.status_id',
          'task.offer_price',
          'statusSetting.id',
          'statusSetting.name',
          'assignee.id',
          'assignee.name',
          'assignee.email',
          'freelancer.id',
          'freelancer.name',
          'freelancer.email'
        ]);

      if (freelancer_id) {
        queryBuilder.andWhere('taskDone.freelancer_id = :freelancer_id', { freelancer_id: Number(freelancer_id) });
      }

      if (!canViewAllTasks && canViewOwnTasks && currentUserId) {
        queryBuilder.andWhere('taskDone.freelancer_id = :currentUserId', { currentUserId });
      }

      queryBuilder.andWhere('statusSetting.name IN (:...allowedStatuses)', {
        allowedStatuses: [
          TaskStatus.SELESAI
        ]
      });

      queryBuilder.orderBy('taskDone.submitted_at', 'DESC').skip(skip).take(Number(limit));

      const [tasksDone, total] = await queryBuilder.getManyAndCount();

      res.json({
        success: true,
        message: 'Completed tasks retrieved successfully',
        data: {
          tasks: tasksDone,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            pages: Math.ceil(total / Number(limit))
          }
        }
      });
    } catch (error) {
      console.error('Get completed tasks error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Get completed task submission by ID
   */
  getCompletedTaskById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const taskDone = await this.taskDoneRepository.findOne({
        where: { id: Number(id) },
        relations: ['task', 'task.creator', 'task.assignee', 'task.statusSetting', 'task.mainCon', 'freelancer', 'freelancer.profile', 'files']
      });

      if (!taskDone) {
        res.status(404).json({
          success: false,
          message: 'Completed task not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Completed task retrieved successfully',
        data: { taskDone }
      });
    } catch (error) {
      console.error('Get completed task error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Create completed task submission (after Hantar Tugasan button click)
   */
  createCompletedTask = async (req: Request, res: Response): Promise<void> => {
    const uploadedFiles = this.getUploadedFiles(req);
    try {
      const { task_id, service_start_date, action_taken, remarks } = req.body;
      const actorUserId = req.user?.id;
      const actorRole = req.user?.role;
      const userPermissions = req.userPermissions || [];

      if (!task_id || !actorUserId) {
        if (uploadedFiles.length) deleteUploadedFiles(uploadedFiles);
        res.status(400).json({
          success: false,
          message: 'Missing required fields (task_id, freelancer_id)'
        });
        return;
      }

      if (!uploadedFiles.length) {
        res.status(400).json({
          success: false,
          message: 'Fail sokongan PDF adalah wajib'
        });
        return;
      }

      const validation = this.validateSupportFiles(uploadedFiles);
      if (!validation.valid) {
        deleteUploadedFiles(uploadedFiles);
        res.status(400).json({
          success: false,
          message: validation.message || 'Fail sokongan tidak sah'
        });
        return;
      }

      const task = await this.taskRepository.findOne({
        where: { id: task_id },
        relations: ['assignee']
      });

      if (!task) {
        deleteUploadedFiles(uploadedFiles);
        res.status(404).json({ success: false, message: 'Task not found' });
        return;
      }

      const isPrivilegedSubmitter = this.isAdminOrStaff(actorRole) || userPermissions.includes('tasks:edit:all');
      let submissionFreelancerId = actorUserId;

      if (task.assigned_to && task.assigned_to !== actorUserId) {
        if (!isPrivilegedSubmitter) {
          deleteUploadedFiles(uploadedFiles);
          res.status(403).json({ success: false, message: 'You are not assigned to this task' });
          return;
        }
        submissionFreelancerId = task.assigned_to;
      }

      const taskDone = this.taskDoneRepository.create({
        task_id,
        freelancer_id: submissionFreelancerId,
        service_start_date: service_start_date ? new Date(service_start_date) : undefined,
        action_taken,
        remarks,
        support_pdf_url: '',
        submitted_at: new Date()
      });

      const savedTaskDone = await this.taskDoneRepository.save(taskDone);
      const firstFileUrl = await this.saveTaskDoneFiles(savedTaskDone.id, uploadedFiles);

      if (firstFileUrl) {
        await this.taskDoneRepository.update(savedTaskDone.id, {
          support_pdf_url: firstFileUrl,
          updated_at: new Date()
        });
      }

      const selesaiStatusId = await this.resolveStatusId(TaskStatus.SELESAI);
      await this.taskRepository.update(task_id, {
        status_id: selesaiStatusId,
        updated_at: new Date()
      });

      const created = await this.taskDoneRepository.findOne({
        where: { id: savedTaskDone.id },
        relations: ['task', 'task.creator', 'task.assignee', 'freelancer', 'files']
      });

      res.status(201).json({
        success: true,
        message: 'Completed task submission created successfully',
        data: { taskDone: created }
      });
    } catch (error) {
      if (uploadedFiles.length) deleteUploadedFiles(uploadedFiles);
      console.error('Create completed task error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : undefined
      });
    }
  };

  /**
   * Get completed tasks for a specific freelancer
   */
  getFreelancerCompletedTasks = async (req: Request, res: Response): Promise<void> => {
    try {
      const { freelancer_id } = req.params;
      const { page = 1, limit = 10 } = req.query;
      const skip = (Number(page) - 1) * Number(limit);
      const currentUserId = req.user?.id;
      const userPermissions = req.userPermissions || [];
      const canViewAllTasks = req.user?.role?.toLowerCase() === 'admin' || userPermissions.includes('tasks:view:all');
      const canViewOwnTasks = userPermissions.includes('tasks:view:own') || userPermissions.includes('tasks:view:assigned');

      if (!canViewAllTasks && canViewOwnTasks && currentUserId && Number(freelancer_id) !== currentUserId) {
        res.status(403).json({
          success: false,
          message: 'Anda hanya boleh melihat tugasan siap milik anda sendiri'
        });
        return;
      }

      const [tasksDone, total] = await this.taskDoneRepository.findAndCount({
        where: { freelancer_id: Number(freelancer_id) },
        relations: ['task', 'task.creator', 'freelancer', 'files'],
        order: { submitted_at: 'DESC' },
        skip,
        take: Number(limit)
      });

      res.json({
        success: true,
        message: 'Freelancer completed tasks retrieved successfully',
        data: {
          tasks: tasksDone,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            pages: Math.ceil(total / Number(limit))
          }
        }
      });
    } catch (error) {
      console.error('Get freelancer completed tasks error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Update completed task submission by ID
   */
  updateCompletedTask = async (req: Request, res: Response): Promise<void> => {
    const uploadedFiles = this.getUploadedFiles(req);
    try {
      const { id } = req.params;
      const { service_start_date, action_taken, remarks } = req.body;
      const currentUserId = req.user?.id;
      const currentUserRole = (req.user?.role || '').toLowerCase();

      if (!currentUserId) {
        if (uploadedFiles.length) deleteUploadedFiles(uploadedFiles);
        res.status(401).json({ success: false, message: 'Authentication required' });
        return;
      }

      const existing = await this.taskDoneRepository.findOne({
        where: { id: Number(id) },
        relations: ['task', 'freelancer']
      });

      if (!existing) {
        if (uploadedFiles.length) deleteUploadedFiles(uploadedFiles);
        res.status(404).json({ success: false, message: 'Completed task not found' });
        return;
      }

      if (!this.isAdminOrStaff(currentUserRole)) {
        if (uploadedFiles.length) deleteUploadedFiles(uploadedFiles);
        res.status(403).json({ success: false, message: 'Hanya Admin/Staff dibenarkan edit borang ini' });
        return;
      }

      if (uploadedFiles.length) {
        const validation = this.validateSupportFiles(uploadedFiles);
        if (!validation.valid) {
          deleteUploadedFiles(uploadedFiles);
          res.status(400).json({ success: false, message: validation.message || 'Fail sokongan tidak sah' });
          return;
        }
      }

      const updateData: Partial<TaskDone> = {
        updated_at: new Date()
      };

      if (service_start_date !== undefined) {
        updateData.service_start_date = service_start_date ? new Date(service_start_date) : undefined;
      }
      if (action_taken !== undefined) updateData.action_taken = action_taken;
      if (remarks !== undefined) updateData.remarks = remarks;

      if (uploadedFiles.length) {
        const firstFileUrl = await this.saveTaskDoneFiles(Number(id), uploadedFiles);
        if (firstFileUrl) {
          updateData.support_pdf_url = firstFileUrl;
        }
      }

      await this.taskDoneRepository.update(Number(id), updateData);

      const updated = await this.taskDoneRepository.findOne({
        where: { id: Number(id) },
        relations: ['task', 'task.creator', 'task.assignee', 'freelancer', 'files']
      });

      res.json({
        success: true,
        message: 'Completed task updated successfully',
        data: { taskDone: updated }
      });
    } catch (error) {
      if (uploadedFiles.length) deleteUploadedFiles(uploadedFiles);
      console.error('Update completed task error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  submitCompletedTask = async (req: Request, res: Response): Promise<void> => {
    const uploadedFiles = this.getUploadedFiles(req);
    try {
      const { id } = req.params;
      const { service_start_date, action_taken, remarks } = req.body;
      const currentUserRole = req.user?.role;

      if (!this.isAdminOrStaff(currentUserRole)) {
        if (uploadedFiles.length) deleteUploadedFiles(uploadedFiles);
        res.status(403).json({ success: false, message: 'Hanya Admin/Staff dibenarkan submit borang ini' });
        return;
      }

      const existing = await this.taskDoneRepository.findOne({
        where: { id: Number(id) },
        relations: ['task', 'task.creator', 'task.assignee', 'freelancer']
      });

      if (!existing) {
        if (uploadedFiles.length) deleteUploadedFiles(uploadedFiles);
        res.status(404).json({ success: false, message: 'Completed task not found' });
        return;
      }

      if (uploadedFiles.length) {
        const validation = this.validateSupportFiles(uploadedFiles);
        if (!validation.valid) {
          deleteUploadedFiles(uploadedFiles);
          res.status(400).json({ success: false, message: validation.message || 'Fail sokongan tidak sah' });
          return;
        }
      }

      const updateData: Partial<TaskDone> = {
        updated_at: new Date()
      };

      if (service_start_date !== undefined) {
        updateData.service_start_date = service_start_date ? new Date(service_start_date) : undefined;
      }
      if (action_taken !== undefined) updateData.action_taken = action_taken;
      if (remarks !== undefined) updateData.remarks = remarks;

      if (uploadedFiles.length) {
        const firstFileUrl = await this.saveTaskDoneFiles(Number(id), uploadedFiles);
        if (firstFileUrl) {
          updateData.support_pdf_url = firstFileUrl;
        }
      }

      const existingFiles = await this.taskDoneFileRepository.count({ where: { task_done_id: Number(id) } });
      const finalPdfUrl = updateData.support_pdf_url || existing.support_pdf_url;
      if (!finalPdfUrl && existingFiles < 1) {
        if (uploadedFiles.length) deleteUploadedFiles(uploadedFiles);
        res.status(400).json({ success: false, message: 'Fail sokongan PDF wajib sebelum submit' });
        return;
      }

      await this.taskDoneRepository.update(Number(id), updateData);
      const selesaiStatusId = await this.resolveStatusId(TaskStatus.SELESAI);
      await this.taskRepository.update(existing.task_id, {
        status_id: selesaiStatusId,
        updated_at: new Date()
      });

      const updated = await this.taskDoneRepository.findOne({
        where: { id: Number(id) },
        relations: ['task', 'task.creator', 'task.assignee', 'freelancer', 'files']
      });

      res.json({
        success: true,
        message: 'Borang berjaya disubmit dan status tugasan dikemaskini ke Selesai',
        data: { taskDone: updated }
      });
    } catch (error) {
      if (uploadedFiles.length) deleteUploadedFiles(uploadedFiles);
      console.error('Submit completed task error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  };

  markCompletedTaskReviewed = async (req: Request, res: Response): Promise<void> => {
    const uploadedFiles = this.getUploadedFiles(req);
    try {
      const { id } = req.params;
      const { service_start_date, action_taken, remarks } = req.body;
      const currentUserId = req.user?.id;
      const currentUserRole = req.user?.role;

      if (!currentUserId) {
        if (uploadedFiles.length) deleteUploadedFiles(uploadedFiles);
        res.status(401).json({ success: false, message: 'Authentication required' });
        return;
      }

      if (!this.isAdminOrStaff(currentUserRole)) {
        if (uploadedFiles.length) deleteUploadedFiles(uploadedFiles);
        res.status(403).json({ success: false, message: 'Hanya Admin/Staff dibenarkan semak borang' });
        return;
      }

      const existing = await this.taskDoneRepository.findOne({
        where: { id: Number(id) },
        relations: ['task', 'task.creator', 'task.assignee', 'freelancer']
      });

      if (!existing) {
        if (uploadedFiles.length) deleteUploadedFiles(uploadedFiles);
        res.status(404).json({ success: false, message: 'Completed task not found' });
        return;
      }

      if (uploadedFiles.length) {
        const validation = this.validateSupportFiles(uploadedFiles);
        if (!validation.valid) {
          deleteUploadedFiles(uploadedFiles);
          res.status(400).json({ success: false, message: validation.message || 'Fail sokongan tidak sah' });
          return;
        }
      }

      const updateData: Partial<TaskDone> = {
        updated_at: new Date()
      };

      if (service_start_date !== undefined) {
        updateData.service_start_date = service_start_date ? new Date(service_start_date) : undefined;
      }
      if (action_taken !== undefined) updateData.action_taken = action_taken;
      if (remarks !== undefined) updateData.remarks = remarks;

      if (uploadedFiles.length) {
        const firstFileUrl = await this.saveTaskDoneFiles(Number(id), uploadedFiles);
        if (firstFileUrl) {
          updateData.support_pdf_url = firstFileUrl;
        }
      }

      const existingFiles = await this.taskDoneFileRepository.count({ where: { task_done_id: Number(id) } });
      const finalPdfUrl = updateData.support_pdf_url || existing.support_pdf_url;
      if (!finalPdfUrl && existingFiles < 1) {
        if (uploadedFiles.length) deleteUploadedFiles(uploadedFiles);
        res.status(400).json({ success: false, message: 'Fail sokongan PDF wajib sebelum Borang Telah Disemak' });
        return;
      }

      await this.taskDoneRepository.update(existing.id, updateData);

      const selesaiStatusId = await this.resolveStatusId(TaskStatus.SELESAI);
      await this.taskRepository.update(existing.task_id, {
        status_id: selesaiStatusId,
        updated_at: new Date()
      });

      const borangDisemakStatusId = await this.resolveStatusId(TaskStatus.BORANG_DISEMAK_PEMBAYARAN_TERTUNGGAK);
      await this.taskRepository.update(existing.task_id, {
        status_id: borangDisemakStatusId,
        updated_at: new Date()
      });

      const updatedTaskDone = await this.taskDoneRepository.findOne({
        where: { id: Number(id) },
        relations: ['task', 'task.creator', 'task.assignee', 'task.statusSetting', 'task.mainCon', 'freelancer', 'freelancer.profile', 'files']
      });

      res.json({
        success: true,
        message: 'Borang ditanda telah disemak dan status tugasan dikemaskini',
        data: {
          taskDone: updatedTaskDone
        }
      });
    } catch (error) {
      if (uploadedFiles.length) deleteUploadedFiles(uploadedFiles);
      console.error('Mark completed task reviewed error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  };

  deleteCompletedTaskFile = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id, fileId } = req.params;
      const currentUserId = req.user?.id;
      const currentUserRole = req.user?.role;

      if (!currentUserId) {
        res.status(401).json({ success: false, message: 'Authentication required' });
        return;
      }

      if (!this.isAdminOrStaff(currentUserRole)) {
        res.status(403).json({ success: false, message: 'Hanya Admin/Staff dibenarkan padam fail' });
        return;
      }

      const taskDone = await this.taskDoneRepository.findOne({
        where: { id: Number(id) },
        relations: ['task', 'task.statusSetting', 'files']
      });

      if (!taskDone) {
        res.status(404).json({ success: false, message: 'Completed task not found' });
        return;
      }

      if (this.isSubmittedStatus(taskDone.task?.statusSetting?.name)) {
        res.status(400).json({ success: false, message: 'Fail tidak boleh dipadam jika borang telah disemak/submit' });
        return;
      }

      const fileRecord = taskDone.files?.find(file => Number(file.id) === Number(fileId));
      if (!fileRecord) {
        res.status(404).json({ success: false, message: 'Fail tidak dijumpai' });
        return;
      }

      const absolutePath = path.join(process.cwd(), fileRecord.file_url.replace(/^\//, '').replace(/\//g, path.sep));
      if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
      }

      await this.taskDoneFileRepository.delete(Number(fileId));

      const remainingFiles = await this.taskDoneFileRepository.find({
        where: { task_done_id: Number(id) },
        order: { created_at: 'ASC' }
      });

      await this.taskDoneRepository.update(Number(id), {
        support_pdf_url: remainingFiles[0]?.file_url || null as any,
        updated_at: new Date()
      });

      const updatedTaskDone = await this.taskDoneRepository.findOne({
        where: { id: Number(id) },
        relations: ['task', 'task.creator', 'task.assignee', 'freelancer', 'files']
      });

      res.json({
        success: true,
        message: 'Fail berjaya dipadam',
        data: { taskDone: updatedTaskDone }
      });
    } catch (error) {
      console.error('Delete completed task file error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  };
}
