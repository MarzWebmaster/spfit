import { Request, Response } from 'express';
import { In } from 'typeorm';
import { AppDataSource } from '../config/database.ts';
import { Asset, AssetStatus } from '../models/Asset.ts';
import { Masterlist } from '../models/Masterlist.ts';
import { AssetCategoryOption } from '../models/AssetCategoryOption.ts';
import { AssetBrandOption } from '../models/AssetBrandOption.ts';
import { AssetDesktopDetails } from '../models/AssetDesktopDetails.ts';
import { AssetLaptopDetails } from '../models/AssetLaptopDetails.ts';
import { AssetPrinterDetails } from '../models/AssetPrinterDetails.ts';
import { AssetMonitorDetails } from '../models/AssetMonitorDetails.ts';
import { AssetAccessory } from '../models/AssetAccessory.ts';
import { AssetAttachment } from '../models/AssetAttachment.ts';
import { AssetUser } from '../models/AssetUser.ts';
import { MasterlistAsset } from '../models/MasterlistAsset.ts';
import { AssetUpdateLog } from '../models/AssetUpdateLog.ts';
import { AuditService } from '../services/auditService.ts';

export class AssetController {
  private assetRepository = AppDataSource.getRepository(Asset);
  private masterlistRepository = AppDataSource.getRepository(Masterlist);
  private categoryRepository = AppDataSource.getRepository(AssetCategoryOption);
  private brandRepository = AppDataSource.getRepository(AssetBrandOption);
  private accessoriesRepository = AppDataSource.getRepository(AssetAccessory);
  private attachmentsRepository = AppDataSource.getRepository(AssetAttachment);

  private getClientInfo(req: Request): { ip: string; ua: string } {
    return {
      ip: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1',
      ua: req.headers['user-agent'] || 'Unknown'
    };
  }

  private async logAssetMutation(params: {
    assetId: number;
    userId?: number;
    actionType: string;
    fieldChanges?: Record<string, { old: any; new: any }>;
    req?: Request;
    manager?: any;
  }) {
    try {
      const logRepo = params.manager
        ? params.manager.getRepository(AssetUpdateLog)
        : AppDataSource.getRepository(AssetUpdateLog);
      const client = params.req ? this.getClientInfo(params.req) : { ip: '127.0.0.1', ua: 'System' };
      const log = logRepo.create({
        asset_id: params.assetId,
        user_id: params.userId || null,
        action_type: params.actionType,
        field_changes: params.fieldChanges || null,
        ip_address: client.ip,
        user_agent: client.ua
      });
      await logRepo.save(log);
    } catch (error) {
      console.error('Failed to create asset update log:', error);
    }
  }

