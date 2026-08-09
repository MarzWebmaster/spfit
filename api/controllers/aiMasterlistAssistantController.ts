import { Request, Response } from 'express';
import axios from 'axios';
import { AppDataSource } from '../config/database.ts';
import { SystemSettings } from '../models/SystemSettings.ts';
import { Asset, AssetStatus } from '../models/Asset.ts';
import { AssetUser } from '../models/AssetUser.ts';
import { AssetAccessory } from '../models/AssetAccessory.ts';
import { AssetAttachment } from '../models/AssetAttachment.ts';
import { AssetPairingHistory } from '../models/AssetPairingHistory.ts';
import { AssetUpdateLog } from '../models/AssetUpdateLog.ts';
import { decrypt } from '../utils/encryption.ts';
import { getFileInfo } from '../middleware/upload.ts';
import { inferAndCacheModelIntel } from '../services/assetModelIntelService.ts';
import { detectAiCapability } from '../services/aiDetector.ts';
import { ILike } from 'typeorm';
import { spawn } from 'child_process';
import path from 'path';

import fs from 'fs';
import sharp from 'sharp';



// ESM shim for __dirname
const __dirname = import.meta.dirname;

const GEMINI_API_URL = process.env.GEMINI_API_URL || 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_GEMINI_MODEL = (process.env.GEMINI_MODEL || 'gemini-2.5-flash').replace(/^models\//, '');

export interface AssetUpdateDraft {
  // Asset identification (for lookup)
  serial_number?: string;
  asset_tag?: string;
  // Asset metadata from image
  asset_name?: string;
  brand?: string;
  model?: string;
  // User assignment info from form
  user_name?: string;
  position?: string;
  department?: string;
  floor?: string;
  building?: string;
  location?: string;
  branch?: string;
  state?: string;
  // Remarks / notes from form (catatan tambahan, kerosakan, arahan khas)
  notes?: string;
  // Custom fields (JSON object for additional metadata)
  custom_fields_values?: Record<string, any>;
  // Complementary accessories (Monitor, Keyboard, Mouse, etc)
  accessories?: Array<{
    type: 'monitor' | 'keyboard' | 'mouse' | 'other';
    serial_number?: string;
    name?: string;
    brand?: string;
    model?: string;
  }>;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const MASTERLIST_DRAFT_KEYS: Array<keyof AssetUpdateDraft> = [
  'serial_number',
  'asset_tag',
  'asset_name',
  'brand',
  'model',
  'user_name',
  'position',
  'department',
  'floor',
  'building',
  'location',
  'branch',
  'state',
  'notes',
  'custom_fields_values',
  'accessories'
];

const INLINE_FILE_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
]);
const TEXT_FILE_MIME_TYPES = new Set([
  'text/plain', 'text/csv', 'application/json', 'application/xml', 'text/xml',
  'text/html', 'text/markdown', 'text/tab-separated-values', 'application/rtf',
  'application/x-yaml', 'text/yaml', 'text/x-log'
]);
const INLINE_FILE_EXTENSIONS = new Set([
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.jpg', '.jpeg', '.png', '.gif', '.webp'
]);
const TEXT_FILE_EXTENSIONS = new Set(['.txt', '.csv', '.tsv', '.json', '.xml', '.md', '.html', '.rtf', '.yaml', '.yml', '.log', '.ini']);

function getFileExtension(filename: string): string {
  const lower = String(filename || '').toLowerCase();
  const i = lower.lastIndexOf('.');
  return i >= 0 ? lower.slice(i) : '';
}

function getBestEffortText(buffer: Buffer, maxChars = 15000): string {
  const sanitize = (t: string) =>
    t.replace(/\u0000/g, ' ').replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, ' ')
      .replace(/\s+/g, ' ').trim().slice(0, maxChars);
  const u = sanitize(buffer.toString('utf8'));
  if (u.length >= 80) return u;
  return sanitize(buffer.toString('latin1'));
}

