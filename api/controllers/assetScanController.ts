import { Request, Response } from 'express';
import { AppDataSource } from '../config/database.ts';
import { Asset, AssetStatus } from '../models/Asset.ts';
import { AssetUser } from '../models/AssetUser.ts';
import { Masterlist } from '../models/Masterlist.ts';
import { AssetCategoryOption } from '../models/AssetCategoryOption.ts';
import { AssetBrandOption } from '../models/AssetBrandOption.ts';
import { SystemSettings } from '../models/SystemSettings.ts';
import { decrypt } from '../utils/encryption.ts';
import { In } from 'typeorm';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { AuditService } from '../services/auditService';

// ── Helper: ambil Gemini API key dari DB (sama seperti settings page guna) ──

async function getGeminiApiKey(): Promise<string | null> {
  try {
    if (!AppDataSource.isInitialized) return null;
    const repo = AppDataSource.getRepository(SystemSettings);
    const setting = await repo.findOne({ where: { setting_key: 'gemini_api_key', is_active: true } });
    if (!setting?.setting_value) return null;
    // Try decrypt (key stored encrypted), fallback to plain text
    return decrypt(setting.setting_value) ?? setting.setting_value;
  } catch {
    return null;
  }
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface ScanAssetItem {
  /** label provided by user e.g. "CPU", "Monitor" */
  label: string;
  /** Confirmed serial number (trimmed + uppercase by backend) */
  serial_number: string;
  name: string;
  model?: string;
  category?: string;
  brand?: string;
  status?: string;
  notes?: string;
  asset_tag?: string;
}

export interface ScanUserPayload {
  user_name: string;
  position?: string;
  floor?: string;
  building?: string;
  location?: string;
  branch?: string;
  state?: string;
}

export interface ScanUpsertRequest {
  masterlist_id: number;
  assets: ScanAssetItem[];
  user?: ScanUserPayload;
}

interface AssetScanResult {
  label: string;
  serial_number: string;
  action: 'created' | 'updated' | 'conflict' | 'error';
  asset_id?: number;
  conflict_masterlist?: string;
  error?: string;
}

// ── Controller ───────────────────────────────────────────────────────────────

export class AssetScanController {
  private assetRepository = AppDataSource.getRepository(Asset);
  private assetUserRepository = AppDataSource.getRepository(AssetUser);
  private masterlistRepository = AppDataSource.getRepository(Masterlist);
  private categoryRepository = AppDataSource.getRepository(AssetCategoryOption);
  private brandRepository = AppDataSource.getRepository(AssetBrandOption);

  private normalizeSN = (sn?: string): string => (sn || '').trim().toUpperCase();
  private normalizeStr = (s?: string): string => (s || '').trim().toUpperCase();

  private tryParseJson(text: string): any | null {
    const cleaned = String(text || '')
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    try {
      return JSON.parse(cleaned);
    } catch {
      const objectMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!objectMatch) return null;
      try {
        return JSON.parse(objectMatch[0]);
      } catch {
        return null;
      }
    }
  }

  private extractBestGuessSN(rawText?: string): string {
    const text = String(rawText || '').trim();
    if (!text) return '';

    const normalizedText = text.replace(/\r/g, '\n');
    const snLabelPattern = /(S\/?N|SN|SERIAL\s*(NO\.?|NUMBER)?)[^A-Z0-9]{0,8}([A-Z0-9-]{6,})/i;
    const labeledMatch = normalizedText.match(snLabelPattern);
    if (labeledMatch?.[3]) {
      return labeledMatch[3].toUpperCase().trim();
    }

    const candidates = normalizedText
      .split(/\s+/)
      .map((token) => token.replace(/[^A-Za-z0-9-]/g, ''))
      .filter((token) => /[A-Za-z]/.test(token) && /\d/.test(token) && token.length >= 5)
      .sort((a, b) => b.length - a.length);

    return (candidates[0] || '').toUpperCase();
  }

  // ── Gemini OCR ─────────────────────────────────────────────────────────────

  /**
   * POST /api/assets/scan/extract
   * Accepts: multipart/form-data with up to 5 image files (field name: "images")
   * Returns: array of { index, label, extractedSN, confidence, rawText }
   */
  extractSN = async (req: Request, res: Response): Promise<void> => {
    const apiKey = await getGeminiApiKey();

    if (!apiKey) {
      res.status(503).json({
        success: false,
        message: 'Gemini API key belum dikonfigurasi. Pergi ke Tetapan → Integrasi AI untuk tetapkan API key.'
      });
      return;
    }

    const files = (req.files as Express.Multer.File[]) || [];
    if (!files.length) {
      res.status(400).json({ success: false, message: 'Tiada fail gambar dihantar.' });
      return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const results: Array<{
      index: number;
      label: string;
      extractedSN: string;
      confidence: 'high' | 'medium' | 'low';
      rawText: string;
    }> = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const label = (Array.isArray(req.body?.labels)
        ? req.body.labels[i]
        : req.body?.labels) || `Aset ${i + 1}`;

      try {
        const imagePart = {
          inlineData: {
            data: file.buffer.toString('base64'),
            mimeType: file.mimetype as 'image/jpeg' | 'image/png' | 'image/webp'
          }
        };

        const prompt = `You are an asset management OCR assistant.
Look at this image and find the Serial Number (SN) on the label or sticker.
      The image may be rotated (90/180/270 degrees), blurry, partially blocked by cable/connector, or low contrast.
      You must still attempt the best possible read.
Serial numbers are usually labelled as "S/N", "SN", "Serial No", "Serial Number", or similar.
Respond ONLY with a JSON object in this exact format (no markdown, no explanation):
{
  "serial_number": "the exact serial number text",
  "confidence": "high" or "medium" or "low",
  "raw_text": "all text visible in the image"
}
      Important rules:
      - Even when confidence is "low", still return your best guess for serial_number if there is any plausible candidate.
      - Use empty serial_number "" only when the image is truly unreadable and no candidate can be guessed.`;

        const result = await model.generateContent([prompt, imagePart]);
        const responseText = result.response.text().trim();

        const parsed = this.tryParseJson(responseText);
        const extractedFromJson = String(parsed?.serial_number || '').trim().toUpperCase();
        const rawText = String(parsed?.raw_text || responseText || '');
        const fallbackSNFromRaw = this.extractBestGuessSN(rawText);
        const fallbackSNFromResponse = this.extractBestGuessSN(responseText);
        const finalSN = extractedFromJson || fallbackSNFromRaw || fallbackSNFromResponse;
        const confidence = parsed?.confidence || (finalSN ? 'low' : 'low');

        results.push({
          index: i,
          label: String(label),
          extractedSN: finalSN,
          confidence,
          rawText
        });

        await AuditService.log({
          req,
          actionType: 'SYSTEM',
          tableName: 'asset_scan_ocr',
          description: `Scan OCR ${String(label)}: ${finalSN ? 'SN dikesan' : 'SN tidak dikesan'}`,
          newValues: {
            label: String(label),
            fileName: file.originalname,
            mimeType: file.mimetype,
            confidence,
            extractedFromJson,
            fallbackSNFromRaw,
            fallbackSNFromResponse,
            finalSN,
            parsedAsJson: Boolean(parsed),
            rawTextPreview: rawText.slice(0, 500),
            responsePreview: responseText.slice(0, 500)
          }
        });
      } catch (err: any) {
        // If a single image fails, we still return partial results
        results.push({
          index: i,
          label: String(label),
          extractedSN: '',
          confidence: 'low',
          rawText: '',
        });

        await AuditService.log({
          req,
          actionType: 'SYSTEM',
          tableName: 'asset_scan_ocr',
          description: `Scan OCR ${String(label)} gagal`,
          newValues: {
            label: String(label),
            fileName: file.originalname,
            mimeType: file.mimetype,
            error: err?.message || 'Unknown OCR error'
          }
        });
      }
    }

    res.json({ success: true, data: results });
  };

  // ── Upsert Aset + Pengguna ─────────────────────────────────────────────────

  /**
   * POST /api/assets/scan/upsert
   * Body: ScanUpsertRequest
   * - Reuses same SN-based upsert/conflict logic as import controller
   * - Assigns the same user to ALL successfully upserted assets
   */
  upsertAssets = async (req: Request, res: Response): Promise<void> => {
    try {
      const body = req.body as ScanUpsertRequest;
      const { masterlist_id, assets, user } = body;

      if (!masterlist_id || !Array.isArray(assets) || assets.length === 0) {
        res.status(400).json({
          success: false,
          message: 'masterlist_id dan assets diperlukan.'
        });
        return;
      }

      const masterlist = await this.masterlistRepository.findOne({ where: { id: masterlist_id } });
      if (!masterlist) {
        res.status(404).json({ success: false, message: 'Masterlist tidak ditemui.' });
        return;
      }

      // Pre-cache categories + brands
      const allCategories = await this.categoryRepository.find();
      const allBrands = await this.brandRepository.find();
      const categoryMap = new Map(allCategories.map(c => [c.name.toLowerCase(), c]));
      const brandMap = new Map(allBrands.map(b => [b.name.toLowerCase(), b]));

      // Pre-load existing assets by normalized SN
      const serialNumbers = assets
        .map(a => this.normalizeSN(a.serial_number))
        .filter(Boolean);

      const existingBySerial = new Map<string, Asset[]>();
      if (serialNumbers.length > 0) {
        const existing = await this.assetRepository.find({
          where: { serial_number: In(serialNumbers) },
          relations: ['masterlist']
        });
        existing.forEach(asset => {
          const sn = this.normalizeSN(asset.serial_number);
          if (sn) {
            const list = existingBySerial.get(sn) || [];
            list.push(asset);
            existingBySerial.set(sn, list);
          }
        });
      }

      const scanResults: AssetScanResult[] = [];

      for (const item of assets) {
        const sn = this.normalizeSN(item.serial_number);

        if (!sn) {
          scanResults.push({
            label: item.label,
            serial_number: sn,
            action: 'error',
            error: 'Serial number kosong – tidak boleh simpan.'
          });
          continue;
        }

        if (!item.name?.trim()) {
          scanResults.push({
            label: item.label,
            serial_number: sn,
            action: 'error',
            error: 'Nama aset diperlukan.'
          });
          continue;
        }

        // Resolve category + brand
        let categoryId: number | null = null;
        if (item.category) {
          const cat = categoryMap.get(item.category.toLowerCase());
          if (!cat) {
            scanResults.push({
              label: item.label,
              serial_number: sn,
              action: 'error',
              error: `Kategori "${item.category}" tidak ditemui dalam sistem.`
            });
            continue;
          }
          categoryId = cat.id;
        }

        let brandId: number | null = null;
        if (item.brand) {
          const br = brandMap.get(item.brand.toLowerCase());
          if (!br) {
            scanResults.push({
              label: item.label,
              serial_number: sn,
              action: 'error',
              error: `Jenama "${item.brand}" tidak ditemui dalam sistem.`
            });
            continue;
          }
          brandId = br.id;
        }

        const existingList = existingBySerial.get(sn) || [];
        const sameMasterlist = existingList.find(a => a.masterlist_id === masterlist_id);
        const otherMasterlist = existingList.find(a => a.masterlist_id !== masterlist_id);

        try {
          let savedAsset: Asset;

          if (sameMasterlist) {
            // UPDATE existing asset in same masterlist
            sameMasterlist.asset_tag = item.asset_tag?.trim() || sameMasterlist.asset_tag;
            sameMasterlist.name = item.name.trim();
            sameMasterlist.category_id = categoryId;
            sameMasterlist.brand_id = brandId;
            sameMasterlist.model = item.model?.trim() || null;
            sameMasterlist.serial_number = sn;
            sameMasterlist.status = (item.status as AssetStatus) || sameMasterlist.status;
            sameMasterlist.notes = item.notes?.trim() || null;
            savedAsset = await this.assetRepository.save(sameMasterlist);
            scanResults.push({ label: item.label, serial_number: sn, action: 'updated', asset_id: savedAsset.id });
          } else if (otherMasterlist) {
            const conflictName = otherMasterlist.masterlist
              ? `${otherMasterlist.masterlist.code} – ${otherMasterlist.masterlist.name}`
              : `ID ${otherMasterlist.masterlist_id}`;
            scanResults.push({
              label: item.label,
              serial_number: sn,
              action: 'conflict',
              conflict_masterlist: conflictName
            });
            continue;
          } else {
            // CREATE new asset
            const newAsset = this.assetRepository.create({
              masterlist_id,
              asset_tag: item.asset_tag?.trim() || undefined,
              name: item.name.trim(),
              category_id: categoryId,
              brand_id: brandId,
              model: item.model?.trim() || undefined,
              serial_number: sn,
              status: (item.status as AssetStatus) || AssetStatus.AKTIF,
              notes: item.notes?.trim() || undefined,
              created_by: req.user?.id
            });
            savedAsset = await this.assetRepository.save(newAsset);
            scanResults.push({ label: item.label, serial_number: sn, action: 'created', asset_id: savedAsset.id });
          }

          // Assign user to the asset (if provided)
          if (user?.user_name?.trim() && savedAsset!) {
            const userName = this.normalizeStr(user.user_name);
            const existingUser = await this.assetUserRepository.findOne({
              where: { asset_id: savedAsset.id, user_name: userName }
            });
            if (!existingUser) {
              const assetUser = this.assetUserRepository.create({
                asset_id: savedAsset.id,
                user_name: userName,
                position: user.position?.trim() || null,
                floor: user.floor?.trim() || null,
                building: user.building?.trim() || null,
                location: user.location?.trim() || null,
                branch: user.branch?.trim() || null,
                state: user.state?.trim() || null
              });
              await this.assetUserRepository.save(assetUser);
            }
          }
        } catch (err: any) {
          scanResults.push({
            label: item.label,
            serial_number: sn,
            action: 'error',
            error: err?.message || 'Ralat semasa menyimpan aset.'
          });
        }
      }

      const createdCount = scanResults.filter(r => r.action === 'created').length;
      const updatedCount = scanResults.filter(r => r.action === 'updated').length;
      const conflictCount = scanResults.filter(r => r.action === 'conflict').length;
      const errorCount = scanResults.filter(r => r.action === 'error').length;

      res.json({
        success: true,
        data: {
          results: scanResults,
          summary: { createdCount, updatedCount, conflictCount, errorCount }
        }
      });
    } catch (error: any) {
      console.error('Asset scan upsert error:', error);
      res.status(500).json({ success: false, message: 'Ralat pelayan semasa simpan aset scan.' });
    }
  };
}