  private normalizeOptionalId(value: unknown): number | null | undefined {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;

    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  private createHttpError(statusCode: number, message: string): Error & { statusCode: number } {
    const error = new Error(message) as Error & { statusCode: number };
    error.statusCode = statusCode;
    return error;
  }

  private toAssetResponse(asset: Asset) {
    const accessories = Array.isArray((asset as any).accessories) ? (asset as any).accessories : undefined;
    const accessoriesResponse = accessories
      ? accessories.map((row: any) => ({
          id: row.id,
          type: row.accessory_type,
          notes: row.notes ?? null,
          asset_id: row.accessory_asset_id,
          asset_tag: row.accessoryAsset?.asset_tag ?? null,
          name: row.accessoryAsset?.name ?? null,
          category: row.accessoryAsset?.categoryOption?.name ?? null
        }))
      : undefined;

    const attachments = Array.isArray((asset as any).attachments) ? (asset as any).attachments : undefined;
    const attachmentsResponse = attachments
      ? attachments.map((row: any) => ({
          id: row.id,
          file_name: row.file_name,
          display_name: row.display_name ?? null,
          file_path: row.file_path,
          file_type: row.file_type ?? null,
          file_size: row.file_size ?? null,
          created_at: row.created_at
        }))
      : undefined;

    const parentLink = (asset as any).parentAccessoryLink;
    const parentResponse = parentLink && parentLink.asset ? {
      id: parentLink.id,
      type: parentLink.accessory_type,
      parent_asset_id: parentLink.asset.id,
      parent_asset_tag: parentLink.asset.asset_tag ?? null,
      parent_name: parentLink.asset.name ?? null,
      parent_category: parentLink.asset.categoryOption?.name ?? null
    } : undefined;

    return {
      ...asset,
      category: asset.categoryOption?.name || undefined,
      brand: asset.brandOption?.name || undefined,
      custom_fields_values: asset.custom_fields_values || undefined,
      updater: (asset as any).updater?.name ? { id: (asset as any).updater.id, name: (asset as any).updater.name } : undefined,
      accessories: accessoriesResponse,
      attachments: attachmentsResponse,
      parentAsset: parentResponse
    };
  }

  private normalizeAccessoriesInput(value: any): Array<{ accessory_asset_id: number; accessory_type: 'monitor' | 'keyboard' | 'mouse' | 'other'; notes?: string | null }> {
    if (!Array.isArray(value)) return [];
    const allowedTypes = new Set(['monitor', 'keyboard', 'mouse', 'other']);
    const out: Array<{ accessory_asset_id: number; accessory_type: 'monitor' | 'keyboard' | 'mouse' | 'other'; notes?: string | null }> = [];
    for (const row of value) {
      if (!row || typeof row !== 'object') continue;
      const accessoryId = Number((row as any).asset_id ?? (row as any).accessory_asset_id);
      const rawType = (row as any).type ?? (row as any).accessory_type;
      const type = String(rawType || '').trim().toLowerCase();
      if (!Number.isFinite(accessoryId) || accessoryId <= 0) continue;
      if (!allowedTypes.has(type)) continue;
      const notesRaw = (row as any).notes;
      const notes = notesRaw === undefined || notesRaw === null || notesRaw === '' ? null : String(notesRaw).slice(0, 255);
      out.push({ accessory_asset_id: accessoryId, accessory_type: type as any, notes });
    }
    const dedup = new Map<number, { accessory_asset_id: number; accessory_type: 'monitor' | 'keyboard' | 'mouse' | 'other'; notes?: string | null }>();
    out.forEach((r) => {
      if (!dedup.has(r.accessory_asset_id)) dedup.set(r.accessory_asset_id, r);
    });
    return Array.from(dedup.values());
  }

  private async upsertAccessories(args: {
    manager: any;
    assetId: number;
    masterlistId: number;
    actionBy?: number;
    accessories: Array<{ accessory_asset_id: number; accessory_type: 'monitor' | 'keyboard' | 'mouse' | 'other'; notes?: string | null }>;
  }) {
    const repo = args.manager.getRepository(AssetAccessory);
    const historyRepo = args.manager.getRepository('AssetPairingHistory');

    // 1. Dapatkan aksesori sedia ada untuk rekod log UNPAIRED
    const existing = await repo.find({ where: { asset_id: args.assetId } });
    const existingIds = new Set(existing.map((e: any) => e.accessory_asset_id));
    
    // 2. Buang semua aksesori lama
    if (existing.length > 0) {
      await repo.delete({ asset_id: args.assetId });
    }

    if (!args.accessories.length) {
      // Jika semua dibuang, log UNPAIRED
      if (existing.length > 0) {
        const unpairLogs = existing.map((e: any) => ({
          parent_asset_id: args.assetId,
          accessory_asset_id: e.accessory_asset_id,
          action: 'UNPAIRED',
          action_by: args.actionBy || null
        }));
        await historyRepo.save(unpairLogs);
      }
      return;
    }

    const accessoryIds = args.accessories.map((a) => a.accessory_asset_id).filter((id) => id !== args.assetId);
    const uniqueAccessoryIds = Array.from(new Set(accessoryIds));
    if (uniqueAccessoryIds.length !== accessoryIds.length) {
      throw this.createHttpError(400, 'Aset tambahan tidak boleh diduplikasi');
    }

    if (uniqueAccessoryIds.length === 0) return;

    const allowedRows = await args.manager
      .getRepository(Asset)
      .createQueryBuilder('asset')
      .leftJoin(
        MasterlistAsset,
        'masterlistAsset',
        'masterlistAsset.asset_id = asset.id AND masterlistAsset.masterlist_id = :masterlistId',
        { masterlistId: args.masterlistId }
      )
      .where('asset.id IN (:...ids)', { ids: uniqueAccessoryIds })
      .andWhere('(asset.masterlist_id = :masterlistId OR masterlistAsset.masterlist_id = :masterlistId)', { masterlistId: args.masterlistId })
      .select(['asset.id'])
      .getMany();

    const allowed = new Set<number>(allowedRows.map((r: any) => r.id));
    const invalid = accessoryIds.find((id) => !allowed.has(id));
    if (invalid) {
      throw this.createHttpError(400, 'Aset tambahan mestilah dalam masterlist yang sama');
    }

    // Semak exclusive pairing: aksesori tak boleh dipasang di tempat lain
    const conflicting = await repo.find({
      where: { accessory_asset_id: In(accessoryIds) }
    });
    
    const conflictsFromOtherParent = conflicting.filter((c: any) => c.asset_id !== args.assetId);
    if (conflictsFromOtherParent.length > 0) {
      throw this.createHttpError(400, 'Aset tambahan telah dipasangkan dengan peranti lain. Sila nyah-pasang terlebih dahulu.');
    }

    const payload = args.accessories
      .filter((a) => a.accessory_asset_id !== args.assetId)
      .map((a) => ({
        asset_id: args.assetId,
        accessory_asset_id: a.accessory_asset_id,
        accessory_type: a.accessory_type,
        notes: a.notes ?? null
      }));
    if (!payload.length) return;

    await repo.save(payload);

    // Rekod ke asset_pairing_history
    const historyLogs: any[] = [];
    const newAccessoryIds = new Set(payload.map((p) => p.accessory_asset_id));

    // 1. Yang digugurkan (ada dalam existing, tak ada dalam payload baru)
    existingIds.forEach((oldId: number) => {
      if (!newAccessoryIds.has(oldId)) {
        historyLogs.push({
          parent_asset_id: args.assetId,
          accessory_asset_id: oldId,
          action: 'UNPAIRED',
          action_by: args.actionBy || null
        });
      }
    });

    // 2. Yang baru ditambah (ada dalam payload, tak ada dalam existing)
    newAccessoryIds.forEach((newId: number) => {
      if (!existingIds.has(newId)) {
        historyLogs.push({
          parent_asset_id: args.assetId,
          accessory_asset_id: newId,
          action: 'PAIRED',
          action_by: args.actionBy || null
        });
      }
    });

    if (historyLogs.length > 0) {
      await historyRepo.save(historyLogs);
    }

    // Copy user assignments from main asset to newly paired accessory assets
    await this.copyAssetUsersToAccessoryAssets(args.manager, args.assetId, payload.map(p => p.accessory_asset_id));
  }

  private async copyAssetUsersToAccessoryAssets(manager: any, mainAssetId: number, accessoryAssetIds: number[]): Promise<void> {
    if (!accessoryAssetIds.length) return;

    const userRepo = manager.getRepository(AssetUser);
    const mainAssetUsers = await userRepo.find({ where: { asset_id: mainAssetId } });
    if (!mainAssetUsers.length) return;

    for (const accessoryId of accessoryAssetIds) {
      for (const user of mainAssetUsers) {
        const existing = await userRepo.findOne({
          where: { asset_id: accessoryId, user_name: user.user_name }
        });
        if (existing) continue;

        const newUser = userRepo.create({
          asset_id: accessoryId,
          user_name: user.user_name,
          position: user.position,
          department: user.department,
          floor: user.floor,
          building: user.building,
          location: user.location,
          branch: user.branch,
          state: user.state
        });
        await userRepo.save(newUser);
      }
    }
  }

  getAll = async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        page = 1,
        limit = 10,
        sort = 'desc',
        sortBy = 'created_at',
        q,
        status,
        masterlist_id,
        project_id
      } = req.query;

