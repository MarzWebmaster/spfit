import { Request, Response } from 'express';
import { AppDataSource } from '../config/database.ts';
import { Payment, PaymentStatus, Task, TaskDone, TaskStatus } from '../models/index.ts';
import { TaskStatusOption } from '../models/TaskStatusOption.ts';
import { deleteUploadedFiles, getFileInfo } from '../middleware/upload.ts';

export class PaymentController {
  private paymentRepository = AppDataSource.getRepository(Payment);
  private taskRepository = AppDataSource.getRepository(Task);
  private taskDoneRepository = AppDataSource.getRepository(TaskDone);
  private taskStatusRepository = AppDataSource.getRepository(TaskStatusOption);

  private hasViewAllPermission(req: Request): boolean {
    const permissions = req.userPermissions || [];
    return req.user?.role?.toLowerCase() === 'admin'
      || permissions.includes('payments:view:all')
      || permissions.includes('tasks:view:all');
  }

  private hasViewOwnPermission(req: Request): boolean {
    const permissions = req.userPermissions || [];
    return permissions.includes('payments:view:own')
      || permissions.includes('tasks:view:own')
      || permissions.includes('tasks:view:assigned');
  }

  private normalizeText(value: unknown): string {
    return String(value ?? '').trim();
  }

  private async resolveStatusId(statusName: TaskStatus): Promise<number> {
    const status = await this.taskStatusRepository.findOne({ where: { name: statusName, is_active: true } });
    if (!status) {
      throw new Error(`Task status option not found for ${statusName}`);
    }
    return status.id;
  }

