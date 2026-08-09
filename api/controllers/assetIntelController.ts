import { Request, Response } from 'express';
import { inferAndCacheModelIntel } from '../services/assetModelIntelService.ts';

export class AssetIntelController {
  suggest = async (req: Request, res: Response): Promise<void> => {
    try {
      const model = typeof req.query.model === 'string' ? req.query.model : '';
      const serial = typeof req.query.serial === 'string' ? req.query.serial : '';
      const allowInternet = String(req.query.allow_internet ?? 'true').toLowerCase() !== 'false';
      const allowAi = String(req.query.allow_ai ?? 'true').toLowerCase() !== 'false';

      const intel = await inferAndCacheModelIntel({
        model,
        serial,
        allowInternet,
        allowAi
      });

      if (!intel) {
        res.json({ success: true, data: { found: false } });
        return;
      }

      res.json({ success: true, data: { found: true, intel } });
    } catch (error: any) {
      res.status(500).json({ success: false, message: 'Gagal dapatkan cadangan AI untuk model aset.', error: error?.message });
    }
  };
}