      const safeSortBy = ['created_at', 'updated_at', 'name', 'asset_tag', 'status'].includes(String(sortBy))
        ? String(sortBy)
        : 'created_at';
      const safeSort = String(sort).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
      const pageNumber = Math.max(Number(page) || 1, 1);
      const limitNumber = Math.max(Number(limit) || 10, 1);
      const currentUserId = req.user?.id;
      const userPermissions = req.userPermissions || [];
      const canViewAll = req.user?.role?.toLowerCase() === 'admin'
        || userPermissions.includes('assets:view:all')
        || userPermissions.includes('tasks:view:all');
      const canViewOwn = userPermissions.includes('assets:view:own')
        || userPermissions.includes('tasks:view:own')
        || userPermissions.includes('tasks:view:assigned');

      const queryBuilder = this.assetRepository
        .createQueryBuilder('asset')
        .leftJoinAndSelect('asset.masterlist', 'masterlist')
        .leftJoinAndSelect('masterlist.project', 'project')
        .leftJoinAndSelect('asset.creator', 'creator')
        .leftJoinAndSelect('asset.updater', 'updater')
        .leftJoinAndSelect('asset.categoryOption', 'categoryOption')
        .leftJoinAndSelect('asset.brandOption', 'brandOption')
        .leftJoinAndSelect('asset.accessories', 'accessories')
        .leftJoinAndSelect('accessories.accessoryAsset', 'accessoryAsset')
        .leftJoinAndSelect('accessoryAsset.categoryOption', 'accCat')
        .leftJoinAndSelect('asset.attachments', 'attachments')
        .leftJoinAndSelect('asset.parentAccessoryLink', 'parentLink')
        .leftJoinAndSelect('parentLink.asset', 'parentAssetItem')
        .leftJoinAndSelect('parentAssetItem.categoryOption', 'parentCat')
        .select([
          'asset.id',
          'asset.masterlist_id',
          'asset.asset_tag',
          'asset.name',
          'asset.category_id',
          'asset.brand_id',
          'asset.model',
          'asset.serial_number',
          'asset.group',
          'asset.status',
          'asset.notes',
          'asset.created_by',
          'asset.updated_by',
          'asset.created_at',
          'asset.updated_at',
          'masterlist.id',
          'masterlist.project_id',
          'masterlist.code',
          'masterlist.name',
          'project.id',
          'project.code',
          'project.name',
          'creator.id',
          'creator.name',
          'updater.id',
          'updater.name',
          'categoryOption.id',
          'categoryOption.name',
          'brandOption.id',
          'brandOption.name',
          'accessories',
          'attachments',
          'accessoryAsset.id',
          'parentLink',
          'parentAssetItem.id',
          'parentAssetItem.name',
          'parentAssetItem.asset_tag',
          'parentCat.name'
        ]);

