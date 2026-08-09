
import { Router, Request, Response } from 'express';
import { AppDataSource } from '../config/database.ts';
import { Task, TaskStatus } from '../models/Task.ts';
import { TaskStatusOption } from '../models/TaskStatusOption.ts';
import { TaskOffer } from '../models/TaskOffer.ts';
import { TaskWaitingList } from '../models/TaskWaitingList.ts';
import crypto from 'crypto';
import { authenticateToken, requirePermission } from '../middleware/auth.ts';

const router = Router();

// Generate offer token and create offer record
router.post('/generate', authenticateToken, requirePermission('tasks:assign'), async (req: Request, res: Response) => {
  try {
    const { taskId, freelancerIds } = req.body;

    if (!taskId || !Array.isArray(freelancerIds) || freelancerIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Task ID and freelancer IDs are required'
      });
    }

    const taskOfferRepository = AppDataSource.getRepository(TaskOffer);
    const offers: any[] = [];

    // Create offers for each freelancer with unique tokens
    for (const freelancerId of freelancerIds) {
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // Expire after 7 days

      const offer = taskOfferRepository.create({
        task_id: taskId,
        freelancer_id: freelancerId,
        token,
        status: 'pending',
        expires_at: expiresAt
      });

      await taskOfferRepository.save(offer);
      offers.push({
        freelancerId,
        token,
        acceptLink: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/api/offers/accept/${token}`,
        rejectLink: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/api/offers/reject/${token}`
      });
    }

    res.json({
      success: true,
      data: { offers }
    });
  } catch (error: any) {
    console.error('Error generating offer tokens:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate offer tokens'
    });
  }
});

// Get offers for a task
router.get('/task/:taskId', authenticateToken, requirePermission('tasks:assign'), async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;

    const taskOfferRepository = AppDataSource.getRepository(TaskOffer);

    const offers = await taskOfferRepository.find({
      where: { task_id: parseInt(taskId) },
      relations: ['freelancer'],
      order: { created_at: 'DESC' }
    });

    res.json({
      success: true,
      data: {
        offers: offers.map(offer => ({
          id: offer.id,
          freelancer: {
            id: offer.freelancer.id,
            name: offer.freelancer.name,
            email: offer.freelancer.email,
            phone: offer.freelancer.phone
          },
          status: offer.status,
          expiresAt: offer.expires_at,
          respondedAt: offer.responded_at,
          sentAt: offer.created_at
        }))
      }
    });
  } catch (error: any) {
    console.error('Error fetching task offers:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Gagal mengambil senarai tawaran'
    });
  }
});

