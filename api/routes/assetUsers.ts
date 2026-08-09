import { Router } from 'express';
import { createAssetUser, getAssetUsers, getAssetUser, updateAssetUser, deleteAssetUser } from '../controllers/assetUserController.ts';
import { authenticateToken } from '../middleware/auth.ts';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * POST /api/asset-users - Create new asset user
 */
router.post('/', createAssetUser);

/**
 * GET /api/asset-users/:asset_id - Get all users for an asset
 */
router.get('/asset/:asset_id', getAssetUsers);

/**
 * GET /api/asset-users/:id - Get single asset user
 */
router.get('/:id', getAssetUser);

/**
 * PUT /api/asset-users/:id - Update asset user
 */
router.put('/:id', updateAssetUser);

/**
 * DELETE /api/asset-users/:id - Delete asset user
 */
router.delete('/:id', deleteAssetUser);

export default router;