      if (q) {
        queryBuilder.andWhere(
          '(asset.asset_tag LIKE :search OR asset.name LIKE :search OR brandOption.name LIKE :search OR categoryOption.name LIKE :search OR asset.model LIKE :search OR asset.serial_number LIKE :search)',
          { search: `%${String(q)}%` }
        );
      }

      if (status) {
        queryBuilder.andWhere('asset.status = :status', { status: String(status) });
      }

      if (masterlist_id) {
        const masterlistId = Number(masterlist_id);
        queryBuilder.leftJoin(
          MasterlistAsset,
          'masterlistAsset',
          'masterlistAsset.asset_id = asset.id AND masterlistAsset.masterlist_id = :masterlistId',
          { masterlistId }
        );
        queryBuilder.andWhere(
          '(asset.masterlist_id = :masterlistId OR masterlistAsset.masterlist_id = :masterlistId)',
          { masterlistId }
        );
      }

      if (project_id) {
        queryBuilder.andWhere('masterlist.project_id = :projectId', { projectId: Number(project_id) });
      }

      if (!canViewAll && canViewOwn && currentUserId) {
        queryBuilder.andWhere(
          '(asset.created_by = :currentUserId OR EXISTS (SELECT 1 FROM tasks t WHERE t.project_id = masterlist.project_id AND t.assigned_to = :currentUserId))',
          { currentUserId }
        );
      }

      queryBuilder
        .orderBy(`asset.${safeSortBy}`, safeSort as 'ASC' | 'DESC')
        .skip((pageNumber - 1) * limitNumber)
        .take(limitNumber);

      const [assets, total] = await queryBuilder.getManyAndCount();
      const totalPages = Math.max(Math.ceil(total / limitNumber), 1);
      const dataRows = assets.map((asset) => this.toAssetResponse(asset));