// Accept offer (first-come-first-served or waiting list)
router.get('/accept/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    const taskOfferRepository = AppDataSource.getRepository(TaskOffer);
    const taskRepository = AppDataSource.getRepository(Task);
    const taskStatusRepository = AppDataSource.getRepository(TaskStatusOption);
    const waitingListRepository = AppDataSource.getRepository(TaskWaitingList);

    // Find the offer
    const offer = await taskOfferRepository.findOne({
      where: { token },
      relations: ['task', 'freelancer']
    });

    if (!offer) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Tawaran Tidak Dijumpai</title>
          <style>
            body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f3f4f6; }
            .container { background: white; padding: 2rem; border-radius: 0.5rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center; max-width: 400px; }
            .icon { font-size: 3rem; margin-bottom: 1rem; }
            h1 { color: #dc2626; font-size: 1.5rem; margin-bottom: 0.5rem; }
            p { color: #6b7280; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">❌</div>
            <h1>Tawaran Tidak Dijumpai</h1>
            <p>Tawaran ini tidak dijumpai atau telah tamat tempoh.</p>
          </div>
        </body>
        </html>
      `);
    }

    // Check if expired
    if (new Date() > offer.expires_at) {
      offer.status = 'expired';
      await taskOfferRepository.save(offer);
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Tawaran Tamat Tempoh</title>
          <style>
            body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f3f4f6; }
            .container { background: white; padding: 2rem; border-radius: 0.5rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center; max-width: 400px; }
            .icon { font-size: 3rem; margin-bottom: 1rem; }
            h1 { color: #f59e0b; font-size: 1.5rem; margin-bottom: 0.5rem; }
            p { color: #6b7280; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">⏰</div>
            <h1>Tawaran Tamat Tempoh</h1>
            <p>Tawaran ini telah tamat tempoh.</p>
          </div>
        </body>
        </html>
      `);
    }

    // Check if already responded
    if (offer.status !== 'pending') {
      const statusText = offer.status === 'accepted' ? 'diterima' : 'ditolak';
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Tawaran Sudah Diproses</title>
          <style>
            body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f3f4f6; }
            .container { background: white; padding: 2rem; border-radius: 0.5rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center; max-width: 400px; }
            .icon { font-size: 3rem; margin-bottom: 1rem; }
            h1 { color: #6b7280; font-size: 1.5rem; margin-bottom: 0.5rem; }
            p { color: #6b7280; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">ℹ️</div>
            <h1>Tawaran Sudah Diproses</h1>
            <p>Tawaran ini telah ${statusText}.</p>
          </div>
        </body>
        </html>
      `);
    }

    // Get the task
    const task = await taskRepository.findOne({
      where: { id: offer.task_id },
      relations: ['statusSetting']
    });

    if (!task) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Tugasan Tidak Dijumpai</title>
          <style>
            body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f3f4f6; }
            .container { background: white; padding: 2rem; border-radius: 0.5rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center; max-width: 400px; }
            .icon { font-size: 3rem; margin-bottom: 1rem; }
            h1 { color: #dc2626; font-size: 1.5rem; margin-bottom: 0.5rem; }
            p { color: #6b7280; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">❌</div>
            <h1>Tugasan Tidak Dijumpai</h1>
            <p>Tugasan tidak dijumpai.</p>
          </div>
        </body>
        </html>
      `);
    }

    // Check if task is already assigned
    if (task.assigned_to && task.statusSetting?.name === TaskStatus.TELAH_DIAMBIL) {
      // Add to waiting list
      const waitingListCount = await waitingListRepository.count({
        where: { task_id: task.id }
      });

      const waitingEntry = waitingListRepository.create({
        task_id: task.id,
        freelancer_id: offer.freelancer_id,
        position: waitingListCount + 1
      });

      await waitingListRepository.save(waitingEntry);

      offer.status = 'accepted';
      offer.responded_at = new Date();
      await taskOfferRepository.save(offer);

      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Ditambah ke Senarai Menunggu</title>
          <style>
            body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f3f4f6; }
            .container { background: white; padding: 2rem; border-radius: 0.5rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center; max-width: 400px; }
            .icon { font-size: 3rem; margin-bottom: 1rem; }
            h1 { color: #f59e0b; font-size: 1.5rem; margin-bottom: 0.5rem; }
            p { color: #6b7280; line-height: 1.6; }
            .position { background: #fef3c7; color: #92400e; padding: 0.5rem 1rem; border-radius: 0.25rem; font-weight: bold; margin-top: 1rem; display: inline-block; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">⏳</div>
            <h1>Ditambah ke Senarai Menunggu</h1>
            <p>Tugasan ini telah diambil oleh freelancer lain. Anda telah ditambah ke senarai menunggu.</p>
            <div class="position">Kedudukan: ${waitingListCount + 1}</div>
          </div>
        </body>
        </html>
      `);
    }

    // Assign task (first-come-first-served)
    const takenStatus = await taskStatusRepository.findOne({ where: { name: TaskStatus.TELAH_DIAMBIL, is_active: true } });
    if (!takenStatus) {
      return res.status(400).send('Status Telah Diambil tidak ditemui dalam tetapan tugasan');
    }

    task.assigned_to = offer.freelancer_id;
    task.status_id = takenStatus.id;
    await taskRepository.save(task);

    offer.status = 'accepted';
    offer.responded_at = new Date();
    await taskOfferRepository.save(offer);

    // Mark other pending offers for this task as expired
    await taskOfferRepository
      .createQueryBuilder()
      .update(TaskOffer)
      .set({ status: 'expired' })
      .where('task_id = :taskId', { taskId: task.id })
      .andWhere('status = :status', { status: 'pending' })
      .andWhere('id != :offerId', { offerId: offer.id })
      .execute();

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Tawaran Diterima</title>
        <style>
          body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f3f4f6; }
          .container { background: white; padding: 2rem; border-radius: 0.5rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center; max-width: 400px; }
          .icon { font-size: 3rem; margin-bottom: 1rem; }
          h1 { color: #10b981; font-size: 1.5rem; margin-bottom: 0.5rem; }
          p { color: #6b7280; line-height: 1.6; }
          .task-info { background: #f9fafb; padding: 1rem; border-radius: 0.25rem; margin-top: 1rem; text-align: left; }
          .task-info div { margin: 0.5rem 0; }
          .label { font-weight: bold; color: #374151; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">✅</div>
          <h1>Tawaran Diterima!</h1>
          <p>Tugasan telah berjaya diagihkan kepada anda.</p>
          <div class="task-info">
            <div><span class="label">Tugasan:</span> ${task.title}</div>
            <div><span class="label">No. Log:</span> ${task.log_number}</div>
            <div><span class="label">Lokasi:</span> ${task.client_location}</div>
          </div>
        </div>
      </body>
      </html>
    `);
  } catch (error: any) {
    console.error('Error accepting offer:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Ralat</title>
        <style>
          body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f3f4f6; }
          .container { background: white; padding: 2rem; border-radius: 0.5rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center; max-width: 400px; }
          .icon { font-size: 3rem; margin-bottom: 1rem; }
          h1 { color: #dc2626; font-size: 1.5rem; margin-bottom: 0.5rem; }
          p { color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">⚠️</div>
          <h1>Ralat</h1>
          <p>Gagal memproses tawaran. Sila cuba lagi atau hubungi pentadbir.</p>
        </div>
      </body>
      </html>
    `);
  }
});

// Reject offer
router.get('/reject/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    const taskOfferRepository = AppDataSource.getRepository(TaskOffer);

    const offer = await taskOfferRepository.findOne({
      where: { token }
    });

    if (!offer) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Tawaran Tidak Dijumpai</title>
          <style>
            body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f3f4f6; }
            .container { background: white; padding: 2rem; border-radius: 0.5rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center; max-width: 400px; }
            .icon { font-size: 3rem; margin-bottom: 1rem; }
            h1 { color: #dc2626; font-size: 1.5rem; margin-bottom: 0.5rem; }
            p { color: #6b7280; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">❌</div>
            <h1>Tawaran Tidak Dijumpai</h1>
            <p>Tawaran tidak dijumpai.</p>
          </div>
        </body>
        </html>
      `);
    }

    // Check if expired
    if (new Date() > offer.expires_at) {
      offer.status = 'expired';
      await taskOfferRepository.save(offer);
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Tawaran Tamat Tempoh</title>
          <style>
            body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f3f4f6; }
            .container { background: white; padding: 2rem; border-radius: 0.5rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center; max-width: 400px; }
            .icon { font-size: 3rem; margin-bottom: 1rem; }
            h1 { color: #f59e0b; font-size: 1.5rem; margin-bottom: 0.5rem; }
            p { color: #6b7280; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">⏰</div>
            <h1>Tawaran Tamat Tempoh</h1>
            <p>Tawaran ini telah tamat tempoh.</p>
          </div>
        </body>
        </html>
      `);
    }

    // Check if already responded
    if (offer.status !== 'pending') {
      const statusText = offer.status === 'accepted' ? 'diterima' : 'ditolak';
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Tawaran Sudah Diproses</title>
          <style>
            body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f3f4f6; }
            .container { background: white; padding: 2rem; border-radius: 0.5rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center; max-width: 400px; }
            .icon { font-size: 3rem; margin-bottom: 1rem; }
            h1 { color: #6b7280; font-size: 1.5rem; margin-bottom: 0.5rem; }
            p { color: #6b7280; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">ℹ️</div>
            <h1>Tawaran Sudah Diproses</h1>
            <p>Tawaran ini telah ${statusText}.</p>
          </div>
        </body>
        </html>
      `);
    }

    offer.status = 'rejected';
    offer.responded_at = new Date();
    await taskOfferRepository.save(offer);

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Tawaran Ditolak</title>
        <style>
          body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f3f4f6; }
          .container { background: white; padding: 2rem; border-radius: 0.5rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center; max-width: 400px; }
          .icon { font-size: 3rem; margin-bottom: 1rem; }
          h1 { color: #6b7280; font-size: 1.5rem; margin-bottom: 0.5rem; }
          p { color: #6b7280; line-height: 1.6; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">👋</div>
          <h1>Tawaran Ditolak</h1>
          <p>Terima kasih atas maklum balas anda. Tawaran telah ditolak.</p>
        </div>
      </body>
      </html>
    `);
  } catch (error: any) {
    console.error('Error rejecting offer:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Ralat</title>
        <style>
          body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f3f4f6; }
          .container { background: white; padding: 2rem; border-radius: 0.5rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center; max-width: 400px; }
          .icon { font-size: 3rem; margin-bottom: 1rem; }
          h1 { color: #dc2626; font-size: 1.5rem; margin-bottom: 0.5rem; }
          p { color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">⚠️</div>
          <h1>Ralat</h1>
          <p>Gagal memproses tawaran. Sila cuba lagi atau hubungi pentadbir.</p>
        </div>
      </body>
      </html>
    `);
  }
});

// Get waiting list for a task
router.get('/waiting-list/:taskId', authenticateToken, requirePermission('tasks:assign'), async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;

    const waitingListRepository = AppDataSource.getRepository(TaskWaitingList);

    const waitingList = await waitingListRepository.find({
      where: { task_id: parseInt(taskId) },
      relations: ['freelancer'],
      order: { position: 'ASC' }
    });

    res.json({
      success: true,
      data: {
        waitingList: waitingList.map(entry => ({
          id: entry.id,
          position: entry.position,
          freelancer: {
            id: entry.freelancer.id,
            name: entry.freelancer.name,
            email: entry.freelancer.email
          },
          createdAt: entry.created_at
        }))
      }
    });
  } catch (error: any) {
    console.error('Error fetching waiting list:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Gagal mengambil senarai menunggu'
    });
  }
});

export default router;
