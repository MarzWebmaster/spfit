import { Router, Request, Response } from 'express';
import { TaskDoneController } from '../controllers/taskDoneController.ts';
import { authenticateToken, requirePermission, requireAnyPermission } from '../middleware/auth.ts';
import { uploadTaskReport } from '../middleware/upload.ts';

const router = Router();
const taskDoneController = new TaskDoneController();

// Get all completed task submissions (Tugasan Siap) - All authenticated users can view
router.get('/',
  authenticateToken,
  requireAnyPermission(['tasks:view:all', 'tasks:view:assigned']),
  (req: Request, res: Response) => taskDoneController.getAllCompletedTasks(req, res)
);

// Get completed tasks for a specific freelancer
router.get('/freelancer/:freelancer_id',
  authenticateToken,
  requireAnyPermission(['tasks:view:all', 'tasks:view:assigned']),
  (req: Request, res: Response) => taskDoneController.getFreelancerCompletedTasks(req, res)
);

// Get specific completed task submission by ID
router.get('/:id',
  authenticateToken,
  requireAnyPermission(['tasks:view:all', 'tasks:view:assigned']),
  requirePermission('tasks:manage_completed_form'),
  (req: Request, res: Response) => taskDoneController.getCompletedTaskById(req, res)
);

// Create completed task submission (after task submission)
router.post('/',
  authenticateToken,
  requirePermission('tasks:submit_report'),
  uploadTaskReport.array('support_pdf', 10),
  (req: Request, res: Response) => taskDoneController.createCompletedTask(req, res)
);

// Update completed task submission by ID
router.put('/:id',
  authenticateToken,
  requireAnyPermission(['tasks:submit_report', 'tasks:edit:all']),
  requirePermission('tasks:manage_completed_form'),
  uploadTaskReport.array('support_pdf', 10),
  (req: Request, res: Response) => taskDoneController.updateCompletedTask(req, res)
);

// Submit completed task (save + enforce PDF + set task status to Selesai)
router.put('/:id/submit',
  authenticateToken,
  requireAnyPermission(['tasks:submit_report', 'tasks:edit:all']),
  requirePermission('tasks:manage_completed_form'),
  uploadTaskReport.array('support_pdf', 10),
  (req: Request, res: Response) => taskDoneController.submitCompletedTask(req, res)
);

// Mark completed task form as reviewed and create payment record
router.patch('/:id/reviewed',
  authenticateToken,
  requireAnyPermission(['tasks:edit:all', 'payments:approve']),
  requirePermission('tasks:manage_completed_form'),
  uploadTaskReport.array('support_pdf', 10),
  (req: Request, res: Response) => taskDoneController.markCompletedTaskReviewed(req, res)
);

router.delete('/:id/files/:fileId',
  authenticateToken,
  requireAnyPermission(['tasks:edit:all', 'payments:approve']),
  requirePermission('tasks:manage_completed_form'),
  (req: Request, res: Response) => taskDoneController.deleteCompletedTaskFile(req, res)
);

export default router;
