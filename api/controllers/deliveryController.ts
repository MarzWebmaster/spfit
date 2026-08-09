import { Request, Response } from 'express';
import { AppDataSource } from '../config/database.ts';
import { WhatsAppMessage } from '../models/WhatsAppMessage.ts';

export const getDeliveryLogs = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 50, to, status, correlationId, search } = req.query as any;
    const repo = AppDataSource.getRepository(WhatsAppMessage);
    const take = Number(limit);
    const skip = (Number(page) - 1) * take;

    const qb = repo.createQueryBuilder('m').orderBy('m.queued_at', 'DESC').skip(skip).take(take);
    if (to) qb.andWhere('m.to = :to', { to });
    if (status) qb.andWhere('m.status = :status', { status });
    if (correlationId) qb.andWhere('m.correlation_id = :cid', { cid: correlationId });
    if (search) qb.andWhere('(m.message LIKE :s OR m.last_error LIKE :s)', { s: `%${search}%` });

    const [rows, total] = await qb.getManyAndCount();
    res.json({
      success: true,
      data: {
        logs: rows,
        pagination: { total, page: Number(page), limit: take, totalPages: Math.ceil(total / take) }
      }
    });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};