      res.json({
        success: true,
        data: {
          assets: dataRows,
          pagination: {
            total,
            page: pageNumber,
            limit: limitNumber,
            totalPages
          }
        }
      });
    } catch (error: any) {
      console.error('Error fetching assets:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  };

  getOne = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = Number(req.params.id);
      const currentUserId = req.user?.id;
      const userPermissions = req.userPermissions || [];
      const canViewAll = req.user?.role?.toLowerCase() === 'admin'
        || userPermissions.includes('assets:view:all')
        || userPermissions.includes('tasks:view:all');
      const canViewOwn = userPermissions.includes('assets:view:own')
        || userPermissions.includes('tasks:view:own')
        || userPermissions.includes('tasks:view:assigned');
      const asset = await this.assetRepository.findOne({
        where: { id },
        relations: [
          'masterlist',
          'masterlist.project',
          'creator',
          'categoryOption',
          'brandOption',
          'assetUsers',
          'attachments',
          'accessories',
          'accessories.accessoryAsset',
          'accessories.accessoryAsset.categoryOption',
          'parentAccessoryLink',
          'parentAccessoryLink.asset',
          'parentAccessoryLink.asset.categoryOption'
        ]
      });

      if (!asset) {
        res.status(404).json({
          success: false,
          message: 'Aset tidak ditemui'
        });
        return;
      }

      if (!canViewAll && canViewOwn && currentUserId) {
        const hasOwnAccess = await this.assetRepository
          .createQueryBuilder('asset')
          .leftJoin('asset.masterlist', 'masterlist')
          .where('asset.id = :id', { id })
          .andWhere(
            '(asset.created_by = :currentUserId OR EXISTS (SELECT 1 FROM tasks t WHERE t.project_id = masterlist.project_id AND t.assigned_to = :currentUserId))',
            { currentUserId }
          )
          .getOne();

        if (!hasOwnAccess) {
          res.status(403).json({
            success: false,
            message: 'Anda hanya boleh melihat aset yang diassign kepada anda'
          });
          return;
        }
      }

      res.json({
        success: true,
        data: this.toAssetResponse(asset)
      });
    } catch (error: any) {
      console.error('Error fetching asset:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  };

  getPairingHistory = async (req: Request, res: Response): Promise<void> => {
    try {
      const { asset_id, page = 1, limit = 50 } = req.query;
      const pageNumber = Math.max(Number(page) || 1, 1);
      const limitNumber = Math.max(Number(limit) || 50, 1);

      const historyRepo = AppDataSource.getRepository('AssetPairingHistory');
      const queryBuilder = historyRepo.createQueryBuilder('history')
        .leftJoinAndSelect('history.parentAsset', 'parent')
        .leftJoinAndSelect('history.accessoryAsset', 'accessory')
        .leftJoinAndSelect('history.actionByUser', 'user')
        .select([
          'history.id',
          'history.action',
          'history.created_at',
          'parent.id',
          'parent.name',
          'parent.asset_tag',
          'accessory.id',
          'accessory.name',
          'accessory.asset_tag',
          'user.id',
          'user.name'
        ])
        .orderBy('history.created_at', 'DESC');

      if (asset_id) {
        queryBuilder.andWhere('(history.parent_asset_id = :id OR history.accessory_asset_id = :id)', { id: Number(asset_id) });
      }

      queryBuilder
        .skip((pageNumber - 1) * limitNumber)
        .take(limitNumber);

      const [logs, total] = await queryBuilder.getManyAndCount();

      res.json({
        success: true,
        data: {
          logs,
          pagination: {
            total,
            page: pageNumber,
            limit: limitNumber,
            totalPages: Math.ceil(total / limitNumber)
          }
        }
      });
    } catch (error: any) {
      console.error('Error fetching pairing history:', error);
      res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
  };

  getUpdateLogs = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = Number(req.params.id);
      const logRepo = AppDataSource.getRepository(AssetUpdateLog);
      const logs = await logRepo.find({
        where: { asset_id: id },
        relations: ['user'],
        order: { created_at: 'DESC' },
        take: 50
      });
      res.json({ success: true, data: logs });
    } catch (error: any) {
      console.error('Error fetching asset update logs:', error);
      res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
  };

  create = async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        masterlist_id,
        asset_tag,
        name,
        category_id,
        brand_id,
        model,
        serial_number,
        group,
        status,
        notes,
        custom_fields_values,
        accessories
      } = req.body;

      const masterlist = await this.masterlistRepository.findOne({ where: { id: Number(masterlist_id) } });
      if (!masterlist) {
        res.status(404).json({
          success: false,
          message: 'Masterlist tidak ditemui'
        });
        return;
      }

      const parsedCategoryId = this.normalizeOptionalId(category_id);
      const parsedBrandId = this.normalizeOptionalId(brand_id);

      if (parsedCategoryId !== undefined && parsedCategoryId !== null) {
        const category = await this.categoryRepository.findOne({ where: { id: parsedCategoryId } });
        if (!category) {
          res.status(400).json({
            success: false,
            message: 'Kategori aset tidak sah'
          });
          return;
        }
      }

      if (parsedBrandId !== undefined && parsedBrandId !== null) {
        const brand = await this.brandRepository.findOne({ where: { id: parsedBrandId } });
        if (!brand) {
          res.status(400).json({
            success: false,
            message: 'Brand aset tidak sah'
          });
          return;
        }
      }

      let savedAssetId: number | null = null;

      await AppDataSource.transaction(async (manager) => {
        const txAssetRepository = manager.getRepository(Asset);

        const asset = txAssetRepository.create({
          masterlist_id: Number(masterlist_id),
          asset_tag: asset_tag ? String(asset_tag).trim() : undefined,
          name: String(name).trim(),
          category_id: parsedCategoryId === undefined ? null : parsedCategoryId,
          brand_id: parsedBrandId === undefined ? null : parsedBrandId,
          model,
          serial_number,
          group,
          status: status || AssetStatus.AKTIF,
          notes,
          custom_fields_values: custom_fields_values || undefined,
          created_by: req.user?.id,
          updated_by: req.user?.id || null
        });

        const saved = await txAssetRepository.save(asset);
        savedAssetId = saved.id;

        const normalizedAccessories = this.normalizeAccessoriesInput(accessories);
        await this.upsertAccessories({
          manager,
          assetId: saved.id,
          masterlistId: Number(masterlist_id),
          actionBy: req.user?.id,
          accessories: normalizedAccessories
        });

        await this.logAssetMutation({
          assetId: saved.id,
          userId: req.user?.id,
          actionType: 'CREATE',
          req,
          manager
        });
      });

      const savedWithRelations = savedAssetId
        ? await this.assetRepository.findOne({
            where: { id: savedAssetId },
            relations: [
              'masterlist',
              'masterlist.project',
              'creator',
              'updater',
              'categoryOption',
              'brandOption',
              'assetUsers',
              'attachments',
              'accessories',
              'accessories.accessoryAsset',
              'accessories.accessoryAsset.categoryOption',
              'parentAccessoryLink',
              'parentAccessoryLink.asset',
              'parentAccessoryLink.asset.categoryOption'
            ]
          })
        : null;

      if (!savedWithRelations) {
        throw this.createHttpError(500, 'Gagal memuatkan aset yang baru disimpan');
      }

      await AuditService.log({
        req,
        actionType: 'CREATE',
        tableName: 'assets',
        recordId: savedWithRelations.id,
        newValues: this.toAssetResponse(savedWithRelations),
        description: `Aset dicipta: ${savedWithRelations.name} - ${savedWithRelations.serial_number || 'N/A'}`
      });

      res.status(201).json({
        success: true,
        message: 'Aset created successfully',
        data: this.toAssetResponse(savedWithRelations)
      });
    } catch (error: any) {
      if (error?.statusCode) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
        return;
      }

      console.error('Error creating asset:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  };

  update = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = Number(req.params.id);
      const asset = await this.assetRepository.findOne({ where: { id } });

      if (!asset) {
        res.status(404).json({
          success: false,
          message: 'Aset tidak ditemui'
        });
        return;
      }

      const {
        masterlist_id,
        asset_tag,
        name,
        category_id,
        brand_id,
        model,
        serial_number,
        group,
        status,
        notes,
        accessories
      } = req.body;

      if (masterlist_id !== undefined && Number(masterlist_id) !== asset.masterlist_id) {
        const masterlist = await this.masterlistRepository.findOne({ where: { id: Number(masterlist_id) } });
        if (!masterlist) {
          res.status(404).json({
            success: false,
            message: 'Masterlist tidak ditemui'
          });
          return;
        }
        asset.masterlist_id = Number(masterlist_id);
      }

      if (asset_tag !== undefined) asset.asset_tag = asset_tag ? String(asset_tag).trim() : undefined;
      if (name !== undefined) asset.name = String(name).trim();

      const parsedCategoryId = this.normalizeOptionalId(category_id);
      const parsedBrandId = this.normalizeOptionalId(brand_id);

      if (parsedCategoryId !== undefined) {
        if (parsedCategoryId !== null) {
          const category = await this.categoryRepository.findOne({ where: { id: parsedCategoryId } });
          if (!category) {
            res.status(400).json({
              success: false,
              message: 'Kategori aset tidak sah'
            });
            return;
          }
        }
        asset.category_id = parsedCategoryId;
      }

      if (parsedBrandId !== undefined) {
        if (parsedBrandId !== null) {
          const brand = await this.brandRepository.findOne({ where: { id: parsedBrandId } });
          if (!brand) {
            res.status(400).json({
              success: false,
              message: 'Brand aset tidak sah'
            });
            return;
          }
        }
        asset.brand_id = parsedBrandId;
      }

      if (model !== undefined) asset.model = model;
      if (serial_number !== undefined) asset.serial_number = serial_number;
      if (group !== undefined) asset.group = group;
      if (status !== undefined) asset.status = status;
      if (notes !== undefined) asset.notes = notes;

      let auditSnap: { old: Record<string, any>; action: string; assetName: string; assetSN: string } | null = null;

      await AppDataSource.transaction(async (manager) => {
        const txAssetRepository = manager.getRepository(Asset);
        const currentAsset = await txAssetRepository.findOne({ where: { id } });

        if (!currentAsset) {
          throw this.createHttpError(404, 'Aset tidak ditemui');
        }

        const oldValues: Record<string, any> = {
          masterlist_id: currentAsset.masterlist_id,
          asset_tag: currentAsset.asset_tag,
          name: currentAsset.name,
          category_id: currentAsset.category_id,
          brand_id: currentAsset.brand_id,
          model: currentAsset.model,
          serial_number: currentAsset.serial_number,
          group: currentAsset.group,
          status: currentAsset.status,
          notes: currentAsset.notes
        };

        currentAsset.masterlist_id = asset.masterlist_id;
        currentAsset.asset_tag = asset.asset_tag;
        currentAsset.name = asset.name;
        currentAsset.category_id = asset.category_id;
        currentAsset.brand_id = asset.brand_id;
        currentAsset.model = asset.model;
        currentAsset.serial_number = asset.serial_number;
        currentAsset.group = asset.group;
        currentAsset.status = asset.status;
        currentAsset.notes = asset.notes;
        currentAsset.updated_by = req.user?.id || null;
        await txAssetRepository.save(currentAsset);

        const newValues: Record<string, any> = {
          masterlist_id: currentAsset.masterlist_id,
          asset_tag: currentAsset.asset_tag,
          name: currentAsset.name,
          category_id: currentAsset.category_id,
          brand_id: currentAsset.brand_id,
          model: currentAsset.model,
          serial_number: currentAsset.serial_number,
          group: currentAsset.group,
          status: currentAsset.status,
          notes: currentAsset.notes
        };

        const fieldChanges: Record<string, { old: any; new: any }> = {};
        for (const key of Object.keys(newValues)) {
          const oldVal = oldValues[key];
          const newVal = newValues[key];
          if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
            fieldChanges[key] = { old: oldVal, new: newVal };
          }
        }

        const isStatusOnlyChange = Object.keys(fieldChanges).length === 1 && 'status' in fieldChanges;
        const actionType = isStatusOnlyChange ? 'STATUS_CHANGE' : 'UPDATE';

        auditSnap = {
          old: { ...oldValues },
          action: actionType,
          assetName: currentAsset.name,
          assetSN: currentAsset.serial_number || 'N/A'
        };

        await this.logAssetMutation({
          assetId: currentAsset.id,
          userId: req.user?.id,
          actionType,
          fieldChanges,
          req,
          manager
        });

        const normalizedAccessories = this.normalizeAccessoriesInput(accessories);
        await this.upsertAccessories({
          manager,
          assetId: currentAsset.id,
          masterlistId: currentAsset.masterlist_id,
          actionBy: req.user?.id,
          accessories: normalizedAccessories
        });
      });

      const updated = await this.assetRepository.findOne({ where: { id } });

      const updatedWithRelations = await this.assetRepository.findOne({
        where: { id: updated.id },
        relations: [
          'masterlist',
          'masterlist.project',
          'creator',
          'updater',
          'categoryOption',
          'brandOption',
          'assetUsers',
          'attachments',
          'accessories',
          'accessories.accessoryAsset',
          'accessories.accessoryAsset.categoryOption',
          'parentAccessoryLink',
          'parentAccessoryLink.asset',
          'parentAccessoryLink.asset.categoryOption'
        ]
      });

      if (auditSnap) {
        await AuditService.log({
          req,
          actionType: 'UPDATE',
          tableName: 'assets',
          recordId: id,
          oldValues: auditSnap.old,
          newValues: { id, ...asset },
          description: `Aset dikemaskini: ${auditSnap.assetName} - ${auditSnap.assetSN}`
        });
      }

      res.json({
        success: true,
        message: 'Aset updated successfully',
        data: updatedWithRelations ? this.toAssetResponse(updatedWithRelations) : this.toAssetResponse(updated)
      });
    } catch (error: any) {
      if (error?.statusCode) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
        return;
      }

      console.error('Error updating asset:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  };

  delete = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = Number(req.params.id);
      const asset = await this.assetRepository.findOne({ where: { id } });

      if (!asset) {
        res.status(404).json({
          success: false,
          message: 'Aset tidak ditemui'
        });
        return;
      }

      await this.logAssetMutation({
        assetId: asset.id,
        userId: req.user?.id,
        actionType: 'DELETE',
        req
      });

      const assetSnapshot = {
        id: asset.id,
        name: asset.name,
        asset_tag: asset.asset_tag,
        serial_number: asset.serial_number,
        masterlist_id: asset.masterlist_id,
        status: asset.status
      };

      await this.assetRepository.remove(asset);

      await AuditService.log({
        req,
        actionType: 'DELETE',
        tableName: 'assets',
        recordId: id,
        oldValues: assetSnapshot,
        description: `Aset dipadam: ${assetSnapshot.name} - ${assetSnapshot.serial_number || 'N/A'}`
      });

      res.json({
        success: true,
        message: 'Aset deleted successfully'
      });
    } catch (error: any) {
      console.error('Error deleting asset:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  };

  uploadAttachments = async (req: Request, res: Response): Promise<void> => {
    try {
      const assetId = Number(req.params.id);
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        res.status(400).json({
          success: false,
          message: 'Tiada fail dimuat naik'
        });
        return;
      }

      const asset = await this.assetRepository.findOne({ where: { id: assetId } });
      if (!asset) {
        res.status(404).json({
          success: false,
          message: 'Aset tidak ditemui'
        });
        return;
      }

      const attachments = files.map(file => ({
        asset_id: assetId,
        file_name: file.originalname,
        file_path: file.path,
        file_type: file.mimetype,
        file_size: file.size
      }));

      await this.attachmentsRepository.save(attachments);

      await this.logAssetMutation({
        assetId,
        userId: req.user?.id,
        actionType: 'UPLOAD_ATTACHMENTS',
        req
      });

      res.json({
        success: true,
        message: `${files.length} lampiran berjaya dimuat naik`,
        data: attachments
      });
    } catch (error: any) {
      console.error('Error uploading attachments:', error);
      res.status(500).json({
        success: false,
        message: 'Ralat semasa memuat naik lampiran',
        error: error.message
      });
    }
  };

  deleteAttachment = async (req: Request, res: Response): Promise<void> => {
    try {
      const assetId = Number(req.params.id);
      const attachmentId = Number(req.params.attachmentId);

      const attachment = await this.attachmentsRepository.findOne({
        where: { id: attachmentId, asset_id: assetId }
      });

      if (!attachment) {
        res.status(404).json({
          success: false,
          message: 'Lampiran tidak ditemui'
        });
        return;
      }

      // Delete file from filesystem
      const fs = require('fs');
      const path = require('path');
      if (fs.existsSync(attachment.file_path)) {
        fs.unlinkSync(attachment.file_path);
      }

      await this.attachmentsRepository.remove(attachment);

      await this.logAssetMutation({
        assetId,
        userId: req.user?.id,
        actionType: 'DELETE_ATTACHMENT',
        req
      });

      res.json({
        success: true,
        message: 'Lampiran berjaya dipadam'
      });
    } catch (error: any) {
      console.error('Error deleting attachment:', error);
      res.status(500).json({
        success: false,
        message: 'Ralat semasa memadam lampiran',
        error: error.message
      });
    }
  };

  updateAttachment = async (req: Request, res: Response): Promise<void> => {
    try {
      const assetId = Number(req.params.id);
      const attachmentId = Number(req.params.attachmentId);
      const { display_name } = req.body as { display_name?: string };

      const attachment = await this.attachmentsRepository.findOne({
        where: { id: attachmentId, asset_id: assetId }
      });

      if (!attachment) {
        res.status(404).json({
          success: false,
          message: 'Lampiran tidak ditemui'
        });
        return;
      }

      attachment.display_name = display_name?.trim() || undefined;
      await this.attachmentsRepository.save(attachment);

      res.json({
        success: true,
        message: 'Nama lampiran dikemaskini',
        data: attachment
      });
    } catch (error: any) {
      console.error('Error updating attachment:', error);
      res.status(500).json({
        success: false,
        message: 'Ralat semasa mengemaskini lampiran',
        error: error.message
      });
    }
  };
}
