
import { Request, Response } from 'express';
import { AppDataSource } from '../config/database.js';
import { AuditTrail } from '../models/AuditTrail.js';
import { Between, Like, FindOptionsWhere, Raw } from 'typeorm';

export const getAuditLogs = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 50, startDate, endDate, actionType, tableName, userId, search } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: FindOptionsWhere<AuditTrail> = {};

    if (startDate && endDate) {
      where.timestamp = Between(new Date(startDate as string), new Date(endDate as string));
    }

    if (actionType) {
      where.action_type = actionType as string;
    }

    if (tableName) {
      where.table_name = tableName as string;
    }

    if (userId) {
      where.user_id = parseInt(userId as string);
    }
    
    if (search) {
        const searchStr = search as string;
        if (searchStr.startsWith('TX-')) {
            // Flexible search for correlation ID in new_values JSON
             // Replace spaces and encoded spaces with wildcard to handle encoding differences
             const searchPattern = searchStr.replace(/%20/g, '%').replace(/ /g, '%');
             // MySQL uses CAST AS CHAR, and LIKE is case-insensitive
             where.new_values = Raw(alias => `CAST(${alias} AS CHAR) LIKE :pattern`, { pattern: `%${searchPattern}%` });
        } else {
            where.description = Like(`%${searchStr}%`);
        }
    }

    const [logs, total] = await AppDataSource.getRepository(AuditTrail).findAndCount({
      where,
      take: limitNum,
      skip,
      order: { timestamp: 'DESC' },
      relations: ['user']
    });

    res.json({
      success: true,
      data: {
        data: logs,
        pagination: {
            total,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

export const exportAuditLogs = async (req: Request, res: Response) => {
    // Basic CSV Export implementation for now
    try {
        const { startDate, endDate, actionType, tableName, userId } = req.query;
        
        const where: FindOptionsWhere<AuditTrail> = {};
        if (startDate && endDate) {
          where.timestamp = Between(new Date(startDate as string), new Date(endDate as string));
        }
        if (actionType) where.action_type = actionType as string;
        if (tableName) where.table_name = tableName as string;
        if (userId) where.user_id = parseInt(userId as string);

        const logs = await AppDataSource.getRepository(AuditTrail).find({
            where,
            order: { timestamp: 'DESC' },
            relations: ['user']
        });

        // Generate CSV content
        const headers = ['ID', 'User', 'Action', 'Table', 'Record ID', 'Description', 'Timestamp', 'IP Address'];
        const rows = logs.map(log => [
            log.id,
            log.user ? `${log.user.name} (${log.user.email})` : 'System/Unknown',
            log.action_type,
            log.table_name,
            log.record_id,
            `"${log.description?.replace(/"/g, '""')}"`, // Escape quotes
            log.timestamp.toISOString(),
            log.ip_address
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(r => r.join(','))
        ].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=audit_logs.csv');
        res.send(csvContent);

    } catch (error) {
        console.error('Error exporting audit logs:', error);
        res.status(500).json({ success: false, message: 'Export failed' });
    }
}
