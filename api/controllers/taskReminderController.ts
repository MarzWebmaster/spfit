import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { AppDataSource } from '../config/database';
import { TaskReminder, ReminderType, ReminderTiming } from '../models/TaskReminder.ts';
import { SystemSettings } from '../models/SystemSettings.ts';
import { Task } from '../models/Task.ts';
import { TASK_REMINDER_SETTINGS_KEY, loadGlobalTaskReminderSettings, normalizeReminderSettings } from '../services/taskReminderConfig.ts';

export class TaskReminderController {
  private isAdminOrStaffRole(role?: string | null): boolean {
    const normalizedRole = String(role || '').trim().toLowerCase();
    return normalizedRole.includes('admin') || normalizedRole.includes('staff');
  }

  private getReminderRepository() {
    return AppDataSource.getRepository(TaskReminder);
  }

  private getSystemSettingsRepository() {
    return AppDataSource.getRepository(SystemSettings);
  }

  private getTaskRepository() {
    return AppDataSource.getRepository(Task);
  }

  getAll = async (_req: Request, res: Response): Promise<void> => {
    try {
      const reminders = await this.getReminderRepository().find({ relations: ['task'] });

      res.json({
        success: true,
        message: 'Task reminders retrieved successfully',
        data: { reminders, total: reminders.length }
      });
    } catch (error: any) {
      console.error('Get task reminders error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  };

  getByTaskId = async (req: Request, res: Response): Promise<void> => {
    try {
      const { taskId } = req.params;
      const reminders = await this.getReminderRepository().find({ where: { task_id: Number(taskId) } });

      res.json({
        success: true,
        message: 'Task reminders retrieved successfully',
        data: { reminders, total: reminders.length }
      });
    } catch (error: any) {
      console.error('Get task reminders by task ID error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  };

  create = async (req: Request, res: Response): Promise<void> => {
    try {
      const { task_id, reminder_type, timing_option, timing_value, timing_date_time, channels, template_id, custom_message, is_active = true } = req.body;

      if (!task_id || !reminder_type || !timing_option) {
        res.status(400).json({ success: false, message: 'task_id, reminder_type, dan timing_option diperlukan' });
        return;
      }

      const validReminderTypes = Object.values(ReminderType);
      const validTimingOptions = Object.values(ReminderTiming);

      if (!validReminderTypes.includes(reminder_type)) {
        res.status(400).json({ success: false, message: `Invalid reminder_type. Valid values: ${validReminderTypes.join(', ')}` });
        return;
      }

      if (!validTimingOptions.includes(timing_option)) {
        res.status(400).json({ success: false, message: `Invalid timing_option. Valid values: ${validTimingOptions.join(', ')}` });
        return;
      }

      const reminder = this.getReminderRepository().create({
        task_id: Number(task_id),
        reminder_type,
        timing_option,
        timing_value: timing_value ? Number(timing_value) : undefined,
        timing_date_time,
        channels: channels || ['email'],
        template_id: template_id ? Number(template_id) : undefined,
        custom_message,
        is_active
      });

      const saved = await this.getReminderRepository().save(reminder);
      res.status(201).json({ success: true, message: 'Task reminder created successfully', data: { reminder: saved } });
    } catch (error: any) {
      console.error('Create task reminder error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  };

  update = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const reminder = await this.getReminderRepository().findOne({ where: { id: Number(id) } });

      if (!reminder) {
        res.status(404).json({ success: false, message: 'Task reminder not found' });
        return;
      }

      if (updates.reminder_type) {
        const validReminderTypes = Object.values(ReminderType);
        if (!validReminderTypes.includes(updates.reminder_type)) {
          res.status(400).json({ success: false, message: 'Invalid reminder_type' });
          return;
        }
      }

      if (updates.timing_option) {
        const validTimingOptions = Object.values(ReminderTiming);
        if (!validTimingOptions.includes(updates.timing_option)) {
          res.status(400).json({ success: false, message: 'Invalid timing_option' });
          return;
        }
      }

      await this.getReminderRepository().update(Number(id), updates);
      const updated = await this.getReminderRepository().findOne({ where: { id: Number(id) } });

      res.json({ success: true, message: 'Task reminder updated successfully', data: { reminder: updated } });
    } catch (error: any) {
      console.error('Update task reminder error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  };

  delete = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const reminder = await this.getReminderRepository().findOne({ where: { id: Number(id) } });

      if (!reminder) {
        res.status(404).json({ success: false, message: 'Task reminder not found' });
        return;
      }

      await this.getReminderRepository().delete(Number(id));
      res.json({ success: true, message: 'Task reminder deleted successfully' });
    } catch (error: any) {
      console.error('Delete task reminder error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  };

  bulkUpsert = async (req: Request, res: Response): Promise<void> => {
    try {
      const { task_id, reminders } = req.body;

      if (!task_id || !Array.isArray(reminders)) {
        res.status(400).json({ success: false, message: 'task_id dan reminders array diperlukan' });
        return;
      }

      await this.getReminderRepository().delete({ task_id: Number(task_id) });

      const created = [];
      for (const reminderData of reminders) {
        const reminder = this.getReminderRepository().create({ task_id: Number(task_id), ...reminderData });
        const saved = await this.getReminderRepository().save(reminder);
        created.push(saved);
      }

      res.json({
        success: true,
        message: 'Task reminders updated successfully',
        data: { reminders: created, total: created.length }
      });
    } catch (error: any) {
      console.error('Bulk upsert task reminders error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  };

  getGlobalSettings = async (_req: Request, res: Response): Promise<void> => {
    try {
      const settings = await loadGlobalTaskReminderSettings(this.getSystemSettingsRepository());
      res.json({ success: true, message: 'Task reminder settings retrieved successfully', data: { settings } });
    } catch (error: any) {
      console.error('Get global task reminder settings error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  };

  saveGlobalSettings = async (req: Request, res: Response): Promise<void> => {
    try {
      const normalized = normalizeReminderSettings(req.body?.settings);
      const repo = this.getSystemSettingsRepository();
      const existing = await repo.findOne({ where: { setting_key: TASK_REMINDER_SETTINGS_KEY } });

      if (existing) {
        existing.setting_value = JSON.stringify(normalized);
        existing.data_type = 'json';
        existing.is_active = true;
        await repo.save(existing);
      } else {
        const created = repo.create({
          setting_key: TASK_REMINDER_SETTINGS_KEY,
          setting_value: JSON.stringify(normalized),
          description: 'Global task reminder settings',
          data_type: 'json',
          is_active: true
        });
        await repo.save(created);
      }

      res.json({ success: true, message: 'Task reminder settings saved successfully', data: { settings: normalized } });
    } catch (error: any) {
      console.error('Save global task reminder settings error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  };

  confirmArrival = async (req: Request, res: Response): Promise<void> => {
    try {
      const { token, latitude, longitude, accuracy } = req.body || {};
      if (!token) {
        res.status(400).json({ success: false, message: 'Token diperlukan' });
        return;
      }

      const secret = process.env.JWT_SECRET;
      if (!secret) {
        res.status(500).json({ success: false, message: 'Server token configuration missing' });
        return;
      }

      const decoded = jwt.verify(token, secret) as { type: string; taskId: number; userId: number };
      if (decoded.type !== 'arrival_confirmation') {
        res.status(400).json({ success: false, message: 'Token tidak sah' });
        return;
      }

      const task = await this.getTaskRepository().findOne({ where: { id: Number(decoded.taskId) } });
      if (!task || task.assigned_to !== Number(decoded.userId)) {
        res.status(404).json({ success: false, message: 'Tugasan tidak ditemui untuk pautan ini' });
        return;
      }

      task.arrival_confirmed_at = new Date();
      task.arrival_latitude = latitude !== undefined ? Number(latitude) : undefined;
      task.arrival_longitude = longitude !== undefined ? Number(longitude) : undefined;
      task.arrival_accuracy_meters = accuracy !== undefined ? Number(accuracy) : undefined;

      await this.getTaskRepository().save(task);

      res.json({
        success: true,
        message: 'Kehadiran ke lokasi berjaya direkodkan',
        data: { taskId: task.id, taskTitle: task.title, arrival_confirmed_at: task.arrival_confirmed_at }
      });
    } catch (error: any) {
      console.error('Confirm arrival error:', error);
      res.status(400).json({ success: false, message: 'Pautan pengesahan tidak sah atau telah tamat tempoh' });
    }
  };

  manuallyConfirmArrival = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!this.isAdminOrStaffRole(req.user?.role)) {
        res.status(403).json({ success: false, message: 'Hanya Admin atau Staff dibenarkan tandakan hadir' });
        return;
      }

      const { taskId } = req.params;
      const task = await this.getTaskRepository().findOne({
        where: { id: Number(taskId) },
        relations: ['assignee', 'creator', 'project', 'statusSetting', 'supportTypeSetting', 'attachments', 'links']
      });

      if (!task) {
        res.status(404).json({ success: false, message: 'Tugasan tidak ditemui' });
        return;
      }

      if (!task.assigned_to) {
        res.status(400).json({ success: false, message: 'Tugasan ini belum diagihkan kepada freelancer atau technician' });
        return;
      }

      const alreadyConfirmed = Boolean(task.arrival_confirmed_at);
      if (!task.arrival_confirmed_at) {
        task.arrival_confirmed_at = new Date();
        await this.getTaskRepository().save(task);
      }

      res.json({
        success: true,
        message: alreadyConfirmed ? 'Kehadiran telah direkodkan sebelum ini' : 'Kehadiran berjaya ditandakan secara manual',
        data: {
          task: {
            ...task,
            arrivalConfirmedAt: task.arrival_confirmed_at,
            arrivalLatitude: task.arrival_latitude,
            arrivalLongitude: task.arrival_longitude,
            arrivalAccuracyMeters: task.arrival_accuracy_meters,
          }
        }
      });
    } catch (error: any) {
      console.error('Manual confirm arrival error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  };
}
