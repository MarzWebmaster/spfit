import { Request, Response } from 'express';
import { AppDataSource } from '../config/database.ts';
import { TaskStatusOption } from '../models/TaskStatusOption.ts';
import { SupportTypeOption } from '../models/SupportTypeOption.ts';
import { EquipmentCode } from '../models/EquipmentCode.ts';
import { Task } from '../models/Task.ts';

export class TaskSettingController {
  private readonly protectedStatusNames = new Set([
    'baru',
    'tawaran dihantar',
    'telah diambil',
    'selesai',
    'borang disemak & pembayaran tertunggak',
    'telah dibayar',
    'dibatalkan',
    'selesai penuh'
  ]);

  private getStatusRepository() {
    return AppDataSource.getRepository(TaskStatusOption);
  }

  private getSupportTypeRepository() {
    return AppDataSource.getRepository(SupportTypeOption);
  }

  private getEquipmentCodeRepository() {
    return AppDataSource.getRepository(EquipmentCode);
  }

  private getTaskRepository() {
    return AppDataSource.getRepository(Task);
  }

  getAllActive = async (req: Request, res: Response): Promise<void> => {
    try {
      const includeInactive = String(req.query.includeInactive || '').toLowerCase() === 'true';
      const whereClause = includeInactive ? undefined : { is_active: true as any };

      const [statuses, supportTypes, equipmentCodes] = await Promise.all([
        this.getStatusRepository().find({ where: whereClause, order: { sort_order: 'ASC', name: 'ASC' } }),
        this.getSupportTypeRepository().find({ where: whereClause, order: { sort_order: 'ASC', name: 'ASC' } }),
        this.getEquipmentCodeRepository().find({ where: whereClause, order: { sort_order: 'ASC', code: 'ASC' } })
      ]);

      res.json({
        success: true,
        message: 'Task settings retrieved successfully',
        data: {
          statusOptions: statuses.map(item => ({
            id: item.id,
            value: item.name,
            is_active: item.is_active,
            sort_order: item.sort_order
          })),
          supportTypeOptions: supportTypes.map(item => ({
            id: item.id,
            value: item.name,
            is_active: item.is_active,
            sort_order: item.sort_order
          })),
          equipmentCodeOptions: equipmentCodes.map(item => ({
            id: item.id,
            value: item.code,
            is_active: item.is_active,
            sort_order: item.sort_order
          }))
        }
      });
    } catch (error) {
      console.error('Get task settings error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  };

  createStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const value = String(req.body?.value || '').trim();
      if (!value) {
        res.status(400).json({ success: false, message: 'Nilai status diperlukan' });
        return;
      }

      const existing = await this.getStatusRepository().findOne({ where: { name: value } });
      if (existing) {
        res.status(409).json({ success: false, message: 'Status tugasan sudah wujud' });
        return;
      }

      const item = this.getStatusRepository().create({
        name: value,
        sort_order: Number(req.body?.sort_order || 0),
        is_active: true
      });
      const saved = await this.getStatusRepository().save(item);

      res.status(201).json({
        success: true,
        message: 'Status tugasan berjaya ditambah',
        data: { id: saved.id, value: saved.name, is_active: saved.is_active, sort_order: saved.sort_order }
      });
    } catch (error) {
      console.error('Create status setting error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  };

  updateStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = Number(req.params.id);
      const value = String(req.body?.value || '').trim();

      const item = await this.getStatusRepository().findOne({ where: { id } });
      if (!item) {
        res.status(404).json({ success: false, message: 'Status tugasan tidak ditemui' });
        return;
      }

      if (value) {
        const duplicate = await this.getStatusRepository().findOne({ where: { name: value } });
        if (duplicate && duplicate.id !== id) {
          res.status(409).json({ success: false, message: 'Status tugasan sudah wujud' });
          return;
        }
        item.name = value;
      }

      if (req.body?.is_active !== undefined) item.is_active = Boolean(req.body.is_active);
      if (req.body?.sort_order !== undefined) item.sort_order = Number(req.body.sort_order);

      const saved = await this.getStatusRepository().save(item);
      res.json({
        success: true,
        message: 'Status tugasan berjaya dikemaskini',
        data: { id: saved.id, value: saved.name, is_active: saved.is_active, sort_order: saved.sort_order }
      });
    } catch (error) {
      console.error('Update status setting error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  };

  deleteStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = Number(req.params.id);
      const item = await this.getStatusRepository().findOne({ where: { id } });
      if (!item) {
        res.status(404).json({ success: false, message: 'Status tugasan tidak ditemui' });
        return;
      }

      const normalizedName = String(item.name || '').trim().toLowerCase();
      if (this.protectedStatusNames.has(normalizedName)) {
        res.status(403).json({
          success: false,
          message: 'Status tugasan lalai tidak boleh dipadam.'
        });
        return;
      }

      const usage = await this.getTaskRepository().count({ where: { status_id: id } });
      if (usage > 0) {
        res.status(400).json({ success: false, message: 'Status ini sedang digunakan oleh tugasan' });
        return;
      }

      await this.getStatusRepository().delete(id);
      res.json({ success: true, message: 'Status tugasan berjaya dipadam' });
      return;
    } catch (error) {
      console.error('Delete status setting error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  };

  createSupportType = async (req: Request, res: Response): Promise<void> => {
    try {
      const value = String(req.body?.value || '').trim();
      if (!value) {
        res.status(400).json({ success: false, message: 'Nilai jenis sokongan diperlukan' });
        return;
      }

      const existing = await this.getSupportTypeRepository().findOne({ where: { name: value } });
      if (existing) {
        res.status(409).json({ success: false, message: 'Jenis sokongan sudah wujud' });
        return;
      }

      const item = this.getSupportTypeRepository().create({
        name: value,
        sort_order: Number(req.body?.sort_order || 0),
        is_active: true
      });
      const saved = await this.getSupportTypeRepository().save(item);

      res.status(201).json({
        success: true,
        message: 'Jenis sokongan berjaya ditambah',
        data: { id: saved.id, value: saved.name, is_active: saved.is_active, sort_order: saved.sort_order }
      });
    } catch (error) {
      console.error('Create support type error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  };

  updateSupportType = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = Number(req.params.id);
      const value = String(req.body?.value || '').trim();

      const item = await this.getSupportTypeRepository().findOne({ where: { id } });
      if (!item) {
        res.status(404).json({ success: false, message: 'Jenis sokongan tidak ditemui' });
        return;
      }

      if (value) {
        const duplicate = await this.getSupportTypeRepository().findOne({ where: { name: value } });
        if (duplicate && duplicate.id !== id) {
          res.status(409).json({ success: false, message: 'Jenis sokongan sudah wujud' });
          return;
        }
        item.name = value;
        await this.getTaskRepository().update({ support_type_id: id }, { support_type: value });
      }

      if (req.body?.is_active !== undefined) item.is_active = Boolean(req.body.is_active);
      if (req.body?.sort_order !== undefined) item.sort_order = Number(req.body.sort_order);

      const saved = await this.getSupportTypeRepository().save(item);
      res.json({
        success: true,
        message: 'Jenis sokongan berjaya dikemaskini',
        data: { id: saved.id, value: saved.name, is_active: saved.is_active, sort_order: saved.sort_order }
      });
    } catch (error) {
      console.error('Update support type error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  };

  deleteSupportType = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = Number(req.params.id);
      const usage = await this.getTaskRepository().count({ where: { support_type_id: id } });
      if (usage > 0) {
        res.status(400).json({ success: false, message: 'Jenis sokongan ini sedang digunakan oleh tugasan' });
        return;
      }

      await this.getSupportTypeRepository().delete(id);
      res.json({ success: true, message: 'Jenis sokongan berjaya dipadam' });
    } catch (error) {
      console.error('Delete support type error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  };

  createEquipmentCode = async (req: Request, res: Response): Promise<void> => {
    try {
      const value = String(req.body?.value || '').trim().toUpperCase();
      if (!value) {
        res.status(400).json({ success: false, message: 'Nilai equipment code diperlukan' });
        return;
      }

      const existing = await this.getEquipmentCodeRepository().findOne({ where: { code: value } });
      if (existing) {
        res.status(409).json({ success: false, message: 'Equipment code sudah wujud' });
        return;
      }

      const item = this.getEquipmentCodeRepository().create({
        code: value,
        sort_order: Number(req.body?.sort_order || 0),
        is_active: true
      });
      const saved = await this.getEquipmentCodeRepository().save(item);

      res.status(201).json({
        success: true,
        message: 'Equipment code berjaya ditambah',
        data: { id: saved.id, value: saved.code, is_active: saved.is_active, sort_order: saved.sort_order }
      });
    } catch (error) {
      console.error('Create equipment code error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  };

  updateEquipmentCode = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = Number(req.params.id);
      const value = String(req.body?.value || '').trim().toUpperCase();

      const item = await this.getEquipmentCodeRepository().findOne({ where: { id } });
      if (!item) {
        res.status(404).json({ success: false, message: 'Equipment code tidak ditemui' });
        return;
      }

      if (value) {
        const duplicate = await this.getEquipmentCodeRepository().findOne({ where: { code: value } });
        if (duplicate && duplicate.id !== id) {
          res.status(409).json({ success: false, message: 'Equipment code sudah wujud' });
          return;
        }
        item.code = value;
      }

      if (req.body?.is_active !== undefined) item.is_active = Boolean(req.body.is_active);
      if (req.body?.sort_order !== undefined) item.sort_order = Number(req.body.sort_order);

      const saved = await this.getEquipmentCodeRepository().save(item);
      res.json({
        success: true,
        message: 'Equipment code berjaya dikemaskini',
        data: { id: saved.id, value: saved.code, is_active: saved.is_active, sort_order: saved.sort_order }
      });
    } catch (error) {
      console.error('Update equipment code error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  };

  deleteEquipmentCode = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = Number(req.params.id);
      const item = await this.getEquipmentCodeRepository().findOne({ where: { id } });
      if (!item) {
        res.status(404).json({ success: false, message: 'Equipment code tidak ditemui' });
        return;
      }

      await this.getEquipmentCodeRepository().delete(id);
      res.json({ success: true, message: 'Equipment code berjaya dipadam' });
    } catch (error) {
      console.error('Delete equipment code error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  };
}
