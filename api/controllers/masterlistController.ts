import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { AppDataSource } from '../config/database.ts';
import { Masterlist, MasterlistStatus } from '../models/Masterlist.ts';
import { Project } from '../models/Project.ts';
import { Asset } from '../models/Asset.ts';
import { MasterlistAsset } from '../models/MasterlistAsset.ts';
import { AuditService } from '../services/auditService.ts';
import { getFileInfo } from '../middleware/upload.ts';
import * as XLSX from 'xlsx';

export class MasterlistController {
  private masterlistRepository = AppDataSource.getRepository(Masterlist);
  private projectRepository = AppDataSource.getRepository(Project);

  getAll = async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        page = 1,
        limit = 10,
        sort = 'desc',
        sortBy = 'created_at',
        q,
        status,
        project_id
      } = req.query;

      const safeSortBy = ['created_at', 'updated_at', 'name', 'code', 'status'].includes(String(sortBy))
        ? String(sortBy)
        : 'created_at';
      const safeSort = String(sort).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
      const pageNumber = Math.max(Number(page) || 1, 1);
      const limitNumber = Math.max(Number(limit) || 10, 1);
      const currentUserId = req.user?.id;
      const userPermissions = req.userPermissions || [];
      const canViewAll = req.user?.role?.toLowerCase() === 'admin'
        || userPermissions.includes('masterlists:view:all')
        || userPermissions.includes('tasks:view:all');
      const canViewOwn = userPermissions.includes('masterlists:view:own')
        || userPermissions.includes('tasks:view:own')
        || userPermissions.includes('tasks:view:assigned');

      const queryBuilder = this.masterlistRepository
        .createQueryBuilder('masterlist')
        .leftJoinAndSelect('masterlist.project', 'project')
        .leftJoinAndSelect('project.mainCon', 'mainCon')
        .leftJoinAndSelect('masterlist.creator', 'creator')
        .loadRelationCountAndMap('masterlist.asset_count', 'masterlist.assets')
        .select([
          'masterlist.id',
          'masterlist.project_id',
          'masterlist.code',
          'masterlist.name',
          'masterlist.description',
          'masterlist.status',
          'masterlist.custom_fields_definition',
          'masterlist.work_links',
          'masterlist.work_documents',
          'masterlist.created_by',
          'masterlist.created_at',
          'masterlist.updated_at',
          'project.id',
          'project.code',
          'project.name',
          'project.client_name',
          'project.main_con_id',
          'mainCon.id',
          'mainCon.name',
          'creator.id',
          'creator.name'
        ]);

      if (q) {
        queryBuilder.andWhere(
          '(masterlist.code LIKE :search OR masterlist.name LIKE :search OR masterlist.description LIKE :search)',
          { search: `%${String(q)}%` }
        );
      }

      if (status) {
        queryBuilder.andWhere('masterlist.status = :status', { status: String(status) });
      }

      if (project_id) {
        queryBuilder.andWhere('masterlist.project_id = :projectId', { projectId: Number(project_id) });
      }

      if (!canViewAll && canViewOwn && currentUserId) {
        queryBuilder.andWhere(
          '(masterlist.created_by = :currentUserId OR EXISTS (SELECT 1 FROM tasks t WHERE t.project_id = masterlist.project_id AND t.assigned_to = :currentUserId))',
          { currentUserId }
        );
      }

      queryBuilder
        .orderBy(`masterlist.${safeSortBy}`, safeSort as 'ASC' | 'DESC')
        .skip((pageNumber - 1) * limitNumber)
        .take(limitNumber);

      const [masterlists, total] = await queryBuilder.getManyAndCount();
      const totalPages = Math.max(Math.ceil(total / limitNumber), 1);

      if (masterlists.length) {
        const ids = masterlists.map((m: any) => Number(m.id)).filter((v) => Number.isFinite(v) && v > 0);
        if (ids.length) {
          const placeholders = ids.map(() => '?').join(',');
          const rows = await AppDataSource.query(
            `SELECT masterlist_id, COUNT(*) AS listing_count
             FROM masterlist_assets
             WHERE masterlist_id IN (${placeholders})
             GROUP BY masterlist_id`,
            ids
          );
          const byId = new Map<number, number>();
          (rows || []).forEach((r: any) => byId.set(Number(r.masterlist_id), Number(r.listing_count || 0)));
          masterlists.forEach((m: any) => {
            const extra = byId.get(Number(m.id)) || 0;
            const existing = Number((m as any).asset_count || 0);
            (m as any).asset_count = existing + extra;
          });
        }
      }

      res.json({
        success: true,
        data: {
          masterlists,
          pagination: {
            total,
            page: pageNumber,
            limit: limitNumber,
            totalPages
          }
        }
      });
    } catch (error: any) {
      console.error('Error fetching masterlists:', error);
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
      const includeAssets = String(req.query.include_assets || 'false').toLowerCase() === 'true';
      const currentUserId = req.user?.id;
      const userPermissions = req.userPermissions || [];
      const canViewAll = req.user?.role?.toLowerCase() === 'admin'
        || userPermissions.includes('masterlists:view:all')
        || userPermissions.includes('tasks:view:all');
      const canViewOwn = userPermissions.includes('masterlists:view:own')
        || userPermissions.includes('tasks:view:own')
        || userPermissions.includes('tasks:view:assigned');
      const masterlist = await this.masterlistRepository
        .createQueryBuilder('masterlist')
        .leftJoinAndSelect('masterlist.project', 'project')
        .leftJoinAndSelect('project.mainCon', 'mainCon')
        .leftJoinAndSelect('masterlist.creator', 'creator')
        .loadRelationCountAndMap('masterlist.asset_count', 'masterlist.assets')
        .select([
          'masterlist.id',
          'masterlist.project_id',
          'masterlist.code',
          'masterlist.name',
          'masterlist.description',
          'masterlist.status',
          'masterlist.custom_fields_definition',
          'masterlist.work_links',
          'masterlist.work_documents',
          'masterlist.created_by',
          'masterlist.created_at',
          'masterlist.updated_at',
          'project.id',
          'project.code',
          'project.name',
          'project.client_name',
          'project.main_con_id',
          'mainCon.id',
          'mainCon.name',
          'creator.id',
          'creator.name'
        ])
        .where('masterlist.id = :id', { id })
        .getOne();

      if (!masterlist) {
        res.status(404).json({
          success: false,
          message: 'Masterlist not found'
        });
        return;
      }

      if (!canViewAll && canViewOwn && currentUserId) {
        const hasOwnAccess = await AppDataSource
          .createQueryBuilder()
          .select('1')
          .from(Masterlist, 'masterlist')
          .where('masterlist.id = :id', { id })
          .andWhere('(masterlist.created_by = :currentUserId OR EXISTS (SELECT 1 FROM tasks t WHERE t.project_id = masterlist.project_id AND t.assigned_to = :currentUserId))', { currentUserId })
          .getRawOne();

        if (!hasOwnAccess) {
          res.status(403).json({
            success: false,
            message: 'Anda hanya boleh melihat masterlist yang diassign kepada anda'
          });
          return;
        }
      }

      const listingCountRows = await AppDataSource.query(
        'SELECT COUNT(*) AS listing_count FROM masterlist_assets WHERE masterlist_id = ?',
        [id]
      );
      const listingCount = Number(listingCountRows?.[0]?.listing_count || 0);
      const directCount = Number((masterlist as any).asset_count || 0);
      (masterlist as any).asset_count = directCount + listingCount;

      let assets: any[] = [];
      if (includeAssets) {
        assets = await AppDataSource.getRepository(Asset)
          .createQueryBuilder('asset')
          .leftJoin('masterlist_assets', 'masterlistAsset', 'masterlistAsset.asset_id = asset.id AND masterlistAsset.masterlist_id = :id', { id })
          .leftJoinAndSelect('asset.creator', 'creator')
          .leftJoinAndSelect('asset.categoryOption', 'categoryOption')
          .leftJoinAndSelect('asset.brandOption', 'brandOption')
          .leftJoinAndSelect('asset.desktopDetails', 'desktopDetails')
          .leftJoinAndSelect('asset.laptopDetails', 'laptopDetails')
          .leftJoinAndSelect('asset.printerDetails', 'printerDetails')
          .leftJoinAndSelect('asset.monitorDetails', 'monitorDetails')
          .where('(asset.masterlist_id = :id OR masterlistAsset.masterlist_id = :id)', { id })
          .orderBy('asset.created_at', 'DESC')
          .getMany();
      }

      res.json({
        success: true,
        data: {
          ...(masterlist as any),
          ...(includeAssets
            ? {
                assets: assets.map((asset: any) => ({
                  ...asset,
                  category: asset.categoryOption?.name || undefined,
                  brand: asset.brandOption?.name || undefined
                }))
              }
            : {})
        }
      });
    } catch (error: any) {
      console.error('Error fetching masterlist:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  };

  duplicate = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = Number(req.params.id);
      const creatorId = req.user?.id;
      if (!creatorId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
        return;
      }

      const original = await this.masterlistRepository.findOne({ where: { id } });

      if (!original) {
        res.status(404).json({
          success: false,
          message: 'Masterlist not found'
        });
        return;
      }

      const targetProjectId = req.body?.project_id ? Number(req.body.project_id) : original.project_id;
      const includeAssets = req.body?.include_assets !== false;

      const targetProject = await this.projectRepository.findOne({ where: { id: targetProjectId } });
      if (!targetProject) {
        res.status(404).json({
          success: false,
          message: 'Projek tidak ditemui'
        });
        return;
      }

      const result = await AppDataSource.transaction(async manager => {
        const masterlistRepo = manager.getRepository(Masterlist);
        const masterlistAssetRepo = manager.getRepository(MasterlistAsset);

        const originalName = String(original.name || '').trim() || 'Masterlist';
        const namePrefix = `Copy of ${originalName}`;
        let newName = req.body?.name ? String(req.body.name).trim() : namePrefix;
        for (let suffix = 2; suffix <= 200; suffix += 1) {
          const count = await masterlistRepo.count({
            where: { project_id: targetProjectId, name: newName } as any
          });
          if (!count) break;
          newName = `${namePrefix} (${suffix})`;
        }

        const originalCode = String(original.code || '').trim() || 'ML';
        const codePrefix = `${originalCode}-COPY`;
        let newCode = req.body?.code ? String(req.body.code).trim() : codePrefix;
        for (let suffix = 2; suffix <= 200; suffix += 1) {
          const count = await masterlistRepo.count({
            where: { project_id: targetProjectId, code: newCode } as any
          });
          if (!count) break;
          newCode = `${codePrefix}${suffix}`;
        }

        const clonedMasterlist = masterlistRepo.create({
          project_id: targetProjectId,
          code: newCode,
          name: newName,
          description: original.description,
          status: original.status || MasterlistStatus.AKTIF,
          custom_fields_definition: original.custom_fields_definition ? JSON.parse(JSON.stringify(original.custom_fields_definition)) : undefined,
          work_links: original.work_links ? JSON.parse(JSON.stringify(original.work_links)) : undefined,
          work_documents: original.work_documents ? JSON.parse(JSON.stringify(original.work_documents)) : undefined,
          created_by: creatorId
        });

        const savedMasterlist = await masterlistRepo.save(clonedMasterlist);
        let linkedAssetCount = 0;
        if (includeAssets) {
          const assetRows = await manager.query(
            `SELECT asset_id FROM (
              SELECT a.id AS asset_id FROM assets a WHERE a.masterlist_id = ?
              UNION
              SELECT ma.asset_id AS asset_id FROM masterlist_assets ma WHERE ma.masterlist_id = ?
            ) x`,
            [id, id]
          );
          const assetIds = (assetRows || [])
            .map((r: any) => Number(r.asset_id))
            .filter((v: number) => Number.isFinite(v) && v > 0);

          if (assetIds.length) {
            await masterlistAssetRepo.save(
              assetIds.map((assetId) => masterlistAssetRepo.create({ masterlist_id: savedMasterlist.id, asset_id: assetId }))
            );
            linkedAssetCount = assetIds.length;
          }
        }

        await AuditService.log({
          req,
          userId: creatorId,
          actionType: 'CREATE',
          tableName: 'masterlists',
          recordId: savedMasterlist.id,
          newValues: savedMasterlist,
          description: `Menduplikasi masterlist: ${savedMasterlist.code} - ${savedMasterlist.name} (linked assets: ${linkedAssetCount})`
        });

        return { masterlist: savedMasterlist, linked_asset_count: linkedAssetCount };
      });

      res.status(201).json({
        success: true,
        message: 'Masterlist duplicated successfully',
        data: result
      });
    } catch (error: any) {
      console.error('Error duplicating masterlist:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  };

  create = async (req: Request, res: Response): Promise<void> => {
    try {
      const { project_id, code, name, description, status, links, link_url, link_title, document_title } = req.body;

      const project = await this.projectRepository.findOne({ where: { id: Number(project_id) } });
      if (!project) {
        res.status(404).json({
          success: false,
          message: 'Projek tidak ditemui'
        });
        return;
      }

      const duplicate = await this.masterlistRepository.findOne({
        where: {
          project_id: Number(project_id),
          code: String(code)
        }
      });

      if (duplicate) {
        res.status(409).json({
          success: false,
          message: 'Kod masterlist sudah wujud untuk projek ini'
        });
        return;
      }

      const normalizedLinks: Array<{ title: string; url: string }> = [];
      if (typeof links === 'string' && String(links).trim()) {
        try {
          const parsed = JSON.parse(String(links));
          if (Array.isArray(parsed)) {
            parsed.forEach((item: any) => {
              const titleValue = String(item?.title || '').trim();
              const urlValue = String(item?.url || '').trim();
              if (titleValue && urlValue) normalizedLinks.push({ title: titleValue, url: urlValue });
            });
          }
        } catch {
          res.status(400).json({
            success: false,
            message: 'Format links tidak sah'
          });
          return;
        }
      } else if (Array.isArray(links)) {
        links.forEach((item: any) => {
          const titleValue = String(item?.title || '').trim();
          const urlValue = String(item?.url || '').trim();
          if (titleValue && urlValue) normalizedLinks.push({ title: titleValue, url: urlValue });
        });
      }

      if (link_url && link_title) {
        normalizedLinks.push({ title: String(link_title).trim(), url: String(link_url).trim() });
      }

      const documents: Array<{
        title: string;
        file_name: string;
        file_path: string;
        file_type?: string;
        file_size?: number;
        uploaded_at: string;
      }> = [];

      if (req.file) {
        const titleValue = String(document_title || '').trim();
        if (!titleValue) {
          res.status(400).json({
            success: false,
            message: 'Nama dokumen wajib diisi'
          });
          return;
        }

        const info = getFileInfo(req.file);
        documents.push({
          title: titleValue,
          file_name: info.filename,
          file_path: String(info.relativePath).replace(/\\/g, '/'),
          file_type: info.mimetype,
          file_size: info.size,
          uploaded_at: new Date().toISOString()
        });
      }

      const masterlist = this.masterlistRepository.create({
        project_id: Number(project_id),
        code: String(code).trim(),
        name: String(name).trim(),
        description,
        status: status || MasterlistStatus.AKTIF,
        work_links: normalizedLinks.length ? normalizedLinks : undefined,
        work_documents: documents.length ? documents : undefined,
        created_by: req.user?.id
      });

      const saved = await this.masterlistRepository.save(masterlist);

      await AuditService.log({
        req,
        actionType: 'CREATE',
        tableName: 'masterlists',
        recordId: saved.id,
        newValues: saved,
        description: `Masterlist dicipta: ${saved.code} - ${saved.name}`
      });

      res.status(201).json({
        success: true,
        message: 'Masterlist created successfully',
        data: saved
      });
    } catch (error: any) {
      console.error('Error creating masterlist:', error);
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
      const masterlist = await this.masterlistRepository.findOne({ where: { id } });

      if (!masterlist) {
        res.status(404).json({
          success: false,
          message: 'Masterlist not found'
        });
        return;
      }

      const { project_id, code, name, description, status, links, link_url, link_title, document_title } = req.body;

      if (project_id !== undefined && Number(project_id) !== masterlist.project_id) {
        const project = await this.projectRepository.findOne({ where: { id: Number(project_id) } });
        if (!project) {
          res.status(404).json({
            success: false,
            message: 'Projek tidak ditemui'
          });
          return;
        }
        masterlist.project_id = Number(project_id);
      }

      if (code !== undefined && String(code).trim() !== masterlist.code) {
        const duplicate = await this.masterlistRepository.findOne({
          where: {
            project_id: masterlist.project_id,
            code: String(code).trim()
          }
        });

        if (duplicate && duplicate.id !== masterlist.id) {
          res.status(409).json({
            success: false,
            message: 'Kod masterlist sudah wujud untuk projek ini'
          });
          return;
        }

        masterlist.code = String(code).trim();
      }

      if (name !== undefined) masterlist.name = String(name).trim();
      if (description !== undefined) masterlist.description = description;
      if (status !== undefined) masterlist.status = status;

      if (links !== undefined) {
        const normalizedLinks: Array<{ title: string; url: string }> = [];
        if (typeof links === 'string' && String(links).trim()) {
          try {
            const parsed = JSON.parse(String(links));
            if (Array.isArray(parsed)) {
              parsed.forEach((item: any) => {
                const titleValue = String(item?.title || '').trim();
                const urlValue = String(item?.url || '').trim();
                if (titleValue && urlValue) normalizedLinks.push({ title: titleValue, url: urlValue });
              });
            }
          } catch {
            res.status(400).json({
              success: false,
              message: 'Format links tidak sah'
            });
            return;
          }
        } else if (Array.isArray(links)) {
          links.forEach((item: any) => {
            const titleValue = String(item?.title || '').trim();
            const urlValue = String(item?.url || '').trim();
            if (titleValue && urlValue) normalizedLinks.push({ title: titleValue, url: urlValue });
          });
        }

        masterlist.work_links = normalizedLinks.length ? normalizedLinks : undefined;
      } else if (link_url && link_title) {
        const existing = Array.isArray(masterlist.work_links) ? masterlist.work_links : [];
        masterlist.work_links = [...existing, { title: String(link_title).trim(), url: String(link_url).trim() }];
      }

      if (req.file) {
        const titleValue = String(document_title || '').trim();
        if (!titleValue) {
          res.status(400).json({
            success: false,
            message: 'Nama dokumen wajib diisi'
          });
          return;
        }

        const existing = Array.isArray(masterlist.work_documents) ? masterlist.work_documents : [];
        const info = getFileInfo(req.file);
        masterlist.work_documents = [
          ...existing,
          {
            title: titleValue,
            file_name: info.filename,
            file_path: String(info.relativePath).replace(/\\/g, '/'),
            file_type: info.mimetype,
            file_size: info.size,
            uploaded_at: new Date().toISOString()
          }
        ];
      }

      const updated = await this.masterlistRepository.save(masterlist);

      await AuditService.log({
        req,
        actionType: 'UPDATE',
        tableName: 'masterlists',
        recordId: updated.id,
        newValues: { id: updated.id, code: updated.code, name: updated.name, status: updated.status },
        description: `Masterlist dikemaskini: ${updated.code} - ${updated.name}`
      });

      res.json({
        success: true,
        message: 'Masterlist updated successfully',
        data: updated
      });
    } catch (error: any) {
      console.error('Error updating masterlist:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  };

  deleteWorkLink = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = Number(req.params.id);
      const index = Number(req.params.index);

      const masterlist = await this.masterlistRepository.findOne({ where: { id } });
      if (!masterlist) {
        res.status(404).json({ success: false, message: 'Masterlist not found' });
        return;
      }

      const links = Array.isArray(masterlist.work_links) ? [...masterlist.work_links] : [];
      if (index < 0 || index >= links.length) {
        res.status(404).json({ success: false, message: 'Link tidak dijumpai' });
        return;
      }

      links.splice(index, 1);
      masterlist.work_links = (links.length ? links : null) as any;

      const updated = await this.masterlistRepository.save(masterlist);

      res.json({
        success: true,
        message: 'Link berjaya dipadam',
        data: updated
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Gagal memadam link',
        error: error?.message
      });
    }
  };

  deleteWorkDocument = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = Number(req.params.id);
      const index = Number(req.params.index);

      const masterlist = await this.masterlistRepository.findOne({ where: { id } });
      if (!masterlist) {
        res.status(404).json({ success: false, message: 'Masterlist not found' });
        return;
      }

      const documents = Array.isArray(masterlist.work_documents) ? [...masterlist.work_documents] : [];
      if (index < 0 || index >= documents.length) {
        res.status(404).json({ success: false, message: 'Dokumen tidak dijumpai' });
        return;
      }

      const document = documents[index];
      const filePath = String(document?.file_path || '').replace(/\\/g, '/');
      if (filePath) {
        const uploadsRoot = path.resolve(process.cwd(), 'uploads');
        const absolutePath = path.resolve(process.cwd(), filePath);
        const allowedPrefix = uploadsRoot.endsWith(path.sep) ? uploadsRoot : `${uploadsRoot}${path.sep}`;

        if (!absolutePath.startsWith(allowedPrefix)) {
          res.status(400).json({ success: false, message: 'Laluan fail tidak sah' });
          return;
        }

        if (fs.existsSync(absolutePath)) {
          fs.unlinkSync(absolutePath);
        }
      }

      documents.splice(index, 1);
      masterlist.work_documents = (documents.length ? documents : null) as any;

      const updated = await this.masterlistRepository.save(masterlist);

      res.json({
        success: true,
        message: 'Dokumen berjaya dipadam',
        data: updated
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Gagal memadam dokumen',
        error: error?.message
      });
    }
  };

  delete = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = Number(req.params.id);
      const masterlist = await this.masterlistRepository.findOne({
        where: { id },
        relations: ['assets']
      });

      if (!masterlist) {
        res.status(404).json({
          success: false,
          message: 'Masterlist not found'
        });
        return;
      }

      if (masterlist.assets && masterlist.assets.length > 0) {
        res.status(400).json({
          success: false,
          message: 'Masterlist masih mempunyai aset. Padam aset dahulu.'
        });
        return;
      }

      const deletedSnapshot = {
        id: masterlist.id,
        code: masterlist.code,
        name: masterlist.name,
        project_id: masterlist.project_id,
        status: masterlist.status
      };

      await this.masterlistRepository.remove(masterlist);

      await AuditService.log({
        req,
        actionType: 'DELETE',
        tableName: 'masterlists',
        recordId: id,
        oldValues: deletedSnapshot,
        description: `Masterlist dipadam: ${deletedSnapshot.code} - ${deletedSnapshot.name}`
      });

      res.json({
        success: true,
        message: 'Masterlist deleted successfully'
      });
    } catch (error: any) {
      console.error('Error deleting masterlist:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  };

  exportData = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = Number(req.params.id);
      const currentUserId = req.user?.id;
      const userPermissions = req.userPermissions || [];
      const canViewAll = req.user?.role?.toLowerCase() === 'admin'
        || userPermissions.includes('masterlists:view:all')
        || userPermissions.includes('tasks:view:all');
      const canViewOwn = userPermissions.includes('masterlists:view:own')
        || userPermissions.includes('tasks:view:own')
        || userPermissions.includes('tasks:view:assigned');

      const masterlist = await this.masterlistRepository
        .createQueryBuilder('masterlist')
        .leftJoinAndSelect('masterlist.project', 'project')
        .leftJoinAndSelect('project.mainCon', 'mainCon')
        .where('masterlist.id = :id', { id })
        .getOne();

      if (!masterlist) {
        res.status(404).json({ success: false, message: 'Masterlist not found' });
        return;
      }

      if (!canViewAll && canViewOwn && currentUserId) {
        const hasOwnAccess = await AppDataSource
          .createQueryBuilder()
          .select('1')
          .from(Masterlist, 'masterlist')
          .where('masterlist.id = :id', { id })
          .andWhere('(masterlist.created_by = :currentUserId OR EXISTS (SELECT 1 FROM tasks t WHERE t.project_id = masterlist.project_id AND t.assigned_to = :currentUserId))', { currentUserId })
          .getRawOne();

        if (!hasOwnAccess) {
          res.status(403).json({ success: false, message: 'Anda hanya boleh melihat masterlist yang diassign kepada anda' });
          return;
        }
      }

      const assets = await AppDataSource.getRepository(Asset)
        .createQueryBuilder('asset')
        .leftJoin('masterlist_assets', 'masterlistAsset', 'masterlistAsset.asset_id = asset.id AND masterlistAsset.masterlist_id = :id', { id })
        .leftJoinAndSelect('asset.categoryOption', 'categoryOption')
        .leftJoinAndSelect('asset.brandOption', 'brandOption')
        .leftJoinAndSelect('asset.assetUsers', 'assetUsers')
        .leftJoinAndSelect('asset.accessories', 'accessories')
        .leftJoinAndSelect('accessories.accessoryAsset', 'accessoryAsset')
        .leftJoinAndSelect('accessoryAsset.categoryOption', 'accCategoryOption')
        .where('(asset.masterlist_id = :id OR masterlistAsset.masterlist_id = :id)', { id })
        .orderBy('asset.created_at', 'DESC')
        .getMany();

      const exportRows = assets.map((asset: any) => {
        const users: Array<Record<string, string>> = [];
        (asset.assetUsers || []).forEach((u: any) => {
          users.push({
            user_name: u.user_name || '',
            position: u.position || '',
            department: u.department || '',
            floor: u.floor || '',
            building: u.building || '',
            location: u.location || '',
            branch: u.branch || '',
            state: u.state || ''
          });
        });

        const accessories: Array<Record<string, string>> = [];
        (asset.accessories || []).forEach((acc: any) => {
          accessories.push({
            accessory_type: acc.accessory_type || '',
            serial_number: acc.accessoryAsset?.serial_number || '',
            name: acc.accessoryAsset?.name || '',
            tag: acc.accessoryAsset?.asset_tag || ''
          });
        });

        return {
          masterlist_code: (masterlist as any).code || '',
          masterlist_name: (masterlist as any).name || '',
          masterlist_status: (masterlist as any).status || '',
          project_code: (masterlist as any).project?.code || '',
          project_name: (masterlist as any).project?.name || '',
          asset_id: asset.id,
          asset_tag: asset.asset_tag || '',
          asset_name: asset.name || '',
          serial_number: asset.serial_number || '',
          brand: asset.brandOption?.name || '',
          model: asset.model || '',
          category: asset.categoryOption?.name || '',
          status: asset.status || '',
          notes: asset.notes || '',
          users,
          accessories
        };
      });

      res.json({
        success: true,
        data: {
          masterlist: {
            code: (masterlist as any).code,
            name: (masterlist as any).name,
            status: (masterlist as any).status
          },
          assets: exportRows
        }
      });
    } catch (error: any) {
      console.error('Error exporting masterlist:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  };

  private parseCSVLine(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
        continue;
      }
      if (ch === ',' && !inQuotes) { values.push(current.trim()); current = ''; continue; }
      current += ch;
    }
    values.push(current.trim());
    return values;
  }

  private parseCSVText(text: string): Record<string, string>[] {
    const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return [];
    const headers = this.parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
    const rows: Record<string, string>[] = [];
    for (let i = 1; i < lines.length; i++) {
      const vals = this.parseCSVLine(lines[i]);
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => { if (vals[idx]) row[h] = vals[idx]; });
      if (Object.keys(row).length) rows.push(row);
    }
    return rows;
  }

  private parseXLSXText(buffer: Buffer): Record<string, string>[] {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' });
    return data.map(row => {
      const r: Record<string, string> = {};
      for (const [k, v] of Object.entries(row)) r[k.trim().toLowerCase()] = String(v ?? '').trim();
      return r;
    }).filter(r => Object.values(r).some(v => v));
  }

  private async parseDocumentText(buffer: Buffer, extension: string): Promise<string> {
    if (extension === '.pdf') {
      try {
        const pdfParse = (await import('pdf-parse')).default || (await import('pdf-parse'));
        const data = await pdfParse(buffer);
        return data.text || '';
      } catch { return ''; }
    }
    if (extension === '.docx') {
      try {
        const mammoth = await import('mammoth');
        const result = await mammoth.extractRawText({ buffer });
        return result.value || '';
      } catch { return ''; }
    }
    return buffer.toString('utf8');
  }

  private parseRowsFromText(text: string): Record<string, string>[] {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return [];
    const delims = [',', '\t', '|', ';'];
    let bestDelim = ',';
    let bestScore = 0;
    for (const d of delims) {
      const counts = lines.map(l => l.split(d).length);
      const pct = counts.filter(c => c === counts[0]).length / counts.length;
      if (pct > bestScore) { bestScore = pct; bestDelim = d; }
    }
    if (bestScore < 0.4) return [];
    const headers = lines[0].split(bestDelim).map(h => h.trim().toLowerCase().replace(/^"|"$/g,''));
    return lines.slice(1).map(line => {
      const vals = line.split(bestDelim).map(v => v.trim().replace(/^"|"$/g,''));
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => { if (vals[idx]) row[h] = vals[idx]; });
      return row;
    }).filter(r => Object.keys(r).length);
  }

  importValidate = async (req: Request, res: Response): Promise<void> => {
    try {
      const file = req.file;
      if (!file) { res.status(400).json({ success: false, message: 'Fail diperlukan' }); return; }

      let rows: Record<string, string>[] = [];
      const ext = path.extname(file.originalname).toLowerCase();

      if (ext === '.csv' || file.mimetype.includes('csv') || file.mimetype.includes('text/csv')) {
        rows = this.parseCSVText(file.buffer.toString('utf8'));
      } else if (ext === '.xlsx' || ext === '.xls' || file.mimetype.includes('spreadsheet') || file.mimetype.includes('excel')) {
        rows = this.parseXLSXText(file.buffer);
      } else if (['.pdf', '.docx', '.txt', '.log', '.md', '.rtf'].includes(ext)) {
        const text = await this.parseDocumentText(file.buffer, ext);
        rows = text ? this.parseRowsFromText(text) : [];
      } else {
        res.status(400).json({ success: false, message: 'Format fail tidak disokong. Guna CSV, XLSX, PDF, DOCX, atau TXT.' }); return;
      }

      if (!rows.length) { res.status(400).json({ success: false, message: 'Tiada data sah ditemui dalam fail.' }); return; }

      res.json({
        success: true,
        data: { totalRows: rows.length, sampleRows: rows.slice(0, 5), allRows: rows, headers: Object.keys(rows[0]) }
      });
    } catch (err: any) {
      console.error('Masterlist import validate error:', err);
      res.status(500).json({ success: false, message: err.message || 'Ralat validasi fail' });
    }
  };

  importProcess = async (req: Request, res: Response): Promise<void> => {
    try {
      const { rows, columnMapping } = req.body as { rows: Record<string, string>[]; columnMapping: Record<string, string> };
      if (!rows?.length) { res.status(400).json({ success: false, message: 'Tiada data untuk diimport' }); return; }

      let created = 0;
      let updated = 0;
      let errors: string[] = [];
      const projectCache = new Map<string, number>();

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const mapped: Record<string, string> = {};
        for (const [src, target] of Object.entries(columnMapping || {})) {
          if (target && row[src]) mapped[target] = row[src];
        }

        const code = mapped['masterlist_code'] || mapped['code'] || '';
        const name = mapped['masterlist_name'] || mapped['name'] || '';
        if (!name) { errors.push(`Row ${i + 2}: Nama masterlist diperlukan`); continue; }
        if (!code) { errors.push(`Row ${i + 2}: Kod masterlist diperlukan`); continue; }

        try {
          let projectId: number | undefined;
          const projectCode = mapped['project_code'];
          if (projectCode) {
            if (projectCache.has(projectCode)) {
              projectId = projectCache.get(projectCode);
            } else {
              let proj = await this.projectRepository.findOne({ where: { code: projectCode } });
              if (!proj) {
                // Auto-create project if it doesn't exist
                proj = this.projectRepository.create({ code: projectCode, name: projectCode });
                await this.projectRepository.save(proj);
              }
              projectId = proj.id;
              projectCache.set(projectCode, projectId);
            }
          }

          const status = mapped['masterlist_status'] || mapped['status'] || MasterlistStatus.AKTIF;
          const description = mapped['description'] || mapped['notes'] || undefined;

          const existing = await this.masterlistRepository.findOne({ where: { code } });
          if (existing) {
            existing.name = name;
            existing.project_id = projectId || existing.project_id;
            existing.status = status as MasterlistStatus;
            existing.description = description || existing.description;
            await this.masterlistRepository.save(existing);
            updated++;
          } else {
            const ml = this.masterlistRepository.create({
              code, name, project_id: projectId, status: status as MasterlistStatus, description,
              created_by: req.user?.id
            });
            await this.masterlistRepository.save(ml);
            created++;
          }
        } catch (e: any) {
          errors.push(`Row ${i + 2}: ${e.message}`);
        }
      }

      res.json({
        success: errors.length === 0,
        message: `Import selesai: ${created} dicipta, ${updated} dikemaskini${errors.length ? `, ${errors.length} ralat` : ''}`,
        data: { created, updated, errorCount: errors.length, errors: errors.slice(0, 20) }
      });
    } catch (err: any) {
      console.error('Masterlist import process error:', err);
      res.status(500).json({ success: false, message: err.message || 'Ralat import' });
    }
  };
}
