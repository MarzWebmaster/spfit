import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { AppDataSource } from '../config/database.ts';
import { ApiKey } from '../models/ApiKey.ts';
import { authenticateToken, requirePermission } from '../middleware/auth.ts';

const router = Router();
const apiKeyRepository = AppDataSource.getRepository(ApiKey);

const KEY_PREFIX = 'spfit_';

function generateApiKey(): { raw: string; hash: string; prefix: string } {
  const randomBytes = crypto.randomBytes(24).toString('hex');
  const raw = `${KEY_PREFIX}${randomBytes}`;
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  const prefix = raw.substring(0, 12);
  return { raw, hash, prefix };
}

function hashApiKey(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

// GET /api-keys — list all API keys (never expose the raw key)
router.get('/', authenticateToken, requirePermission('settings:manage:api'), async (req: Request, res: Response) => {
  try {
    const keys = await apiKeyRepository.find({
      relations: ['creator'],
      select: {
        creator: { id: true, name: true }
      },
      order: { created_at: 'DESC' }
    });

    const sanitized = keys.map(k => ({
      id: k.id,
      name: k.name,
      key_prefix: k.key_prefix,
      status: k.status,
      last_used_at: k.last_used_at,
      expires_at: k.expires_at,
      created_at: k.created_at,
      created_by: k.created_by,
      creator: k.creator ? { id: k.creator.id, name: k.creator.name } : null
    }));

    res.json({ success: true, data: sanitized });
  } catch (error: any) {
    console.error('Error listing API keys:', error);
    res.status(500).json({ success: false, message: 'Ralat semasa mengambil kunci API' });
  }
});

// POST /api-keys — create a new API key (returns the raw key ONCE)
router.post('/', authenticateToken, requirePermission('settings:manage:api'), async (req: Request, res: Response) => {
  try {
    const { name } = req.body as { name?: string };
    if (!name || !name.trim()) {
      res.status(400).json({ success: false, message: 'Nama kunci API diperlukan' });
      return;
    }

    const { raw, hash, prefix } = generateApiKey();

    const apiKey = apiKeyRepository.create({
      name: name.trim(),
      key_hash: hash,
      key_prefix: prefix,
      status: 'active',
      created_by: req.user?.id || null
    });

    const saved = await apiKeyRepository.save(apiKey);

    res.status(201).json({
      success: true,
      message: 'Kunci API berjaya dicipta',
      data: {
        id: saved.id,
        name: saved.name,
        key: raw,
        key_prefix: saved.key_prefix,
        status: saved.status,
        created_at: saved.created_at
      }
    });
  } catch (error: any) {
    console.error('Error creating API key:', error);
    res.status(500).json({ success: false, message: 'Ralat semasa mencipta kunci API' });
  }
});

// PATCH /api-keys/:id/revoke — revoke a key
router.patch('/:id/revoke', authenticateToken, requirePermission('settings:manage:api'), async (req: Request, res: Response) => {
  try {
    const keyId = Number(req.params.id);
    const apiKey = await apiKeyRepository.findOne({ where: { id: keyId } });
    if (!apiKey) {
      res.status(404).json({ success: false, message: 'Kunci API tidak ditemui' });
      return;
    }
    if (apiKey.status === 'revoked') {
      res.status(400).json({ success: false, message: 'Kunci API sudah dibatalkan' });
      return;
    }

    apiKey.status = 'revoked';
    await apiKeyRepository.save(apiKey);

    res.json({ success: true, message: 'Kunci API berjaya dibatalkan', data: { id: keyId, status: 'revoked' } });
  } catch (error: any) {
    console.error('Error revoking API key:', error);
    res.status(500).json({ success: false, message: 'Ralat semasa membatalkan kunci API' });
  }
});

// DELETE /api-keys/:id — permanently delete a key
router.delete('/:id', authenticateToken, requirePermission('settings:manage:api'), async (req: Request, res: Response) => {
  try {
    const keyId = Number(req.params.id);
    const apiKey = await apiKeyRepository.findOne({ where: { id: keyId } });
    if (!apiKey) {
      res.status(404).json({ success: false, message: 'Kunci API tidak ditemui' });
      return;
    }

    await apiKeyRepository.remove(apiKey);

    res.json({ success: true, message: 'Kunci API berjaya dipadam', data: { id: keyId } });
  } catch (error: any) {
    console.error('Error deleting API key:', error);
    res.status(500).json({ success: false, message: 'Ralat semasa memadam kunci API' });
  }
});

export default router;