function extractJsonObject(raw: string): any {
  const stripped = String(raw || '').trim()
    .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();

  try { return JSON.parse(stripped); } catch {}

  const greedy = stripped.match(/\{[\s\S]*\}/);
  if (greedy) { try { return JSON.parse(greedy[0]); } catch {} }

  for (let i = 0; i < stripped.length; i++) {
    if (stripped[i] !== '{') continue;
    let depth = 0, inStr = false, esc = false;
    for (let j = i; j < stripped.length; j++) {
      const ch = stripped[j];
      if (esc) { esc = false; continue; }
      if (ch === '\\' && inStr) { esc = true; continue; }
      if (ch === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (ch === '{') depth++;
      else if (ch === '}') {
        if (--depth === 0) {
          try { return JSON.parse(stripped.slice(i, j + 1)); } catch {} break;
        }
      }
    }
  }
  return null;
}

function normalizeString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function normalizeUpper(v: unknown): string {
  return normalizeString(v).toUpperCase();
}

function parseJsonField<T>(v: unknown, fallback: T): T {
  if (typeof v !== 'string' || !v.trim()) return fallback;
  try { return JSON.parse(v) as T; } catch { return fallback; }
}

function sanitizeMasterlistDraft(item: any): AssetUpdateDraft {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return {};

  const safe: AssetUpdateDraft = {};
  for (const key of MASTERLIST_DRAFT_KEYS) {
    if (key in item) {
      if (key === 'custom_fields_values') {
        try {
          const value = item[key];
          if (typeof value === 'string') safe[key] = JSON.parse(value);
          else if (value && typeof value === 'object') safe[key] = value;
        } catch {}
      } else if (key === 'accessories') {
        if (Array.isArray(item[key])) {
          safe.accessories = item[key].map((acc: any) => ({
            type: ['monitor', 'keyboard', 'mouse'].includes(normalizeString(acc.type) || '') ? normalizeString(acc.type) as any : 'other',
            serial_number: normalizeString(acc.serial_number),
            name: normalizeString(acc.name),
            brand: normalizeString(acc.brand),
            model: normalizeString(acc.model)
          }));
        }
      } else {
        safe[key] = normalizeString(item[key]) as any;
      }
    }
  }
  return safe;
}

function sanitizeMasterlistParsedResponse(parsed: any): {
  reply: string;
  warnings: string[];
  drafts: AssetUpdateDraft[];
} {
  if (!parsed || typeof parsed !== 'object') {
    return { reply: '', warnings: [], drafts: [] };
  }

  const draftSources = [parsed?.drafts, parsed?.data?.drafts, parsed?.assets, parsed?.data?.assets];
  let drafts: AssetUpdateDraft[] = [];
  for (const source of draftSources) {
    if (!Array.isArray(source)) continue;
    drafts = source
      .map((item: any) => sanitizeMasterlistDraft(item))
      .filter((item: AssetUpdateDraft) => MASTERLIST_DRAFT_KEYS.some((key) => Boolean(item[key])) )
      .slice(0, 30);
    break;
  }

  const warningSources = [parsed?.warnings, parsed?.data?.warnings];
  let warnings: string[] = [];
  for (const source of warningSources) {
    if (!Array.isArray(source)) continue;
    warnings = source.map((item: any) => normalizeString(item)).filter(Boolean).slice(0, 20);
    break;
  }

  const reply = normalizeString(parsed?.reply)
    || normalizeString(parsed?.data?.reply)
    || normalizeString(parsed?.message)
    || normalizeString(parsed?.data?.message);

  return { reply, warnings, drafts };
}

async function getGeminiApiKey(): Promise<string | null> {
  try {
    if (!AppDataSource.isInitialized) return null;
    const repo = AppDataSource.getRepository(SystemSettings);
    const s = await repo.findOne({ where: { setting_key: 'gemini_api_key', is_active: true } });
    if (!s?.setting_value) return null;
    return decrypt(s.setting_value) ?? s.setting_value;
  } catch { return null; }
}

async function getGeminiModel(): Promise<string> {
  try {
    if (!AppDataSource.isInitialized) return DEFAULT_GEMINI_MODEL;
    const repo = AppDataSource.getRepository(SystemSettings);
    const s = await repo.findOne({ where: { setting_key: 'gemini_model', is_active: true } });
    return String(s?.setting_value || DEFAULT_GEMINI_MODEL).trim().replace(/^models\//, '') || DEFAULT_GEMINI_MODEL;
  } catch { return DEFAULT_GEMINI_MODEL; }
}

async function getIlmuApiKey(): Promise<string | null> {
  try {
    if (!AppDataSource.isInitialized) return null;
    const repo = AppDataSource.getRepository(SystemSettings);
    const s = await repo.findOne({ where: { setting_key: 'ilmu_api_key', is_active: true } });
    return s?.setting_value || null;
  } catch { return null; }
}

async function getIlmuModel(): Promise<string> {
  try {
    if (!AppDataSource.isInitialized) return 'nemo-super';
    const repo = AppDataSource.getRepository(SystemSettings);
    const s = await repo.findOne({ where: { setting_key: 'ilmu_model', is_active: true } });
    return String(s?.setting_value || 'nemo-super').trim() || 'nemo-super';
  } catch { return 'nemo-super'; }
}

async function getIlmuBaseUrl(): Promise<string> {
  try {
    if (!AppDataSource.isInitialized) return 'https://api.ilmu.ai/v1';
    const repo = AppDataSource.getRepository(SystemSettings);
    const s = await repo.findOne({ where: { setting_key: 'ilmu_base_url', is_active: true } });
    return String(s?.setting_value || 'https://api.ilmu.ai/v1').trim().replace(/\/+$/, '') || 'https://api.ilmu.ai/v1';
  } catch { return 'https://api.ilmu.ai/v1'; }
}

function formatGeminiError(error: any): Error {
  const status = error?.response?.status;
  const apiMessage = error?.response?.data?.error?.message || error?.response?.data?.message;

  if (status === 401 || status === 403) {
    return new Error('Konfigurasi Gemini API tidak sah. Sila semak API key dalam Tetapan Integrasi AI.');
  }

  if (status === 429) {
    return new Error('Permintaan AI terlalu banyak buat masa ini. Sila cuba semula sebentar lagi.');
  }

  if ([500, 502, 503, 504].includes(status)) {
    return new Error('Perkhidmatan AI sedang bermasalah sementara waktu. Sila cuba semula.');
  }

  if (typeof apiMessage === 'string' && apiMessage.trim()) {
    return new Error(apiMessage.trim());
  }

  if (typeof error?.message === 'string' && error.message.trim()) {
    return new Error(error.message.trim());
  }

  return new Error('Gagal mendapatkan respons daripada perkhidmatan AI.');
}

async function generateWithGemini(apiKey: string, model: string, parts: any[]): Promise<string> {
  const url = `${GEMINI_API_URL}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const payload = {
    contents: [{ role: 'user', parts }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 8192 }
  };

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await axios.post(
        url,
        payload,
        { timeout: 90000, headers: { 'Content-Type': 'application/json' } }
      );
      const text: string = response.data?.candidates?.[0]?.content?.parts
        ?.map((p: any) => (typeof p.text === 'string' ? p.text : '')).join('\n').trim() || '';
      if (!text) throw new Error('Gemini memberikan respons kosong.');
      return text;
    } catch (error: any) {
      const status = error?.response?.status;
      const shouldRetry = attempt === 1 && [429, 500, 502, 503, 504].includes(status);
      if (shouldRetry) {
        console.warn(`Gemini request retry ${attempt}/2 selepas status ${status}.`);
        continue;
      }

      console.error('AI masterlist Gemini error:', error?.response?.data || error?.message || error);
      throw formatGeminiError(error);
    }
  }

  throw new Error('Gagal mendapatkan respons daripada perkhidmatan AI.');
}

async function generateWithOpenAI(apiKey: string, baseUrl: string, model: string, messages: any[]): Promise<string> {
  const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
  const payload = {
    model,
    messages: [{ role: 'system', content: 'Anda ialah pembantu AI SPFIT.' }, ...messages],
    temperature: 0.1,
    max_tokens: 8192
  };

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await axios.post(
        url,
        payload,
        {
          timeout: 90000,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          }
        }
      );
      const text: string = response.data?.choices?.[0]?.message?.content?.trim() || '';
      if (!text) throw new Error('AI memberikan respons kosong.');
      return text;
    } catch (error: any) {
      const status = error?.response?.status;
      const shouldRetry = attempt === 1 && [429, 500, 502, 503, 504].includes(status);
      if (shouldRetry) {
        console.warn(`AI request retry ${attempt}/2 selepas status ${status}.`);
        continue;
      }
      console.error('AI masterlist OpenAI error:', error?.response?.data || error?.message || error);
      throw formatOpenAiError(error);
    }
  }
  throw new Error('Gagal mendapatkan respons daripada perkhidmatan AI.');
}

function formatOpenAiError(error: any): Error {
  const status = error?.response?.status;
  const msg = error?.response?.data?.error?.message || error?.response?.data?.message;
  if (status === 401 || status === 403) return new Error('Konfigurasi AI tidak sah. Sila semak API key dalam Tetapan Integrasi AI.');
  if (status === 429) return new Error('Permintaan AI terlalu banyak buat masa ini. Sila cuba semula.');
  if ([500, 502, 503, 504].includes(status)) return new Error('Perkhidmatan AI sedang bermasalah.');
  if (typeof msg === 'string' && msg.trim()) return new Error(msg.trim());
  return new Error(error?.message || 'Gagal berhubung dengan perkhidmatan AI.');
}

function convertPartsToOpenAiMessages(parts: any[]): any[] {
  const messages: any[] = [];
  let currentText = '';
  
  for (const part of parts) {
    if (part.text) {
      currentText += part.text + '\n';
    } else if (part.inlineData) {
      if (currentText) {
        messages.push({ role: 'user', content: currentText.trim() });
        currentText = '';
      }
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: 'Gambar lampiran:' },
          { type: 'image_url', image_url: { url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}` } }
        ]
      });
    }
  }
  if (currentText) {
    messages.push({ role: 'user', content: currentText.trim() });
  }
  return messages;
}

