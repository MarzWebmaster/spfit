import { Request, Response } from 'express';
import { AppDataSource } from '../config/database.ts';
import { AssetCategoryOption } from '../models/AssetCategoryOption.ts';
import { AssetBrandOption } from '../models/AssetBrandOption.ts';
import { Asset } from '../models/Asset.ts';

export class AssetSettingController {
  private categoryRepository = AppDataSource.getRepository(AssetCategoryOption);
  private brandRepository = AppDataSource.getRepository(AssetBrandOption);
  private assetRepository = AppDataSource.getRepository(Asset);

  getAllActive = async (req: Request, res: Response): Promise<void> => {
    try {
      const includeInactive = String(req.query.includeInactive || '').toLowerCase() === 'true';
      const whereClause = includeInactive ? undefined : { is_active: true as any };

      const [categories, brands] = await Promise.all([
        this.categoryRepository.find({ where: whereClause, order: { sort_order: 'ASC', name: 'ASC' } }),
        this.brandRepository.find({ where: whereClause, order: { sort_order: 'ASC', name: 'ASC' } })
      ]);

      res.json({
        success: true,
        message: 'Asset settings retrieved successfully',
        data: {
          categoryOptions: categories.map((item) => ({
            id: item.id,
            value: item.name,
            is_active: item.is_active,
            sort_order: item.sort_order
          })),
          brandOptions: brands.map((item) => ({
            id: item.id,
            value: item.name,
            is_active: item.is_active,
            sort_order: item.sort_order
          }))
        }
      });
    } catch (error) {
      console.error('Get asset settings error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  };

  createCategory = async (req: Request, res: Response): Promise<void> => {
    try {
      const value = String(req.body?.value || '').trim();
      if (!value) {
        res.status(400).json({ success: false, message: 'Nilai kategori diperlukan' });
        return;
      }

      const existing = await this.categoryRepository.findOne({ where: { name: value } });
      if (existing) {
        res.status(409).json({ success: false, message: 'Kategori aset sudah wujud' });
        return;
      }

      const item = this.categoryRepository.create({
        name: value,
        sort_order: Number(req.body?.sort_order || 0),
        is_active: true
      });
      const saved = await this.categoryRepository.save(item);

      res.status(201).json({
        success: true,
        message: 'Kategori aset berjaya ditambah',
        data: { id: saved.id, value: saved.name, is_active: saved.is_active, sort_order: saved.sort_order }
      });
    } catch (error) {
      console.error('Create asset category error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  };

  updateCategory = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = Number(req.params.id);
      const value = String(req.body?.value || '').trim();

      const item = await this.categoryRepository.findOne({ where: { id } });
      if (!item) {
        res.status(404).json({ success: false, message: 'Kategori aset tidak ditemui' });
        return;
      }

      if (value) {
        const duplicate = await this.categoryRepository.findOne({ where: { name: value } });
        if (duplicate && duplicate.id !== id) {
          res.status(409).json({ success: false, message: 'Kategori aset sudah wujud' });
          return;
        }
        item.name = value;
      }

      if (req.body?.is_active !== undefined) item.is_active = Boolean(req.body.is_active);
      if (req.body?.sort_order !== undefined) item.sort_order = Number(req.body.sort_order);

      const saved = await this.categoryRepository.save(item);
      res.json({
        success: true,
        message: 'Kategori aset berjaya dikemaskini',
        data: { id: saved.id, value: saved.name, is_active: saved.is_active, sort_order: saved.sort_order }
      });
    } catch (error) {
      console.error('Update asset category error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  };

  deleteCategory = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ success: false, message: 'ID kategori tidak sah' });
        return;
      }
      const item = await this.categoryRepository.findOne({ where: { id } });
      if (!item) {
        res.status(404).json({ success: false, message: 'Kategori aset tidak ditemui' });
        return;
      }

      res.status(405).json({
        success: false,
        message: 'Kategori aset tidak boleh dipadam.'
      });
    } catch (error) {
      console.error('Delete asset category error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  };

  createBrand = async (req: Request, res: Response): Promise<void> => {
    try {
      const value = String(req.body?.value || '').trim();
      if (!value) {
        res.status(400).json({ success: false, message: 'Nilai brand diperlukan' });
        return;
      }

      const existing = await this.brandRepository.findOne({ where: { name: value } });
      if (existing) {
        res.status(409).json({ success: false, message: 'Brand aset sudah wujud' });
        return;
      }

      const item = this.brandRepository.create({
        name: value,
        sort_order: Number(req.body?.sort_order || 0),
        is_active: true
      });
      const saved = await this.brandRepository.save(item);

      res.status(201).json({
        success: true,
        message: 'Brand aset berjaya ditambah',
        data: { id: saved.id, value: saved.name, is_active: saved.is_active, sort_order: saved.sort_order }
      });
    } catch (error) {
      console.error('Create asset brand error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  };

  updateBrand = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = Number(req.params.id);
      const value = String(req.body?.value || '').trim();

      const item = await this.brandRepository.findOne({ where: { id } });
      if (!item) {
        res.status(404).json({ success: false, message: 'Brand aset tidak ditemui' });
        return;
      }

      if (value) {
        const duplicate = await this.brandRepository.findOne({ where: { name: value } });
        if (duplicate && duplicate.id !== id) {
          res.status(409).json({ success: false, message: 'Brand aset sudah wujud' });
          return;
        }
        item.name = value;
      }

      if (req.body?.is_active !== undefined) item.is_active = Boolean(req.body.is_active);
      if (req.body?.sort_order !== undefined) item.sort_order = Number(req.body.sort_order);

      const saved = await this.brandRepository.save(item);
      res.json({
        success: true,
        message: 'Brand aset berjaya dikemaskini',
        data: { id: saved.id, value: saved.name, is_active: saved.is_active, sort_order: saved.sort_order }
      });
    } catch (error) {
      console.error('Update asset brand error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  };

  deleteBrand = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = Number(req.params.id);
      const item = await this.brandRepository.findOne({ where: { id } });
      if (!item) {
        res.status(404).json({ success: false, message: 'Brand aset tidak ditemui' });
        return;
      }

      const usageCount = await this.assetRepository.count({ where: { brand_id: id } });
      if (usageCount > 0) {
        res.status(409).json({
          success: false,
          message: `Brand aset tidak boleh dipadam kerana masih digunakan oleh ${usageCount} aset.`
        });
        return;
      }

      await this.brandRepository.delete(id);
      res.json({ success: true, message: 'Brand aset berjaya dipadam' });
    } catch (error) {
      console.error('Delete asset brand error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  };
}
