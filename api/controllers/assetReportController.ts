import { Request, Response } from 'express';
import { AppDataSource } from '../config/database.ts';
import { AssetUpdateLog } from '../models/AssetUpdateLog.ts';

export class AssetReportController {
  getTopUpdaters = async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        project_id,
        masterlist_id,
        category_id,
        action_type,
        status,
        period,
        start_date,
        end_date,
        limit = 20
      } = req.query;

      const logRepo = AppDataSource.getRepository(AssetUpdateLog);

      const queryBuilder = logRepo
        .createQueryBuilder('log')
        .leftJoin('log.asset', 'asset')
        .leftJoin('asset.masterlist', 'masterlist')
        .leftJoin('masterlist.project', 'project')
        .leftJoin('log.user', 'user')
        .select([
          'user.id AS user_id',
          'user.name AS user_name',
          'COUNT(log.id) AS update_count',
          'MAX(log.created_at) AS last_update'
        ])
        .groupBy('user.id')
        .addGroupBy('user.name')
        .orderBy('update_count', 'DESC');

      if (project_id) {
        queryBuilder.andWhere('masterlist.project_id = :projectId', { projectId: Number(project_id) });
      }

      if (masterlist_id) {
        queryBuilder.andWhere('asset.masterlist_id = :masterlistId', { masterlistId: Number(masterlist_id) });
      }

      if (category_id) {
        queryBuilder.andWhere('asset.category_id = :categoryId', { categoryId: Number(category_id) });
      }

      if (action_type) {
        queryBuilder.andWhere('log.action_type = :actionType', { actionType: String(action_type) });
      }

      if (status) {
        queryBuilder.andWhere('asset.status = :status', { status: String(status) });
      }

      const now = new Date();
      let dateStart: Date | undefined;
      let dateEnd: Date | undefined;

      if (start_date) {
        dateStart = new Date(String(start_date));
      }
      if (end_date) {
        dateEnd = new Date(String(end_date));
        dateEnd.setHours(23, 59, 59, 999);
      }

      if (period && !start_date) {
        dateEnd = now;
        switch (String(period).toLowerCase()) {
          case 'daily':
            dateStart = new Date(now);
            dateStart.setHours(0, 0, 0, 0);
            break;
          case 'weekly':
            dateStart = new Date(now);
            dateStart.setDate(now.getDate() - 7);
            dateStart.setHours(0, 0, 0, 0);
            break;
          case 'monthly':
            dateStart = new Date(now);
            dateStart.setMonth(now.getMonth() - 1);
            dateStart.setHours(0, 0, 0, 0);
            break;
          case 'quarterly':
            dateStart = new Date(now);
            dateStart.setMonth(now.getMonth() - 3);
            dateStart.setHours(0, 0, 0, 0);
            break;
          case 'yearly':
            dateStart = new Date(now);
            dateStart.setFullYear(now.getFullYear() - 1);
            dateStart.setHours(0, 0, 0, 0);
            break;
        }
      }

      if (dateStart) {
        queryBuilder.andWhere('log.created_at >= :startDate', { startDate: dateStart });
      }
      if (dateEnd) {
        queryBuilder.andWhere('log.created_at <= :endDate', { endDate: dateEnd });
      }

      queryBuilder.limit(Math.min(Number(limit) || 20, 100));

      const result = await queryBuilder.getRawMany();

      const filteredResult = result.filter((row: any) => row.user_id !== null);

      const total = filteredResult.length;

      res.json({
        success: true,
        data: {
          topUpdaters: filteredResult,
          pagination: {
            total,
            page: 1,
            limit: Number(limit) || 20,
            totalPages: 1
          },
          filters: {
            period: period || 'custom',
            start_date: dateStart || null,
            end_date: dateEnd || null,
            project_id: project_id ? Number(project_id) : null,
            masterlist_id: masterlist_id ? Number(masterlist_id) : null,
            category_id: category_id ? Number(category_id) : null,
            action_type: action_type ? String(action_type) : null,
            status: status ? String(status) : null
          }
        }
      });
    } catch (error: any) {
      console.error('Error fetching top asset updaters:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  };

  getAssetUpdateLogs = async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        page = 1,
        limit = 20,
        asset_id,
        project_id,
        masterlist_id,
        category_id,
        action_type,
        status,
        period,
        start_date,
        end_date
      } = req.query;

      const logRepo = AppDataSource.getRepository(AssetUpdateLog);

      const queryBuilder = logRepo
        .createQueryBuilder('log')
        .leftJoinAndSelect('log.asset', 'asset')
        .leftJoinAndSelect('asset.masterlist', 'masterlist')
        .leftJoinAndSelect('masterlist.project', 'project')
        .leftJoinAndSelect('log.user', 'user')
        .orderBy('log.created_at', 'DESC');

      if (asset_id) {
        queryBuilder.andWhere('log.asset_id = :assetId', { assetId: Number(asset_id) });
      }

      if (project_id) {
        queryBuilder.andWhere('masterlist.project_id = :projectId', { projectId: Number(project_id) });
      }

      if (masterlist_id) {
        queryBuilder.andWhere('asset.masterlist_id = :masterlistId', { masterlistId: Number(masterlist_id) });
      }

      if (category_id) {
        queryBuilder.andWhere('asset.category_id = :categoryId', { categoryId: Number(category_id) });
      }

      if (action_type) {
        queryBuilder.andWhere('log.action_type = :actionType', { actionType: String(action_type) });
      }

      if (status) {
        queryBuilder.andWhere('asset.status = :status', { status: String(status) });
      }

      const now = new Date();
      let dateStart: Date | undefined;
      let dateEnd: Date | undefined;

      if (start_date) {
        dateStart = new Date(String(start_date));
      }
      if (end_date) {
        dateEnd = new Date(String(end_date));
        dateEnd.setHours(23, 59, 59, 999);
      }

      if (period && !start_date) {
        dateEnd = now;
        switch (String(period).toLowerCase()) {
          case 'daily':
            dateStart = new Date(now);
            dateStart.setHours(0, 0, 0, 0);
            break;
          case 'weekly':
            dateStart = new Date(now);
            dateStart.setDate(now.getDate() - 7);
            dateStart.setHours(0, 0, 0, 0);
            break;
          case 'monthly':
            dateStart = new Date(now);
            dateStart.setMonth(now.getMonth() - 1);
            dateStart.setHours(0, 0, 0, 0);
            break;
          case 'quarterly':
            dateStart = new Date(now);
            dateStart.setMonth(now.getMonth() - 3);
            dateStart.setHours(0, 0, 0, 0);
            break;
          case 'yearly':
            dateStart = new Date(now);
            dateStart.setFullYear(now.getFullYear() - 1);
            dateStart.setHours(0, 0, 0, 0);
            break;
        }
      }

      if (dateStart) {
        queryBuilder.andWhere('log.created_at >= :startDate', { startDate: dateStart });
      }
      if (dateEnd) {
        queryBuilder.andWhere('log.created_at <= :endDate', { endDate: dateEnd });
      }

      const pageNumber = Math.max(Number(page) || 1, 1);
      const limitNumber = Math.min(Math.max(Number(limit) || 20, 1), 100);

      queryBuilder
        .skip((pageNumber - 1) * limitNumber)
        .take(limitNumber);

      const [logs, total] = await queryBuilder.getManyAndCount();

      const dataRows = logs.map((log: any) => ({
        id: log.id,
        asset_id: log.asset_id,
        action_type: log.action_type,
        field_changes: log.field_changes,
        ip_address: log.ip_address,
        created_at: log.created_at,
        user: log.user ? { id: log.user.id, name: log.user.name } : null,
        asset: log.asset ? {
          id: log.asset.id,
          name: log.asset.name,
          asset_tag: log.asset.asset_tag,
          status: log.asset.status,
          serial_number: log.asset.serial_number,
          masterlist: log.asset.masterlist ? {
            id: log.asset.masterlist.id,
            code: log.asset.masterlist.code,
            name: log.asset.masterlist.name,
            project: log.asset.masterlist.project ? {
              id: log.asset.masterlist.project.id,
              code: log.asset.masterlist.project.code,
              name: log.asset.masterlist.project.name
            } : null
          } : null
        } : null
      }));

      res.json({
        success: true,
        data: {
          logs: dataRows,
          pagination: {
            total,
            page: pageNumber,
            limit: limitNumber,
            totalPages: Math.max(Math.ceil(total / limitNumber), 1)
          }
        }
      });
    } catch (error: any) {
      console.error('Error fetching asset update logs:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  };
}