  getAllPayments = async (req: Request, res: Response): Promise<void> => {
    try {
      const { page = 1, limit = 10, status, search } = req.query;
      const skip = (Number(page) - 1) * Number(limit);
      const currentUserId = req.user?.id;
      const canViewAll = this.hasViewAllPermission(req);
      const canViewOwn = this.hasViewOwnPermission(req);

      const queryBuilder = this.paymentRepository.createQueryBuilder('payment')
        .leftJoinAndSelect('payment.task', 'task')
        .leftJoinAndSelect('task.mainCon', 'mainCon')
        .leftJoinAndSelect('task.statusSetting', 'statusSetting')
        .leftJoinAndSelect('payment.taskDone', 'taskDone')
        .leftJoinAndSelect('payment.freelancer', 'freelancer')
        .leftJoinAndSelect('payment.approver', 'approver')
        .leftJoinAndSelect('payment.payer', 'payer')
        .select([
          'payment',
          'task.id',
          'task.title',
          'task.log_number',
          'task.status_id',
          'task.deadline',
          'mainCon.id',
          'mainCon.name',
          'statusSetting.id',
          'statusSetting.name',
          'freelancer.id',
          'freelancer.name',
          'freelancer.email',
          'approver.id',
          'approver.name',
          'payer.id',
          'payer.name',
          'taskDone.id',
          'taskDone.support_pdf_url',
          'taskDone.submitted_at'
        ]);

      queryBuilder
        .andWhere('payment.recipient_name IS NOT NULL')
        .andWhere('payment.recipient_name <> ""')
        .andWhere('payment.recipient_account_number IS NOT NULL')
        .andWhere('payment.recipient_account_number <> ""')
        .andWhere('payment.recipient_bank_name IS NOT NULL')
        .andWhere('payment.recipient_bank_name <> ""')
        .andWhere('payment.recipient_email IS NOT NULL')
        .andWhere('payment.recipient_email <> ""');

      if (status) {
        queryBuilder.andWhere('payment.status = :status', { status: String(status) });
      }

      if (search) {
        queryBuilder.andWhere(
          '(task.log_number LIKE :search OR task.title LIKE :search OR freelancer.name LIKE :search)',
          { search: `%${String(search)}%` }
        );
      }

      if (!canViewAll && canViewOwn && currentUserId) {
        queryBuilder.andWhere(
          '(payment.freelancer_id = :currentUserId OR task.assigned_to = :currentUserId)',
          { currentUserId }
        );
      }

      queryBuilder.orderBy('payment.created_at', 'DESC').skip(skip).take(Number(limit));

      const [payments, total] = await queryBuilder.getManyAndCount();

      res.json({
        success: true,
        message: 'Payments retrieved successfully',
        data: {
          payments,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            pages: Math.ceil(total / Number(limit))
          }
        }
      });
    } catch (error) {
      console.error('Get payments error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  getPaymentPrefillByTaskDone = async (req: Request, res: Response): Promise<void> => {
    try {
      const { taskDoneId } = req.params;
      const currentUserId = req.user?.id;
      const canViewAll = this.hasViewAllPermission(req);
      const canViewOwn = this.hasViewOwnPermission(req);

      const taskDone = await this.taskDoneRepository.findOne({
        where: { id: Number(taskDoneId) },
        relations: [
          'task',
          'task.mainCon',
          'task.statusSetting',
          'freelancer',
          'freelancer.profile'
        ]
      });

      if (!taskDone) {
        res.status(404).json({ success: false, message: 'Completed task not found' });
        return;
      }

      if (!canViewAll && canViewOwn && currentUserId) {
        const isOwner = Number(taskDone.freelancer_id) === Number(currentUserId)
          || Number(taskDone.task?.assigned_to) === Number(currentUserId);

        if (!isOwner) {
          res.status(403).json({
            success: false,
            message: 'Anda hanya boleh melihat data pembayaran tugasan anda sendiri'
          });
          return;
        }
      }

      const existingPayment = await this.paymentRepository.findOne({
        where: { task_done_id: Number(taskDoneId) }
      });

      res.json({
        success: true,
        message: 'Payment prefill retrieved successfully',
        data: {
          recipient: {
            name: this.normalizeText(taskDone.freelancer?.name),
            accountNumber: this.normalizeText(taskDone.freelancer?.profile?.bank_account_number),
            bankName: this.normalizeText(taskDone.freelancer?.profile?.bank_name),
            email: this.normalizeText(taskDone.freelancer?.profile?.payment_email || taskDone.freelancer?.email),
          },
          task: {
            taskDoneId: Number(taskDoneId),
            taskId: Number(taskDone.task?.id),
            logNumber: this.normalizeText(taskDone.task?.log_number),
            mainCon: this.normalizeText(taskDone.task?.mainCon?.name),
            title: this.normalizeText(taskDone.task?.title),
            deadline: taskDone.task?.deadline || null,
            amount: Number(taskDone.task?.offer_price || 0),
            status: this.normalizeText(taskDone.task?.statusSetting?.name),
          },
          existingPayment: existingPayment
            ? {
                id: existingPayment.id,
                status: existingPayment.status,
              }
            : null,
        }
      });
    } catch (error) {
      console.error('Get payment prefill error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  };

  getPaymentById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const currentUserId = req.user?.id;
      const canViewAll = this.hasViewAllPermission(req);
      const canViewOwn = this.hasViewOwnPermission(req);

      const payment = await this.paymentRepository.createQueryBuilder('payment')
        .leftJoinAndSelect('payment.task', 'task')
        .leftJoinAndSelect('task.mainCon', 'mainCon')
        .leftJoinAndSelect('task.statusSetting', 'statusSetting')
        .leftJoinAndSelect('payment.taskDone', 'taskDone')
        .leftJoinAndSelect('payment.freelancer', 'freelancer')
        .leftJoinAndSelect('payment.approver', 'approver')
        .leftJoinAndSelect('payment.payer', 'payer')
        .where('payment.id = :id', { id: Number(id) })
        .getOne();

      if (!payment) {
        res.status(404).json({ success: false, message: 'Payment not found' });
        return;
      }

      if (!canViewAll && canViewOwn && currentUserId) {
        const isOwner = Number(payment.freelancer_id) === Number(currentUserId)
          || Number(payment.task?.assigned_to) === Number(currentUserId);

        if (!isOwner) {
          res.status(403).json({
            success: false,
            message: 'Anda hanya boleh melihat pembayaran tugasan anda sendiri'
          });
          return;
        }
      }

      res.json({
        success: true,
        message: 'Payment retrieved successfully',
        data: { payment }
      });
    } catch (error) {
      console.error('Get payment by id error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  };

  createPayment = async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        task_done_id,
        recipient_name,
        recipient_account_number,
        recipient_bank_name,
        recipient_email,
        remarks,
      } = req.body;

      if (!task_done_id) {
        res.status(400).json({ success: false, message: 'task_done_id diperlukan' });
        return;
      }

      const cleanRecipientName = this.normalizeText(recipient_name);
      const cleanAccountNumber = this.normalizeText(recipient_account_number);
      const cleanBankName = this.normalizeText(recipient_bank_name);
      const cleanRecipientEmail = this.normalizeText(recipient_email);

      if (!cleanRecipientName || !cleanAccountNumber || !cleanBankName || !cleanRecipientEmail) {
        res.status(400).json({
          success: false,
          message: 'Maklumat penerima bayaran mesti lengkap (nama, no akaun, nama bank, email)'
        });
        return;
      }

      const taskDone = await this.taskDoneRepository.findOne({
        where: { id: Number(task_done_id) },
        relations: ['task', 'task.statusSetting', 'freelancer']
      });

      if (!taskDone) {
        res.status(404).json({ success: false, message: 'Completed task not found' });
        return;
      }

      const currentStatus = this.normalizeText(taskDone.task?.statusSetting?.name);
      if (currentStatus !== TaskStatus.BORANG_DISEMAK_PEMBAYARAN_TERTUNGGAK) {
        res.status(400).json({
          success: false,
          message: 'Bayaran hanya boleh dicipta selepas status Borang Disemak & Pembayaran Tertunggak'
        });
        return;
      }

      const existingPayment = await this.paymentRepository.findOne({
        where: { task_done_id: Number(task_done_id) }
      });

      if (existingPayment) {
        res.status(409).json({ success: false, message: 'Rekod pembayaran untuk tugasan ini telah wujud' });
        return;
      }

      const payment = this.paymentRepository.create({
        task_id: Number(taskDone.task_id),
        task_done_id: Number(task_done_id),
        freelancer_id: Number(taskDone.freelancer_id),
        amount: Number(taskDone.task?.offer_price || 0),
        status: PaymentStatus.MENUNGGU_KELULUSAN,
        recipient_name: cleanRecipientName,
        recipient_account_number: cleanAccountNumber,
        recipient_bank_name: cleanBankName,
        recipient_email: cleanRecipientEmail,
        remarks: this.normalizeText(remarks),
      });

      const saved = await this.paymentRepository.save(payment);

      const full = await this.paymentRepository.findOne({
        where: { id: saved.id },
        relations: ['task', 'task.mainCon', 'task.statusSetting', 'taskDone', 'freelancer', 'approver', 'payer']
      });

      res.status(201).json({
        success: true,
        message: 'Rekod pembayaran berjaya dicipta dengan status Menunggu Kelulusan',
        data: { payment: full }
      });
    } catch (error) {
      console.error('Create payment error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  };

  approvePayment = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const approverId = req.user?.id;

      if (!approverId) {
        res.status(401).json({ success: false, message: 'Authentication required' });
        return;
      }

      const payment = await this.paymentRepository.findOne({ where: { id: Number(id) } });

      if (!payment) {
        res.status(404).json({ success: false, message: 'Payment not found' });
        return;
      }

      if (payment.status !== PaymentStatus.MENUNGGU_KELULUSAN) {
        res.status(400).json({
          success: false,
          message: 'Payment hanya boleh diluluskan jika status Menunggu Kelulusan'
        });
        return;
      }

      await this.paymentRepository.update(Number(id), {
        status: PaymentStatus.DILULUSKAN,
        approved_by: approverId,
        approved_at: new Date(),
        updated_at: new Date()
      });

      const updatedPayment = await this.paymentRepository.findOne({
        where: { id: Number(id) },
        relations: ['task', 'taskDone', 'freelancer', 'approver', 'payer']
      });

      res.json({
        success: true,
        message: 'Payment berjaya diluluskan',
        data: { payment: updatedPayment }
      });
    } catch (error) {
      console.error('Approve payment error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  markPaymentAsPaid = async (req: Request, res: Response): Promise<void> => {
    const uploadedSlip = (req as any).file as Express.Multer.File | undefined;
    try {
      const { id } = req.params;
      const payerId = req.user?.id;
      const paymentReference = this.normalizeText((req.body as any)?.payment_reference || (req.body as any)?.reference);

      if (!payerId) {
        if (uploadedSlip) deleteUploadedFiles(uploadedSlip);
        res.status(401).json({ success: false, message: 'Authentication required' });
        return;
      }

      const payment = await this.paymentRepository.findOne({ where: { id: Number(id) } });

      if (!payment) {
        if (uploadedSlip) deleteUploadedFiles(uploadedSlip);
        res.status(404).json({ success: false, message: 'Payment not found' });
        return;
      }

      if (payment.status !== PaymentStatus.DILULUSKAN) {
        if (uploadedSlip) deleteUploadedFiles(uploadedSlip);
        res.status(400).json({
          success: false,
          message: 'Payment hanya boleh ditanda dibayar selepas diluluskan'
        });
        return;
      }

      if (!paymentReference) {
        if (uploadedSlip) deleteUploadedFiles(uploadedSlip);
        res.status(400).json({
          success: false,
          message: 'Reference pembayaran diperlukan'
        });
        return;
      }

      if (!uploadedSlip) {
        res.status(400).json({
          success: false,
          message: 'Slip pembayaran diperlukan (maks 2MB)'
        });
        return;
      }

      const slipInfo = getFileInfo(uploadedSlip);
      const paymentSlipUrl = '/' + slipInfo.relativePath.replace(/\\/g, '/');

      await this.paymentRepository.update(Number(id), {
        status: PaymentStatus.TELAH_DIBAYAR,
        paid_by: payerId,
        paid_at: new Date(),
        payment_reference: paymentReference,
        payment_slip_url: paymentSlipUrl,
        updated_at: new Date()
      });

      const paidStatusId = await this.resolveStatusId(TaskStatus.TELAH_DIBAYAR);
      await this.taskRepository.update(payment.task_id, {
        status_id: paidStatusId,
        payment_date: new Date(),
        updated_at: new Date()
      });

      const updatedPayment = await this.paymentRepository.findOne({
        where: { id: Number(id) },
        relations: ['task', 'taskDone', 'freelancer', 'approver', 'payer']
      });

      res.json({
        success: true,
        message: 'Payment berjaya ditanda sebagai telah dibayar',
        data: { payment: updatedPayment }
      });
    } catch (error) {
      if (uploadedSlip) deleteUploadedFiles(uploadedSlip);
      console.error('Mark payment as paid error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };
}
