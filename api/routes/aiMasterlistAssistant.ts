import { Router } from 'express';
import { AIMasterlistAssistantController } from '../controllers/aiMasterlistAssistantController.ts';
import { authenticateToken, requireAnyPermission } from '../middleware/auth.ts';
import { uploadMemory, uploadAssetAttachment, uploadPDF } from '../middleware/upload.ts';

const router = Router();
const controller = new AIMasterlistAssistantController();

router.post(
  '/chat',
  authenticateToken,
  requireAnyPermission(['tasks:create', 'ai:masterlist:view']),
  uploadMemory.array('files', 10),
  controller.chat
);

router.post(
  '/process-pdf',
  authenticateToken,
  requireAnyPermission(['tasks:create', 'ai:masterlist:view']),
  uploadPDF.single('pdf'),
  controller.processPdf
);

router.post(
  '/apply',
  authenticateToken,
  requireAnyPermission(['tasks:create', 'ai:masterlist:view']),
  uploadAssetAttachment.array('attachments', 10),
  controller.apply
);

export default router;

