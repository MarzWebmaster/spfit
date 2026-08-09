import { Router } from 'express';
import { AITaskAssistantController } from '../controllers/aiTaskAssistantController.ts';
import { authenticateToken, requireAnyPermission } from '../middleware/auth.ts';
import { uploadMemory } from '../middleware/upload.ts';

const router = Router();
const controller = new AITaskAssistantController();

router.post('/chat',
  authenticateToken,
  requireAnyPermission(['tasks:create', 'ai:task:view']),
  uploadMemory.array('files', 5),
  controller.chat
);

export default router;