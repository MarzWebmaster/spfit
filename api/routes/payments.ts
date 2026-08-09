import { Router, Request, Response } from 'express';
import { PaymentController } from '../controllers/paymentController.ts';
import { authenticateToken, requireAnyPermission, requirePermission } from '../middleware/auth.ts';
import { uploadPaymentSlip } from '../middleware/upload.ts';

const router = Router();
const paymentController = new PaymentController();

router.get('/',
  authenticateToken,
  requireAnyPermission(['payments:view:all', 'payments:view:own', 'payments:approve', 'payments:mark_paid', 'tasks:view:all', 'tasks:view:own', 'tasks:view:assigned']),
  (req: Request, res: Response) => paymentController.getAllPayments(req, res)
);

router.get('/prefill/:taskDoneId',
  authenticateToken,
  requireAnyPermission(['payments:view:all', 'payments:view:own', 'tasks:manage_completed_form', 'payments:approve', 'payments:mark_paid', 'tasks:view:all', 'tasks:view:own', 'tasks:view:assigned']),
  (req: Request, res: Response) => paymentController.getPaymentPrefillByTaskDone(req, res)
);

router.get('/:id',
  authenticateToken,
  requireAnyPermission(['payments:view:all', 'payments:view:own', 'payments:approve', 'payments:mark_paid', 'tasks:view:all', 'tasks:view:own', 'tasks:view:assigned']),
  (req: Request, res: Response) => paymentController.getPaymentById(req, res)
);

router.post('/',
  authenticateToken,
  requireAnyPermission(['tasks:manage_completed_form', 'payments:approve', 'payments:mark_paid']),
  (req: Request, res: Response) => paymentController.createPayment(req, res)
);

router.patch('/:id/approve',
  authenticateToken,
  requirePermission('payments:approve'),
  (req: Request, res: Response) => paymentController.approvePayment(req, res)
);

router.patch('/:id/mark-paid',
  authenticateToken,
  requirePermission('payments:mark_paid'),
  uploadPaymentSlip.single('payment_slip'),
  (req: Request, res: Response) => paymentController.markPaymentAsPaid(req, res)
);

export default router;