async function repairJsonWithOpenAI(apiKey: string, baseUrl: string, model: string, raw: string): Promise<any | null> {
  try {
    const repairedRaw = await generateWithOpenAI(apiKey, baseUrl, model, [
      {
        role: 'user',
        content: 'Tukar respons berikut kepada SATU JSON object yang sah. Balas JSON sahaja tanpa markdown atau teks tambahan.\n\n' + raw.slice(0, 5000)
      }
    ]);
    return extractJsonObject(repairedRaw);
  } catch {
    return null;
  }
}

async function repairJsonWithGemini(apiKey: string, model: string, raw: string): Promise<any | null> {
  try {
    const repairedRaw = await generateWithGemini(apiKey, model, [
      {
        text:
          'Tukar respons berikut kepada SATU JSON object yang sah. ' +
          'Balas JSON sahaja tanpa markdown atau teks tambahan. ' +
          'Kekalkan maksud asal dan jangan reka maklumat baru.'
      },
      { text: `RESPONS_ASAL:\n${String(raw || '').slice(0, 12000)}` }
    ]);

    return extractJsonObject(repairedRaw);
  } catch (error) {
    console.warn('AI masterlist JSON repair gagal:', error);
    return null;
  }
}

interface ApplyResolution {
  action: 'use_candidate' | 'create_new' | 'force_cross_masterlist';
  asset_id?: number;
}

function normalizeSerial(serial: unknown): string {
  // Business rule: serial number uses digit 0, never letter O.
  return normalizeString(serial)
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/O/g, '0');
}

function levenshteinDistance(a: string, b: string): number {
  const aa = a || '';
  const bb = b || '';
  const matrix: number[][] = Array.from({ length: aa.length + 1 }, () => Array(bb.length + 1).fill(0));

  for (let i = 0; i <= aa.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= bb.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= aa.length; i++) {
    for (let j = 1; j <= bb.length; j++) {
      const cost = aa[i - 1] === bb[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[aa.length][bb.length];
}

function serialSimilarity(a: string, b: string): number {
  const aa = normalizeSerial(a);
  const bb = normalizeSerial(b);
  if (!aa || !bb) return 0;
  const maxLen = Math.max(aa.length, bb.length);
  if (maxLen === 0) return 1;
  const distance = levenshteinDistance(aa, bb);
  return 1 - distance / maxLen;
}

export class AIMasterlistAssistantController {
  private assetRepository = AppDataSource.getRepository(Asset);
  private assetUserRepository = AppDataSource.getRepository(AssetUser);
  private accessoryRepository = AppDataSource.getRepository(AssetAccessory);
  private attachmentRepository = AppDataSource.getRepository(AssetAttachment);
  private historyRepository = AppDataSource.getRepository(AssetPairingHistory);

  private async findExactBySerial(serial: string, masterlistId?: number): Promise<Asset | null> {
    const normalized = normalizeSerial(serial);
    if (!normalized) return null;

    const qb = this.assetRepository
      .createQueryBuilder('asset')
      .leftJoinAndSelect('asset.masterlist', 'masterlist')
      .leftJoinAndSelect('masterlist.project', 'project')
        .where("REPLACE(UPPER(TRIM(COALESCE(asset.serial_number, ''))), ' ', '') = :sn", { sn: normalized });

    if (masterlistId && masterlistId > 0) {
      qb.andWhere('asset.masterlist_id = :masterlistId', { masterlistId });
    }

    return qb.getOne();
  }

  private async findNearestSerialCandidate(serial: string, masterlistId: number): Promise<{ asset: Asset; score: number } | null> {
    const normalized = normalizeSerial(serial);
    if (!normalized || !masterlistId) return null;

    const assets = await this.assetRepository.find({
      where: { masterlist_id: masterlistId },
      relations: ['masterlist', 'masterlist.project']
    });

    let best: { asset: Asset; score: number } | null = null;
    for (const asset of assets) {
      const sn = normalizeSerial(asset.serial_number);
      if (!sn) continue;
      const score = serialSimilarity(normalized, sn);
      if (!best || score > best.score) {
        best = { asset, score };
      }
    }

    if (!best) return null;
    return best.score >= 0.55 ? best : null;
  }

  private async upsertAssetUser(assetId: number, draft: AssetUpdateDraft): Promise<void> {
    const userName = normalizeUpper(draft.user_name);
    if (!userName) return;

    await this.assetUserRepository.delete({ asset_id: assetId });

    const assetUser = this.assetUserRepository.create({
      asset_id: assetId,
      user_name: userName,
      position: normalizeUpper(draft.position) || undefined,
      department: normalizeUpper(draft.department) || undefined,
      floor: normalizeUpper(draft.floor) || undefined,
      building: normalizeUpper(draft.building) || undefined,
      location: normalizeUpper(draft.location) || undefined,
      branch: normalizeUpper(draft.branch) || undefined,
      state: normalizeUpper(draft.state) || undefined
    });
    await this.assetUserRepository.save(assetUser);
  }

  private async handleAccessories(assetId: number, masterlistId: number, draft: AssetUpdateDraft, actionBy?: number): Promise<void> {
    if (!draft.accessories || draft.accessories.length === 0) return;

    for (const acc of draft.accessories) {
      const type = acc.type || 'other';
      const serial = normalizeSerial(acc.serial_number);
      if (!serial) continue;

      console.log(`[AI Pair] Handling ${type}: SN="${serial}", Name="${acc.name}"`);
      let accessoryAsset = await this.findExactBySerial(serial);

      if (!accessoryAsset) {
        const name = normalizeUpper(acc.name) || `Aksesori ${serial}`;
        console.log(`[AI Pair] 🆕 Creating ${type}: "${name}"`);
        accessoryAsset = await this.assetRepository.save(
          this.assetRepository.create({
            masterlist_id: masterlistId,
            name,
            serial_number: serial,
            status: AssetStatus.AKTIF,
            created_by: actionBy
          })
        );
        if (normalizeUpper(acc.model)) {
          accessoryAsset.model = normalizeUpper(acc.model);
          await this.assetRepository.save(accessoryAsset);
        }
      } else {
        console.log(`[AI Pair] 🔍 Found existing #${accessoryAsset.id}: "${accessoryAsset.name}"`);
        let updated = false;
        if (acc.name && normalizeUpper(acc.name) && accessoryAsset.name !== normalizeUpper(acc.name)) {
          accessoryAsset.name = normalizeUpper(acc.name);
          updated = true;
        }
        if (accessoryAsset.masterlist_id !== masterlistId) {
          accessoryAsset.masterlist_id = masterlistId;
          updated = true;
        }
        if (acc.model && normalizeUpper(acc.model) && accessoryAsset.model !== normalizeUpper(acc.model)) {
          accessoryAsset.model = normalizeUpper(acc.model);
          updated = true;
        }
        if (updated) {
          await this.assetRepository.save(accessoryAsset);
          console.log(`[AI Pair] 📝 Updated accessory #${accessoryAsset.id}`);
        }

        const existingPairing = await this.accessoryRepository.findOne({
          where: { accessory_asset_id: accessoryAsset.id }
        });
        if (existingPairing) {
          console.log(`[AI Pair] ⏭️ Already paired to #${existingPairing.asset_id}`);
          continue;
        }
      }

      // Copy user assignments from main asset to accessory asset
      await this.copyAssetUsersToAccessory(assetId, accessoryAsset.id);
      console.log(`[AI Pair] 👤 User info copied from main #${assetId} to accessory #${accessoryAsset.id}`);

      // Create pairing
      await this.accessoryRepository.save(
        this.accessoryRepository.create({
          asset_id: assetId,
          accessory_asset_id: accessoryAsset.id,
          accessory_type: type as any
        })
      );
      console.log(`[AI Pair] ✅ Paired ${type} #${accessoryAsset.id} to main #${assetId}`);

      // Record history
      await this.historyRepository.save(
        this.historyRepository.create({
          parent_asset_id: assetId,
          accessory_asset_id: accessoryAsset.id,
          action: 'PAIRED',
          action_by: actionBy || null
        })
      );
    }
  }

  private async copyAssetUsersToAccessory(mainAssetId: number, accessoryAssetId: number): Promise<void> {
    const mainAssetUsers = await this.assetUserRepository.find({ where: { asset_id: mainAssetId } });
    if (!mainAssetUsers.length) return;

    for (const user of mainAssetUsers) {
      const existing = await this.assetUserRepository.findOne({
        where: { asset_id: accessoryAssetId, user_name: user.user_name }
      });
      if (existing) continue;

      const newUser = this.assetUserRepository.create({
        asset_id: accessoryAssetId,
        user_name: user.user_name,
        position: user.position,
        department: user.department,
        floor: user.floor,
        building: user.building,
        location: user.location,
        branch: user.branch,
        state: user.state
      });
      await this.assetUserRepository.save(newUser);
    }
  }

  private async handleAttachments(assetId: number, attachments?: Express.Multer.File[]): Promise<void> {
    if (!attachments || attachments.length === 0) return;

    const attachmentEntities = attachments.map(file => {
      const fileInfo = getFileInfo(file);
      return this.attachmentRepository.create({
        asset_id: assetId,
        file_name: fileInfo.originalname,
        file_path: fileInfo.relativePath,
        file_type: fileInfo.mimetype,
        file_size: fileInfo.size,
        created_at: new Date()
      });
    });

    await this.attachmentRepository.save(attachmentEntities);
  }

  private async updateAssetRecord(asset: Asset, draft: AssetUpdateDraft, serial: string, actionBy?: number, notePrefix?: string, attachments?: Express.Multer.File[]): Promise<Asset> {
    const existingNotes = normalizeUpper(asset.notes);
    const aiNotes = normalizeUpper(draft.notes);

    // Build new notes: AI extracted remarks first, then existing notes, then system metadata
    const humanParts: string[] = [];
    if (aiNotes && !existingNotes?.includes(aiNotes)) {
      humanParts.push(aiNotes);
    }

    const systemParts = [
      normalizeUpper(notePrefix || ''),
      normalizeUpper(draft.brand) ? `BRAND (AI): ${normalizeUpper(draft.brand)}` : '',
      normalizeUpper(draft.department) ? `DEPARTMENT (AI): ${normalizeUpper(draft.department)}` : ''
    ].filter(Boolean);

    const allParts = [...humanParts, ...systemParts].filter(Boolean);
    const newNotes = allParts.join(' | ').slice(0, 1000);

    // Update asset name: use asset_name, then fallback to user_name, then keep existing
    const newName = normalizeUpper(draft.asset_name) || normalizeUpper(draft.user_name);
    if (newName) asset.name = newName;
    if (normalizeUpper(draft.model)) asset.model = normalizeUpper(draft.model);
    asset.serial_number = serial;
    if (newNotes) asset.notes = newNotes;

    if (!asset.category_id || !asset.brand_id) {
      const intel = await inferAndCacheModelIntel({
        model: draft.model || draft.asset_name || asset.model || '',
        serial,
        allowInternet: true,
        allowAi: true
      });
      if (intel?.brand?.id && !asset.brand_id && intel.brand.confidence >= 0.65) {
        asset.brand_id = intel.brand.id;
      }
      if (intel?.category?.id && !asset.category_id && intel.category.confidence >= 0.65) {
        asset.category_id = intel.category.id;
      }
    }

    // Capture old values for audit logging
    const oldValues = {
        name: asset.name,
        serial_number: asset.serial_number,
        asset_tag: asset.asset_tag,
        model: asset.model,
        brand_id: asset.brand_id,
        category_id: asset.category_id,
        status: asset.status,
        notes: asset.notes
    };

    const saved = await this.assetRepository.save(asset);
    await this.upsertAssetUser(saved.id, draft);
    await this.handleAccessories(saved.id, saved.masterlist_id, draft, actionBy);
    await this.handleAttachments(saved.id, attachments);

    // Log audit trail
    try {
        const logRepo = AppDataSource.getRepository(AssetUpdateLog);
        const fieldChanges: Record<string, { old: any; new: any }> = {};
        const newValues = {
            name: saved.name,
            serial_number: saved.serial_number,
            asset_tag: saved.asset_tag,
            model: saved.model,
            brand_id: saved.brand_id,
            category_id: saved.category_id,
            status: saved.status,
            notes: saved.notes
        };
        for (const key of Object.keys(oldValues)) {
            if (String(oldValues[key]) !== String(newValues[key])) {
                fieldChanges[key] = { old: oldValues[key], new: newValues[key] };
            }
        }
        const logEntry = logRepo.create({
            asset_id: saved.id,
            user_id: actionBy || null,
            action_type: 'AI_UPDATE',
            field_changes: fieldChanges,
            ip_address: '127.0.0.1',
            user_agent: 'AI Masterlist Assistant'
        });
        await logRepo.save(logEntry);
    } catch (err) {
        console.error('Failed to log asset update:', err);
    }

    return saved;
  }

  private async createAssetRecord(masterlistId: number, draft: AssetUpdateDraft, serial: string, createdBy?: number, notePrefix?: string, attachments?: Express.Multer.File[]): Promise<Asset> {
    const aiNotes = normalizeUpper(draft.notes);
    const humanParts = aiNotes ? [aiNotes] : [];

    const systemParts = [
      normalizeUpper(notePrefix || ''),
      normalizeUpper(draft.brand) ? `BRAND (AI): ${normalizeUpper(draft.brand)}` : '',
      normalizeUpper(draft.department) ? `DEPARTMENT (AI): ${normalizeUpper(draft.department)}` : ''
    ].filter(Boolean);

    const allParts = [...humanParts, ...systemParts].filter(Boolean);

    // Asset name: use asset_name, fallback to user_name, then use ASSET {serial}
    const assetName = normalizeUpper(draft.asset_name) || normalizeUpper(draft.user_name) || `ASSET ${serial}`;

    const asset = this.assetRepository.create({
      masterlist_id: masterlistId,
      asset_tag: normalizeUpper(draft.asset_tag) || undefined,
      name: assetName,
      model: normalizeUpper(draft.model) || undefined,
      serial_number: serial,
      status: AssetStatus.AKTIF,
      notes: allParts.join(' | ').slice(0, 1000) || undefined,
      created_by: createdBy
    });

    const intel = await inferAndCacheModelIntel({
      model: draft.model || draft.asset_name || '',
      serial,
      allowInternet: true,
      allowAi: true
    });
    if (intel?.brand?.id && intel.brand.confidence >= 0.65) asset.brand_id = intel.brand.id;
    if (intel?.category?.id && intel.category.confidence >= 0.65) asset.category_id = intel.category.id;

    const saved = await this.assetRepository.save(asset);
    await this.upsertAssetUser(saved.id, draft);
    await this.handleAccessories(saved.id, masterlistId, draft, createdBy);
    await this.handleAttachments(saved.id, attachments);

    // Log audit trail for creation
    try {
        const logRepo = AppDataSource.getRepository(AssetUpdateLog);
        const logEntry = logRepo.create({
            asset_id: saved.id,
            user_id: createdBy || null,
            action_type: 'AI_CREATE',
            field_changes: {
                name: { old: null, new: saved.name },
                serial_number: { old: null, new: saved.serial_number },
                asset_tag: { old: null, new: saved.asset_tag },
                model: { old: null, new: saved.model },
                status: { old: null, new: saved.status }
            },
            ip_address: '127.0.0.1',
            user_agent: 'AI Masterlist Assistant'
        });
        await logRepo.save(logEntry);
    } catch (err) {
        console.error('Failed to log asset create:', err);
    }

    return saved;
  }

  chat = async (req: Request, res: Response): Promise<void> => {
    // Detect which AI is active and its capabilities
    const detectedAI = await detectAiCapability();
    
    if (!detectedAI.connected) {
      res.status(503).json({
        success: false,
        message: 'Tiada konfigurasi AI. Pergi ke Tetapan → Integrasi AI dan sediakan ILMU AI, Gemini, atau OpenAI API key dahulu.'
      });
      return;
    }

    const provider = detectedAI.provider;
    const apiKey = detectedAI.key;
    const model = detectedAI.model;
    const baseUrl = detectedAI.baseUrl || '';

    const message = normalizeString(req.body?.message);
    const sourceModeRaw = normalizeString(req.body?.source_mode).toLowerCase();
    const sourceMode = (['combined', 'files_only', 'chat_only'].includes(sourceModeRaw)
      ? sourceModeRaw
      : 'combined') as 'combined' | 'files_only' | 'chat_only';
    const useFiles = sourceMode !== 'chat_only';
    const useMessage = sourceMode !== 'files_only';
    const currentDrafts = parseJsonField<AssetUpdateDraft[]>(req.body?.drafts, []);
    const history = parseJsonField<ChatMessage[]>(req.body?.history, []).slice(-6);
    const files = ((req.files as Express.Multer.File[]) || []).slice(0, 10);

    if (sourceMode === 'chat_only' && !message) {
      res.status(400).json({ success: false, message: 'Mesej chat diperlukan untuk mod Chat Sahaja.' });
      return;
    }

    if (sourceMode === 'files_only' && files.length === 0) {
      res.status(400).json({ success: false, message: 'Sekurang-kurangnya satu fail/gambar diperlukan untuk mod Fail/Gambar Sahaja.' });
      return;
    }

    if ((useMessage && !message) && (useFiles && files.length === 0)) {
      res.status(400).json({ success: false, message: 'Arahan chat atau fail diperlukan.' });
      return;
    }

    const warnings: string[] = [];
    const parts: any[] = [];

        parts.push({
      text:
        'ARAHAN SISTEM: Balas HANYA SATU JSON object - tiada teks lain. ' +
        'Mula dengan { dan akhiri dengan }. ' +
        'Anda pembantu AI SPFIT: ekstrak maklumat aset IT dari gambar/borang. ' +
        'Mod semasa: ' + String(sourceMode) + '. ' +
        'Bahasa reply: Bahasa Melayu ringkas. ' +
        'Field utama: serial_number (WAJIB), asset_name, brand, model, ' +
        'user_name, position, department, floor, building, location, branch, state, notes. ' +
        'Setiap peralatan => satu entry dalam array "drafts". ' +
        'Peranti pelengkap (monitor/keyboard/mouse) => array "accessories" dalam draft aset utama. ' +
        'Catatan/remarks => field "notes". SCAN REMARK dari gambar jika nampak. ' +
        'BETULKAN ejaan/loghat jika jelas ralat OCR (cth: AAUNTER => KAUNTER). Jangan reka data baru. ' + 'Jika kurang jelas, tanya dalam "reply".'
    });

    parts.push({ text: `Draf semasa: ${JSON.stringify(currentDrafts)}` });
    if (useMessage) {
      parts.push({ text: `Mesej user: ${message || '(tiada mesej tambahan)'}` });
    } else {
      parts.push({ text: 'Mesej user: (diabaikan kerana mod files_only)' });
      if (message) warnings.push('Mesej chat diabaikan kerana mod Fail/Gambar Sahaja dipilih.');
    }
    parts.push({ text: `Sejarah: ${JSON.stringify(history)}` });
    parts.push({
      text:
        'Format JSON wajib: {"reply":"<mesej BM ringkas>","drafts":[{"serial_number":"","asset_tag":"","asset_name":"","brand":"","model":"","user_name":"","position":"","department":"","floor":"","building":"","location":"","branch":"","state":"","notes":"","accessories":[{"type":"monitor|keyboard|mouse|other","serial_number":"","name":"","brand":"","model":""}]}],"warnings":[]}'
    });

    if (useFiles) {
      for (const file of files) {
        const mime = file.mimetype || 'application/octet-stream';
        const ext = getFileExtension(file.originalname);
        const isImage = mime.startsWith('image/');
        const isInlineDoc = INLINE_FILE_MIME_TYPES.has(mime) || INLINE_FILE_EXTENSIONS.has(ext);
        const isText = TEXT_FILE_MIME_TYPES.has(mime) || TEXT_FILE_EXTENSIONS.has(ext);

        parts.push({ text: `Fail: ${file.originalname} (${mime}, ${file.size} bytes)` });

        // If it's an image or inline doc, send directly to AI for extraction
        if (isImage || isInlineDoc) {
          if (isImage) {
            // Resize images to max 1024x1024 before sending to AI (reduces latency and tokens)
            try {
              const resized = await sharp(file.buffer)
                .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
                .jpeg({ quality: 80 })
                .toBuffer();
              parts.push({ inlineData: { data: resized.toString('base64'), mimeType: 'image/jpeg' } });
            } catch {
              parts.push({ inlineData: { data: file.buffer.toString('base64'), mimeType: mime } });
            }
          } else {
            parts.push({ inlineData: { data: file.buffer.toString('base64'), mimeType: mime } });
          }
          continue;
        }
        if (isText) {
          parts.push({ text: `Kandungan ${file.originalname}:\n${file.buffer.toString('utf8').slice(0, 15000)}` });
          continue;
        }
        const snippet = getBestEffortText(file.buffer);
        if (snippet) {
          parts.push({ text: `Ekstrak ${file.originalname}:\n${snippet}` });
        } else {
          warnings.push(`Fail "${file.originalname}" diterima tetapi kandungan tidak dapat diekstrak. Sila tambah teks maklumat dalam chat.`);
        }
      }
    } else if (files.length > 0) {
      warnings.push('Lampiran fail diabaikan kerana mod Chat Sahaja dipilih.');
    }

    try {
      let raw: string;
      let parsed: any;
      let repairUsed = false;

      if (provider === 'ilmu' || provider === 'openai') {
        // OpenAI-compatible API (ILMU, OpenAI, etc.)
        const messages = convertPartsToOpenAiMessages(parts);
        raw = await generateWithOpenAI(apiKey, baseUrl, model, messages);
        parsed = extractJsonObject(raw);
        repairUsed = !parsed;
        if (!parsed) {
          parsed = await repairJsonWithOpenAI(apiKey, baseUrl, model, raw);
        }
      } else {
        raw = await generateWithGemini(apiKey, model, parts);
        parsed = extractJsonObject(raw);
        repairUsed = !parsed;
        if (!parsed) {
          parsed = await repairJsonWithGemini(apiKey, model, raw);
        }
      }

      const sanitized = sanitizeMasterlistParsedResponse(parsed);

      const rawDrafts: AssetUpdateDraft[] = sanitized.drafts;

      const normalizedDrafts = rawDrafts.map((d: any): AssetUpdateDraft => ({
        serial_number: normalizeString(d.serial_number),
        asset_tag: normalizeString(d.asset_tag),
        asset_name: normalizeString(d.asset_name),
        brand: normalizeString(d.brand),
        model: normalizeString(d.model),
        user_name: normalizeString(d.user_name),
        position: normalizeString(d.position),
        department: normalizeString(d.department),
        floor: normalizeString(d.floor),
        building: normalizeString(d.building),
        location: normalizeString(d.location),
        branch: normalizeString(d.branch),
        state: normalizeString(d.state),
        accessories: Array.isArray(d.accessories) ? d.accessories.map((a: any) => ({
          type: ['monitor', 'keyboard', 'mouse'].includes(normalizeString(a.type) || '') ? normalizeString(a.type) : 'other',
          serial_number: normalizeString(a.serial_number),
          name: normalizeString(a.name),
          brand: normalizeString(a.brand),
          model: normalizeString(a.model)
        })) : []
      }));

      const parsedWarnings = sanitized.warnings;
      if (!parsed) {
        parsedWarnings.push('Respons AI tidak dalam format JSON standard. Data dipulihkan setakat yang boleh dibaca.');
      }
      const reply = sanitized.reply || 'AI dah proses fail. Semak draf di bawah.';
      const isComplete = normalizedDrafts.some(d => d.serial_number || d.asset_tag);
      const parseSource = parsed
        ? (repairUsed ? 'repair' : 'direct')
        : 'fallback_text';

      res.json({
        success: true,
        data: {
          reply,
          drafts: normalizedDrafts,
          warnings: [...warnings, ...parsedWarnings],
          isComplete,
          repairUsed,
          parseSource,
          aiProvider: provider
        }
      });
    } catch (err: any) {
      console.error('AI masterlist assistant error:', err);
      const msg = err?.message || err?.response?.data?.error || '';
      if (msg.includes('does not support image') || msg.includes('image input') || msg.includes('Stealth model') || msg.includes('not a multimodal model') || msg.includes('does not support multimodal')) {
        res.status(400).json({
          success: false,
          message: 'Model AI semasa tidak menyokong input fail. Sila guna fitur Import CSV (Import Aset) atau aktifkan model Vision di Tetapan → Integrasi AI.',
          error: msg
        });
        return;
      }
      res.status(500).json({ success: false, message: err.message || 'Gagal memproses arahan AI.' });
    }
  };

  apply = async (req: Request, res: Response): Promise<void> => {
    const drafts: AssetUpdateDraft[] = Array.isArray(req.body?.drafts)
      ? req.body.drafts
      : parseJsonField<AssetUpdateDraft[]>(req.body?.drafts, []);
    const selectedMasterlistId = Number(req.body?.masterlist_id || 0);
    const selectedProjectId = Number(req.body?.project_id || 0);
    const resolutions = typeof req.body?.resolutions === 'string'
      ? parseJsonField<Record<string, ApplyResolution>>(req.body?.resolutions, {})
      : ((req.body?.resolutions || {}) as Record<string, ApplyResolution>);
    const uploadedFiles = ((req.files as Express.Multer.File[]) || []).slice(0, 10);

    if (!drafts.length) {
      res.status(400).json({ success: false, message: 'Tiada draf untuk diaplikasikan.' });
      return;
    }

    if (!(selectedMasterlistId > 0)) {
      res.status(400).json({ success: false, message: 'Masterlist perlu dipilih sebelum apply.' });
      return;
    }

    const results: Array<{
      index: number;
      serial_number?: string;
      asset_tag?: string;
      asset_id?: number;
      status: 'updated' | 'not_found' | 'error' | 'confirmation_required';
      message?: string;
      suggestion?: any;
    }> = [];
    const pendingConfirmations: any[] = [];

    for (let i = 0; i < drafts.length; i++) {
      const draft = drafts[i];
      const sn = normalizeSerial(draft.serial_number);
      const tag = normalizeUpper(draft.asset_tag);
      const resolution = resolutions[String(i)];

      if (!sn) {
        results.push({ index: i, status: 'error', message: 'Serial number diperlukan sebagai unique ID.' });
        continue;
      }

      try {
        // 1) Exact serial match inside selected masterlist -> direct update
        const exactInSelected = await this.findExactBySerial(sn, selectedMasterlistId);
        if (exactInSelected) {
          const saved = await this.updateAssetRecord(exactInSelected, draft, sn, req.user?.id, undefined, uploadedFiles);
          results.push({
            index: i,
            serial_number: sn,
            asset_tag: tag || undefined,
            asset_id: saved.id,
            status: 'updated',
            message: 'Rekod sedia ada (serial sama) dikemaskini.'
          });
          continue;
        }

        // 2) Exact serial exists in other masterlist -> need human confirmation
        const exactAnywhere = await this.findExactBySerial(sn);
        if (exactAnywhere && exactAnywhere.masterlist_id !== selectedMasterlistId) {
          if (!resolution || resolution.action !== 'force_cross_masterlist') {
            const sourceProject = (exactAnywhere as any).masterlist?.project;
            pendingConfirmations.push({
              index: i,
              type: 'cross_masterlist',
              serial_number: sn,
              existing_asset_id: exactAnywhere.id,
              existing_masterlist_id: exactAnywhere.masterlist_id,
              existing_masterlist_name: (exactAnywhere as any).masterlist?.name,
              existing_project_id: sourceProject?.id,
              existing_project_name: sourceProject ? `${sourceProject.code} - ${sourceProject.name}` : undefined,
              message: 'Serial number ini sudah wujud di masterlist/projek lain. Teruskan untuk cipta rekod baru di masterlist semasa?'
            });
            results.push({
              index: i,
              serial_number: sn,
              status: 'confirmation_required',
              message: 'Perlu pengesahan: serial number sudah wujud di masterlist lain.'
            });
            continue;
          }

          const sourceProject = (exactAnywhere as any).masterlist?.project;
          const note = `Serial ${sn} juga wujud di ${(exactAnywhere as any).masterlist?.name || 'masterlist lain'}${sourceProject ? ` (${sourceProject.code} - ${sourceProject.name})` : ''}.`; 
          const created = await this.createAssetRecord(selectedMasterlistId, draft, sn, req.user?.id, note, uploadedFiles);
          results.push({
            index: i,
            serial_number: sn,
            asset_tag: tag || undefined,
            asset_id: created.id,
            status: 'updated',
            message: 'Rekod baru dicipta dengan remark duplicate cross-masterlist.'
          });
          continue;
        }

        // 3) Find nearest serial in selected masterlist -> ask confirm use candidate or create new
        const nearest = await this.findNearestSerialCandidate(sn, selectedMasterlistId);
        if (nearest) {
          if (!resolution || !['use_candidate', 'create_new'].includes(resolution.action)) {
            pendingConfirmations.push({
              index: i,
              type: 'nearest_candidate',
              serial_number: sn,
              candidate_asset_id: nearest.asset.id,
              candidate_serial_number: nearest.asset.serial_number,
              candidate_asset_name: nearest.asset.name,
              similarity: Number(nearest.score.toFixed(2)),
              message: 'Jumpa serial paling hampir dalam masterlist semasa. Guna rekod ini atau tambah rekod baru?'
            });
            results.push({
              index: i,
              serial_number: sn,
              status: 'confirmation_required',
              message: 'Perlu pengesahan: ada serial number paling hampir.'
            });
            continue;
          }

          if (resolution.action === 'use_candidate' && resolution.asset_id === nearest.asset.id) {
            // KEKALKAN SN lama, update info lain, simpan SN AI dalam notes
            const saved = await this.updateAssetRecord(nearest.asset, draft, nearest.asset.serial_number, req.user?.id, `AI Cadangan SN: ${sn || '-'}`, uploadedFiles);
            results.push({
              index: i,
              serial_number: nearest.asset.serial_number,
              asset_id: saved.id,
              status: 'updated',
              message: 'Rekod candidate dikemaskini (SN kekal, info lain diupdate dari AI).'
            });
            continue;
          }

          if (resolution.action === 'create_new') {
            const created = await this.createAssetRecord(selectedMasterlistId, draft, sn, req.user?.id, undefined, uploadedFiles);
            results.push({
              index: i,
              serial_number: sn,
              asset_id: created.id,
              status: 'updated',
              message: 'Rekod baru dicipta selepas pengesahan pengguna.'
            });
            continue;
          }
        }

        // 4) No exact/nearest issue -> create new record
        const created = await this.createAssetRecord(selectedMasterlistId, draft, sn, req.user?.id, undefined, uploadedFiles);
        results.push({
          index: i,
          serial_number: sn,
          asset_tag: tag || undefined,
          asset_id: created.id,
          status: 'updated',
          message: 'Rekod baru dicipta.'
        });
      } catch (err: any) {
        results.push({
          index: i,
          serial_number: sn || undefined,
          asset_tag: tag || undefined,
          status: 'error',
          message: err.message || 'Ralat semasa kemaskini.'
        });
      }
    }

    const updatedCount = results.filter(r => r.status === 'updated').length;
    const notFoundCount = results.filter(r => r.status === 'not_found').length;
    const errorCount = results.filter(r => r.status === 'error').length;
    const confirmationCount = results.filter(r => r.status === 'confirmation_required').length;

    if (pendingConfirmations.length > 0) {
      res.json({
        success: false,
        message: `Perlu pengesahan manual untuk ${pendingConfirmations.length} item sebelum update diteruskan.`,
        data: {
          results,
          pendingConfirmations,
          updatedCount,
          notFoundCount,
          errorCount,
          confirmationCount,
          project_id: selectedProjectId,
          masterlist_id: selectedMasterlistId
        }
      });
      return;
    }

    res.json({
      success: updatedCount > 0,
      message: `${updatedCount} rekod dikemaskini, ${notFoundCount} tidak dijumpai, ${errorCount} ralat.`,
      data: { results, updatedCount, notFoundCount, errorCount, confirmationCount: 0, pendingConfirmations: [] }
    });
  };

  processPdf = async (req: Request, res: Response): Promise<void> => {
    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    });

    const sendEvent = (event: string, data: any) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Detect which AI is active and its capabilities
    const detectedAI = await detectAiCapability();
    
    if (!detectedAI.connected) {
      sendEvent('error', { message: 'Tiada konfigurasi AI. Pergi ke Tetapan → Integrasi AI dan sediakan ILMU AI, Gemini, atau OpenAI API key dahulu.' });
      res.end();
      return;
    }

    const provider = detectedAI.provider;
    const apiKey = detectedAI.key;
    const model = detectedAI.model;
    const baseUrl = detectedAI.baseUrl || '';

    const currentDrafts = parseJsonField<AssetUpdateDraft[]>(req.body?.drafts, []);
    const file = (req.files as Express.Multer.File[])?.[0];
    if (!file) {
      sendEvent('error', { message: 'Tiada fail PDF dihantar.' });
      res.end();
      return;
    }

    // Save uploaded PDF to temp file
    const tmpDir = '/tmp/spfit-ocr';
    const tmpPdf = path.join(tmpDir, `pdf_${Date.now()}_${file.originalname}`);
    
    try {
      const fs = await import('fs');
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
      fs.writeFileSync(tmpPdf, file.buffer);
    } catch (err: any) {
      sendEvent('error', { message: `Gagal simpan fail sementara: ${err.message}` });
      res.end();
      return;
    }

    sendEvent('status', { message: 'Mula memproses PDF...', fileName: file.originalname });

    // Check if file is too large for Python memory
    const fileSizeMB = file.size / (1024 * 1024);

    // Stream OCR results page by page from Python script
    const pythonScript = path.join(__dirname, '..', '..', 'ocr', 'process_pdf.py');
    const child = spawn('python3', [pythonScript, tmpPdf, '200']);

    let pageIndex = 0;
    let allDrafts: AssetUpdateDraft[] = [...currentDrafts];
    let pageResults: any[] = [];
    let currentPageText = '';
    let currentPageNum = 0;
    let totalPages = 0;
    let reqClosed = false;

    req.on('close', () => {
      reqClosed = true;
      child.kill();
      // Cleanup temp file
      try {
        const fs = require('fs');
        if (fs.existsSync(tmpPdf)) fs.unlinkSync(tmpPdf);
      } catch {}
    });

    // Buffer for incomplete lines
    let leftover = '';

    child.stdout.on('data', async (chunk: Buffer) => {
      if (reqClosed) return;

      const lines = (leftover + chunk.toString()).split('\n');
      leftover = lines.pop() || '';  // last part may be incomplete

      for (const line of lines) {
        if (!line.trim()) continue;
        
        try {
          const pageResult = JSON.parse(line);
          
          if (pageResult.error) {
            sendEvent('error', { page: pageResult.page || 0, message: pageResult.error });
            continue;
          }

          totalPages = pageResult.total_pages || 0;
          const pageNum = pageResult.page || 0;
          const text = pageResult.text || '';
          const source = pageResult.source || 'unknown';

          // Skip empty pages
          if (!text) {
            sendEvent('page-skip', { page: pageNum, totalPages, message: 'Halaman kosong atau tiada teks dijumpai.' });
            continue;
          }

          sendEvent('page-ocr', { 
            page: pageNum, 
            totalPages, 
            text: text.slice(0, 200), 
            source,
            fullText: text
          });

          // Send to AI for processing (with delay)
          if (pageIndex > 0) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
          pageIndex++;

          try {
            const parts: any[] = [];
            parts.push({
              text: `ARAHAN SISTEM: Balas HANYA dengan satu JSON object. Ekstrak maklumat aset dari teks halaman PDF ini. SCAN REMARK/notes jika ada. BETULKAN ejaan/loghat jika jelas ralat OCR. Jangan reka data baru.
TEKS DARI HALAMAN ${pageNum}:
${text}

Format JSON wajib: {"reply":"<mesej BM ringkas>","drafts":[{"serial_number":"","asset_tag":"","asset_name":"","brand":"","model":"","user_name":"","position":"","department":"","floor":"","building":"","location":"","branch":"","state":"","notes":"","accessories":[]}],"warnings":[]}`
            });

            let raw: string;
            if (provider === 'ilmu' || provider === 'openai') {
              const messages = convertPartsToOpenAiMessages(parts);
              raw = await generateWithOpenAI(apiKey, baseUrl, model, messages);
            } else {
              raw = await generateWithGemini(apiKey, model, parts);
            }

            const parsed = extractJsonObject(raw);
            const sanitized = sanitizeMasterlistParsedResponse(parsed);
            
            // Normalize drafts
            const pageDrafts = (sanitized.drafts || []).map((d: any): AssetUpdateDraft => ({
              serial_number: normalizeString(d.serial_number),
              asset_tag: normalizeString(d.asset_tag),
              asset_name: normalizeString(d.asset_name),
              brand: normalizeString(d.brand),
              model: normalizeString(d.model),
              user_name: normalizeString(d.user_name),
              position: normalizeString(d.position),
              department: normalizeString(d.department),
              floor: normalizeString(d.floor),
              building: normalizeString(d.building),
              location: normalizeString(d.location),
              branch: normalizeString(d.branch),
              state: normalizeString(d.state),
              notes: normalizeString(d.notes),
              accessories: Array.isArray(d.accessories) ? d.accessories : []
            }));

            // Merge drafts (avoid duplicates by serial_number)
            for (const draft of pageDrafts) {
              if (draft.serial_number) {
                const exists = allDrafts.some(d => d.serial_number === draft.serial_number);
                if (!exists) allDrafts.push(draft);
              } else {
                allDrafts.push(draft);
              }
            }

            pageResults.push({
              page: pageNum,
              source,
              drafts: pageDrafts,
              reply: sanitized.reply || '',
              warnings: sanitized.warnings || []
            });

            sendEvent('page-progress', {
              page: pageNum,
              totalPages,
              drafts: pageDrafts,
              reply: sanitized.reply || 'Halaman diproses.',
              warnings: sanitized.warnings || [],
              cumulativeDrafts: allDrafts.length
            });

          } catch (aiErr: any) {
            sendEvent('page-error', {
              page: pageNum,
              totalPages,
              message: aiErr.message || 'Gagal proses halaman ini dengan AI.',
              text: text.slice(0, 500)
            });
          }

        } catch (parseErr) {
          // Not valid JSON yet - might be incomplete line
          leftover = line;
        }
      }
    });

    child.stderr.on('data', (data: Buffer) => {
      const msg = data.toString();
      if (msg.trim()) {
        console.error('OCR stderr:', msg);
        sendEvent('ocr-log', { message: msg.slice(0, 200) });
      }
    });

    child.on('close', (code: number | null) => {
      // Process any leftover data
      if (leftover.trim()) {
        try {
          const pageResult = JSON.parse(leftover);
          // ... process last page ...
        } catch {}
      }

      // Cleanup temp file
      try {
        const fs = require('fs');
        if (fs.existsSync(tmpPdf)) fs.unlinkSync(tmpPdf);
      } catch {}

      if (reqClosed) return;

      if (code !== 0 && allDrafts.length === 0) {
        sendEvent('error', { message: 'OCR gagal memproses PDF. Sila cuba semula atau guna mod imej biasa.' });
        res.end();
        return;
      }

      sendEvent('complete', {
        pageResults,
        allDrafts,
        totalDrafts: allDrafts.length,
        totalPages,
        processedPages: pageResults.length
      });

      res.end();
    });

    child.on('error', (err: Error) => {
      if (reqClosed) return;
      sendEvent('error', { message: `Gagal jalankan OCR: ${err.message}` });
      res.end();
    });

    // Safety timeout - 10 minutes max
    const safetyTimer = setTimeout(() => {
      if (!reqClosed) {
        child.kill();
        sendEvent('error', { message: 'Masa pemprosesan melebihi had 10 minit. Sila cuba PDF yang lebih kecil.' });
        res.end();
      }
    }, 600000);

    child.on('close', () => clearTimeout(safetyTimer));
  };
}









