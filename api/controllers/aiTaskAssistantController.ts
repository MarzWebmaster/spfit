import { Request, Response } from 'express';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { AppDataSource } from '../config/database.ts';
import { SystemSettings } from '../models/SystemSettings.ts';
import { MainCon } from '../models/MainCon.ts';
import { SupportTypeOption } from '../models/SupportTypeOption.ts';
import { EquipmentCode } from '../models/EquipmentCode.ts';
import { decrypt } from '../utils/encryption.ts';
import { Project, ProjectStatus } from '../models/Project.ts';
import { inferAndCacheModelIntel } from '../services/assetModelIntelService.ts';

const GEMINI_API_URL = process.env.GEMINI_API_URL || 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_GEMINI_MODEL = (process.env.GEMINI_MODEL || 'gemini-2.5-flash').replace(/^models\//, '');

function parsePositiveInt(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

const MAX_HISTORY_ITEMS = parsePositiveInt(process.env.AI_TASK_MAX_HISTORY_ITEMS, 5);
const MAX_HISTORY_CHARS = parsePositiveInt(process.env.AI_TASK_MAX_HISTORY_CHARS, 350);
const MAX_FILES = parsePositiveInt(process.env.AI_TASK_MAX_FILES, 5);
const MAX_FILE_TEXT_SNIPPET = parsePositiveInt(process.env.AI_TASK_MAX_FILE_TEXT_SNIPPET, 2500);
const GEMINI_MAX_OUTPUT_TOKENS = parsePositiveInt(process.env.AI_TASK_MAX_OUTPUT_TOKENS, 800);
const GEMINI_TIMEOUT_MS = parsePositiveInt(process.env.AI_TASK_TIMEOUT_MS, 45000);
const ENABLE_JSON_REPAIR = String(process.env.AI_TASK_ENABLE_JSON_REPAIR || '').toLowerCase() === 'true';
const OPTIONS_CACHE_MS = parsePositiveInt(process.env.AI_TASK_OPTIONS_CACHE_MS, 120000);
const MAX_PROJECT_OPTIONS_IN_PROMPT = parsePositiveInt(process.env.AI_TASK_MAX_PROJECT_OPTIONS_IN_PROMPT, 25);

type ProjectOption = { id: number; code: string; name: string; clientName: string; mainConId: number | null };
type CachedAssistantOptions = {
  supportTypeNames: string[];
  mainConOptions: Array<{ id: number; name: string }>;
  equipmentOptions: string[];
  projectOptions: ProjectOption[];
};

let optionsCache: { expiresAt: number; value: CachedAssistantOptions } | null = null;

const DEFAULT_SUPPORT_TYPE_NAMES = [
  'Perkakasan Komputer',
  'Perisian',
  'Rangkaian',
  'Printer',
  'Server',
  'Lain-lain'
];

interface AssistantDraft {
  title?: string;
  description?: string;
  supportType?: string;
  clientLocation?: string;
  districtAddress?: string;
  state?: string;
  deadline?: string;
  offerPrice?: number | '';
  remarks?: string;
  mainConId?: number | null;
  mainConName?: string;
  picName?: string;
  picPhone?: string;
  clientName?: string;
  assetTagId?: string;
  assetBrand?: string;
  assetModel?: string;
  assetSerialNumber?: string;
  branchName?: string;
  equipmentTypes?: string[];
  links?: string[];
  projectId?: number | null;
  projectName?: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const REQUIRED_FIELDS: Array<keyof AssistantDraft> = [
  'supportType',
  'clientLocation',
  'state'
];

const ASSET_IDENTIFIER_LABEL = 'Tag ID atau Serial Number aset';

const FIELD_LABELS: Record<keyof AssistantDraft, string> = {
  title: 'tajuk tugasan',
  description: 'deskripsi tugasan',
  supportType: 'jenis sokongan',
  clientLocation: 'lokasi klien',
  districtAddress: 'bandar / daerah',
  state: 'negeri',
  deadline: 'tarikh keperluan',
  offerPrice: 'harga tawaran',
  remarks: 'remarks',
  mainConId: 'main con',
  mainConName: 'main con',
  picName: 'nama PIC',
  picPhone: 'telefon PIC',
  clientName: 'nama klien',
  assetTagId: 'asset tag',
  assetBrand: 'jenama aset',
  assetModel: 'model aset',
  assetSerialNumber: 'serial number aset',
  branchName: 'cawangan',
  equipmentTypes: 'jenis peralatan',
  links: 'pautan',
  projectId: 'projek',
  projectName: 'projek'
};

const INLINE_FILE_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation'
]);

const TEXT_FILE_MIME_TYPES = new Set([
  'text/plain',
  'text/csv',
  'application/json',
  'application/xml',
  'text/xml',
  'text/html',
  'text/markdown'
]);

const SPREADSHEET_FILE_MIME_TYPES = new Set([
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.oasis.opendocument.spreadsheet'
]);

const INLINE_FILE_EXTENSIONS = new Set(['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.jpg', '.jpeg', '.png', '.gif', '.webp']);
const TEXT_FILE_EXTENSIONS = new Set(['.txt', '.csv', '.json', '.xml', '.md', '.html']);
const SPREADSHEET_FILE_EXTENSIONS = new Set(['.xls', '.xlsx', '.ods']);

function getFileExtension(filename: string): string {
  const lower = String(filename || '').toLowerCase();
  const dotIndex = lower.lastIndexOf('.');
  return dotIndex >= 0 ? lower.slice(dotIndex) : '';
}

function getBestEffortTextSnippet(buffer: Buffer, maxChars: number = MAX_FILE_TEXT_SNIPPET): string {
  const sanitize = (text: string) =>
    text
      .replace(/\u0000/g, ' ')
      .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, maxChars);

  const utf8 = sanitize(buffer.toString('utf8'));
  if (utf8.length >= 80) return utf8;

  const latin1 = sanitize(buffer.toString('latin1'));
  if (latin1.length >= 80) return latin1;

  return '';
}

function extractSpreadsheetText(buffer: Buffer, maxChars: number = MAX_FILE_TEXT_SNIPPET * 2): string {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetTexts = workbook.SheetNames.slice(0, 3).map((sheetName) => {
      const worksheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(worksheet, {
        header: 1,
        raw: false,
        defval: ''
      }).slice(0, 100);

      const body = rows
        .map((row) => row
          .map((cell) => normalizeString(String(cell ?? '')))
          .filter(Boolean)
          .join('\t'))
        .filter(Boolean)
        .join('\n');

      return body ? `Sheet: ${sheetName}\n${body}` : '';
    }).filter(Boolean);

    return normalizeString(sheetTexts.join('\n\n')).slice(0, maxChars);
  } catch {
    return '';
  }
}

function inferStateFromText(value: string): string {
  const text = normalizeString(value).toUpperCase();
  if (!text) return '';

  const knownStates: Array<{ pattern: RegExp; state: string }> = [
    { pattern: /\bWP\s*KUALA\s*LUMPUR\b|\bW\.?P\.?\s*KUALA\s*LUMPUR\b|\bKUALA\s*LUMPUR\b|\bKL\b/i, state: 'Kuala Lumpur' },
    { pattern: /\bWP\s*PUTRAJAYA\b|\bW\.?P\.?\s*PUTRAJAYA\b|\bPUTRAJAYA\b/i, state: 'Putrajaya' },
    { pattern: /\bWP\s*LABUAN\b|\bW\.?P\.?\s*LABUAN\b|\bLABUAN\b/i, state: 'Labuan' },
    { pattern: /\bSELANGOR\b/i, state: 'Selangor' },
    { pattern: /\bJOHOR\b/i, state: 'Johor' },
    { pattern: /\bKEDAH\b/i, state: 'Kedah' },
    { pattern: /\bKELANTAN\b/i, state: 'Kelantan' },
    { pattern: /\bMELAKA\b|\bMALACCA\b/i, state: 'Melaka' },
    { pattern: /\bNEGERI\s*SEMBILAN\b|\bN\.?\s*SEMBILAN\b|\bN9\b/i, state: 'Negeri Sembilan' },
    { pattern: /\bPAHANG\b/i, state: 'Pahang' },
    { pattern: /\bPERAK\b/i, state: 'Perak' },
    { pattern: /\bPERLIS\b/i, state: 'Perlis' },
    { pattern: /\bPULAU\s*PINANG\b|\bPENANG\b/i, state: 'Pulau Pinang' },
    { pattern: /\bSABAH\b/i, state: 'Sabah' },
    { pattern: /\bSARAWAK\b/i, state: 'Sarawak' },
    { pattern: /\bTERENGGANU\b/i, state: 'Terengganu' }
  ];

  for (const item of knownStates) {
    if (item.pattern.test(text)) return item.state;
  }

  return '';
}

function inferStateFromDraft(draft: Partial<AssistantDraft>, rawContext: string = ''): string {
  const candidates = [
    draft.state,
    draft.districtAddress,
    draft.clientLocation,
    draft.remarks,
    draft.branchName,
    draft.clientName,
    draft.picName,
    rawContext
  ];

  for (const candidate of candidates) {
    const inferred = inferStateFromText(String(candidate || ''));
    if (inferred) return inferred;
  }

  return '';
}

function parsePicCell(value: string): Pick<AssistantDraft, 'picName' | 'picPhone'> {
  const text = normalizeString(value);
  if (!text) return {};

  const phoneMatch = text.match(/(0\d{1,2}[- ]?\d{6,8})/);
  const picPhone = phoneMatch ? normalizeString(phoneMatch[1]).replace(/\s+/g, '') : '';
  const picName = normalizeString(phoneMatch ? text.slice(0, phoneMatch.index).replace(/["'()]+/g, ' ') : text)
    .replace(/\s+/g, ' ');

  return {
    picName: picName || undefined,
    picPhone: picPhone || undefined
  };
}

function extractDraftsFromLooseText(raw: string, supportOptions: string[]): Partial<AssistantDraft>[] {
  const text = String(raw || '').replace(/```[\s\S]*?```/g, ' ').trim();
  if (!text) return [];

  const tabularRows = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/\t|\s{2,}|\s\|\s/).map((cell) => normalizeString(cell)).filter(Boolean))
    .filter((cells) => cells.length >= 3);

  const draftsFromRows = tabularRows.map((cells) => {
    const branchCell = cells[0];
    const locationCell = cells[1];
    const picCell = cells.slice(2).join(' ');
    const { picName, picPhone } = parsePicCell(picCell);
    const inferredState = inferStateFromText([locationCell, picCell, branchCell].join(' '));

    return {
      branchName: branchCell,
      clientName: branchCell.split(/CAWANGAN/i)[0]?.trim() || branchCell,
      clientLocation: locationCell,
      state: inferredState,
      picName,
      picPhone,
      supportType: resolveSupportTypeName('', supportOptions)
    } satisfies Partial<AssistantDraft>;
  }).filter((draft) => normalizeString(draft.clientLocation));

  if (draftsFromRows.length > 1) {
    return draftsFromRows.slice(0, 20);
  }

  const blocks = text
    .split(/\r?\n\s*\r?\n/)
    .map((block) => block.split(/\r?\n/).map((line) => normalizeString(line)).filter(Boolean))
    .filter((lines) => lines.length >= 3);

  const draftsFromBlocks = blocks.map((lines) => {
    const branchCell = lines[0];
    const locationCell = lines[1];
    const picCell = lines.slice(2).join(' ');
    const { picName, picPhone } = parsePicCell(picCell);
    const inferredState = inferStateFromText([locationCell, picCell, branchCell].join(' '));

    return {
      branchName: branchCell,
      clientName: branchCell.split(/CAWANGAN/i)[0]?.trim() || branchCell,
      clientLocation: locationCell,
      state: inferredState,
      picName,
      picPhone
    } satisfies Partial<AssistantDraft>;
  }).filter((draft) => normalizeString(draft.clientLocation));

  return draftsFromBlocks.slice(0, 20);
}

function extractJsonObject(raw: string): any {
  const trimmed = String(raw || '').trim();
  const stripped = trimmed
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  // Strategy 1: direct parse after stripping fences
  try { return JSON.parse(stripped); } catch {}

  // Strategy 2: greedy match from first { to last } then parse
  const greedy = stripped.match(/\{[\s\S]*\}/);
  if (greedy) {
    try { return JSON.parse(greedy[0]); } catch {}
  }

  // Strategy 3: char-by-char balanced bracket scan (most robust)
  for (let i = 0; i < stripped.length; i++) {
    if (stripped[i] !== '{') continue;
    let depth = 0, inString = false, escape = false;
    for (let j = i; j < stripped.length; j++) {
      const ch = stripped[j];
      if (escape) { escape = false; continue; }
      if (ch === '\\' && inString) { escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          try { return JSON.parse(stripped.slice(i, j + 1)); } catch {}
          break;
        }
      }
    }
  }

  throw new Error('JSON response tidak sah. Sila cuba semula.');
}

async function getGeminiApiKey(): Promise<string | null> {
  try {
    if (!AppDataSource.isInitialized) return null;
    const repo = AppDataSource.getRepository(SystemSettings);
    const setting = await repo.findOne({ where: { setting_key: 'gemini_api_key', is_active: true } });
    if (!setting?.setting_value) return null;
    return decrypt(setting.setting_value) ?? setting.setting_value;
  } catch {
    return null;
  }
}

function parseJsonField<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeLinks(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => normalizeString(item))
    .filter(Boolean)
    .slice(0, 10);
}

function normalizeEquipmentTypes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => normalizeString(item).toUpperCase())
    .filter(Boolean)
    .slice(0, 10);
}

function normalizeDraft(input: Partial<AssistantDraft> | null | undefined): AssistantDraft {
  const draft = input || {};
  const parsedOfferPrice = Number(draft.offerPrice);

  return {
    title: normalizeString(draft.title),
    description: normalizeString(draft.description),
    supportType: normalizeString(draft.supportType),
    clientLocation: normalizeString(draft.clientLocation),
    districtAddress: normalizeString(draft.districtAddress),
    state: normalizeString(draft.state),
    deadline: normalizeString(draft.deadline),
    offerPrice: Number.isFinite(parsedOfferPrice) && parsedOfferPrice > 0 ? parsedOfferPrice : '',
    remarks: normalizeString(draft.remarks),
    mainConId: typeof draft.mainConId === 'number' && draft.mainConId > 0 ? draft.mainConId : null,
    mainConName: normalizeString(draft.mainConName),
    picName: normalizeString(draft.picName),
    picPhone: normalizeString(draft.picPhone),
    clientName: normalizeString(draft.clientName),
    assetTagId: normalizeString(draft.assetTagId),
    assetBrand: normalizeString(draft.assetBrand),
    assetModel: normalizeString(draft.assetModel),
    assetSerialNumber: normalizeString(draft.assetSerialNumber),
    branchName: normalizeString(draft.branchName),
    equipmentTypes: normalizeEquipmentTypes(draft.equipmentTypes),
    links: normalizeLinks(draft.links),
    projectId: typeof draft.projectId === 'number' && draft.projectId > 0 ? draft.projectId : null,
    projectName: normalizeString(draft.projectName)
  };
}

function mergeDraft(currentDraft: AssistantDraft, incomingDraft: Partial<AssistantDraft> | null | undefined): AssistantDraft {
  const current = normalizeDraft(currentDraft);
  const incoming = normalizeDraft(incomingDraft);
  return {
    ...current,
    ...Object.fromEntries(
      Object.entries(incoming).filter(([_, value]) => {
        if (Array.isArray(value)) return value.length > 0;
        if (typeof value === 'number') return value > 0;
        return String(value || '').trim().length > 0;
      })
    ),
    equipmentTypes: incoming.equipmentTypes && incoming.equipmentTypes.length > 0 ? incoming.equipmentTypes : current.equipmentTypes || [],
    links: incoming.links && incoming.links.length > 0 ? incoming.links : current.links || []
  };
}

function resolveSupportTypeName(value: string, options: string[]): string {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return '';

  const exact = options.find((option) => option.toLowerCase() === normalized);
  if (exact) return exact;

  const partial = options.find((option) => option.toLowerCase().includes(normalized) || normalized.includes(option.toLowerCase()));
  return partial || value.trim();
}

function tokenizeText(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gi, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
}

function findBestSupportTypeMatch(value: string, options: string[]): string {
  const normalizedValue = normalizeString(value).toLowerCase();
  if (!normalizedValue || options.length === 0) return '';

  const directMatch = resolveSupportTypeName(normalizedValue, options);
  if (directMatch && directMatch.toLowerCase() !== normalizedValue) {
    return directMatch;
  }

  const tokens = tokenizeText(normalizedValue);
  if (tokens.length === 0) return directMatch || '';

  let bestOption = '';
  let bestScore = 0;

  for (const option of options) {
    const normalizedOption = option.toLowerCase();
    const score = tokens.reduce((total, token) => total + (normalizedOption.includes(token) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      bestOption = option;
    }
  }

  return bestScore > 0 ? bestOption : (directMatch || '');
}

function inferSupportTypeFromConversation(
  message: string,
  history: ChatMessage[],
  options: string[],
  currentSupportType: string
): string {
  const existing = resolveSupportTypeName(currentSupportType || '', options);
  if (existing && options.some((option) => option.toLowerCase() === existing.toLowerCase())) {
    return existing;
  }

  const latestAssistantPrompt = [...history]
    .reverse()
    .find((item) => item.role === 'assistant' && /jenis sokongan|support type/i.test(item.content || ''));

  const directFromMessage = findBestSupportTypeMatch(message, options);
  if (directFromMessage) {
    return directFromMessage;
  }

  if (latestAssistantPrompt) {
    const lastUserAnswer = [...history]
      .reverse()
      .find((item) => item.role === 'user' && normalizeString(item.content));
    const contextualMatch = findBestSupportTypeMatch(lastUserAnswer?.content || message, options);
    if (contextualMatch) {
      return contextualMatch;
    }
  }

  return existing || currentSupportType;
}

function isRequiredAssetSupportTypeName(value: string): boolean {
  const normalized = normalizeString(value).toLowerCase();
  const isAddHoc = normalized.includes('adhoc') || normalized.includes('ad-hoc') || (normalized.includes('add') && normalized.includes('hoc'));
  return normalized.includes('corrective') || isAddHoc;
}

function isNonAssetSupportTypeNameForAI(value: string): boolean {
  const normalized = normalizeString(value).toLowerCase();
  return normalized.includes('deployment') || normalized.includes('preventive') || normalized.includes('preventif');
}

function hasAssetIdentifier(draft: AssistantDraft): boolean {
  return Boolean(normalizeString(draft.assetTagId) || normalizeString(draft.assetSerialNumber));
}

function getMissingFields(draft: AssistantDraft): string[] {
  const missing = REQUIRED_FIELDS
    .filter((field) => {
      const value = draft[field];
      if (typeof value === 'number') return !(value > 0);
      return !String(value || '').trim();
    })
    .map((field) => FIELD_LABELS[field]);

  if (isRequiredAssetSupportTypeName(draft.supportType || '') && !hasAssetIdentifier(draft)) {
    missing.push(ASSET_IDENTIFIER_LABEL);
  }

  if (isNonAssetSupportTypeNameForAI(draft.supportType || '') && !(draft.projectId && draft.projectId > 0)) {
    missing.push(FIELD_LABELS.projectId);
  }

  return missing;
}

function buildFallbackReply(missingFields: string[], warnings: string[]): string {
  if (missingFields.length === 0) {
    return warnings.length > 0
      ? `Maklumat utama dah cukup. Saya dah sediakan draf tugasan. Nota: ${warnings.join(' ')}`
      : 'Maklumat utama dah cukup. Saya dah sediakan draf tugasan untuk anda semak sebelum create.';
  }

  const question = `Saya masih perlukan ${missingFields.join(', ')} sebelum boleh create task.`;
  return warnings.length > 0 ? `${question} Nota fail: ${warnings.join(' ')}` : question;
}

function extractGeminiText(responseData: any): string {
  const parts = responseData?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';

  return parts
    .map((part: any) => (typeof part?.text === 'string' ? part.text : ''))
    .join('\n')
    .trim();
}

function getGeminiErrorMessage(error: any): string {
  return error?.response?.data?.error?.message || error?.message || 'Unknown Gemini error';
}

async function generateWithGemini(apiKey: string, model: string, parts: any[]): Promise<string> {
  try {
    const response = await axios.post(
      `${GEMINI_API_URL}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        contents: [{ role: 'user', parts }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS
        }
      },
      {
        timeout: GEMINI_TIMEOUT_MS,
        headers: { 'Content-Type': 'application/json' }
      }
    );

    const text = extractGeminiText(response.data);
    if (!text) {
      throw new Error(`Model ${model} memberikan respon kosong.`);
    }

    return text;
  } catch (error: any) {
    throw new Error(`Gemini model ${model} gagal: ${getGeminiErrorMessage(error)}`);
  }
}

async function repairJsonWithGemini(apiKey: string, model: string, raw: string): Promise<any | null> {
  try {
    const repairPrompt =
      'Baiki respons berikut menjadi SATU JSON object yang sah. ' +
      'Balas JSON sahaja tanpa markdown atau teks tambahan. ' +
      'Kekalkan maksud asal dan jangan tambah fakta baru.';

    const repairedRaw = await generateWithGemini(apiKey, model, [
      { text: repairPrompt },
      { text: `RESPONS_ASAL:\n${String(raw || '').slice(0, MAX_FILE_TEXT_SNIPPET)}` }
    ]);

    return tryExtractJsonObject(repairedRaw);
  } catch (error) {
    console.warn('AI task JSON repair gagal:', error);
    return null;
  }
}

export class AITaskAssistantController {
  private mainConRepository = AppDataSource.getRepository(MainCon);
  private supportTypeRepository = AppDataSource.getRepository(SupportTypeOption);
  private equipmentCodeRepository = AppDataSource.getRepository(EquipmentCode);
  private projectRepository = AppDataSource.getRepository(Project);

  private async getCachedOptions(): Promise<CachedAssistantOptions> {
    const now = Date.now();
    if (optionsCache && optionsCache.expiresAt > now) {
      return optionsCache.value;
    }

    const [supportTypes, mainCons, equipmentCodes, projects] = await Promise.all([
      this.supportTypeRepository.find(),
      this.mainConRepository.find({ where: { is_active: true } }),
      this.equipmentCodeRepository.find(),
      this.projectRepository.find({ where: { status: ProjectStatus.AKTIF }, order: { name: 'ASC' } })
    ]);

    const supportTypeNames = supportTypes.map((item) => item.name).filter(Boolean);
    const value: CachedAssistantOptions = {
      supportTypeNames,
      mainConOptions: mainCons.map((item) => ({ id: item.id, name: item.name })),
      equipmentOptions: equipmentCodes.map((item) => item.code).filter(Boolean),
      projectOptions: projects.map((item) => ({
        id: item.id,
        code: item.code,
        name: item.name,
        clientName: item.client_name || '',
        mainConId: item.main_con_id || null
      }))
    };

    optionsCache = {
      expiresAt: now + OPTIONS_CACHE_MS,
      value
    };

    return value;
  }

  chat = async (req: Request, res: Response): Promise<void> => {
    const apiKey = await getGeminiApiKey();
    const configuredModel = await getGeminiModelFromSettings();
    if (!apiKey) {
      res.status(503).json({
        success: false,
        message: 'Gemini API key belum dikonfigurasi. Pergi ke Tetapan → Integrasi AI dahulu.'
      });
      return;
    }

    const message = normalizeString(req.body?.message);
    const currentDraft = normalizeDraft(parseJsonField<AssistantDraft>(req.body?.draft, {} as AssistantDraft));
    const history = parseJsonField<ChatMessage[]>(req.body?.history, [])
      .slice(-MAX_HISTORY_ITEMS)
      .map((item) => ({
        role: item?.role === 'assistant' ? 'assistant' : 'user',
        content: normalizeString(item?.content).slice(0, MAX_HISTORY_CHARS)
      })) as ChatMessage[];
    const files = ((req.files as Express.Multer.File[]) || []).slice(0, MAX_FILES);

    if (!message && files.length === 0 && getMissingFields(currentDraft).length === REQUIRED_FIELDS.length) {
      res.status(400).json({
        success: false,
        message: 'Arahan atau fail diperlukan untuk mula.'
      });
      return;
    }

    const { supportTypeNames, mainConOptions, equipmentOptions, projectOptions } = await this.getCachedOptions();
    const effectiveSupportTypeNames = supportTypeNames.length > 0 ? supportTypeNames : DEFAULT_SUPPORT_TYPE_NAMES;
    const promptProjectOptions = this.pickPromptProjects(projectOptions, message, currentDraft);
    const warnings: string[] = [];
    const fallbackSourceParts: string[] = [message];

    const parts: Array<any> = [];
    parts.push({
      text:
        'Balas JSON SAHAJA tanpa markdown. Skema: {reply,draft,drafts,warnings}. ' +
        'Field wajib: supportType, clientLocation, state. Add-Hoc/Corrective wajib assetTagId atau assetSerialNumber. PM/Deployment wajib projectId. ' +
        'Field optional (jangan paksa tanya): title, description, deadline, offerPrice, picName, picPhone, clientName, branchName, districtAddress. ' +
        'Jangan minta title (sistem auto-generate). ' +
        'Jika PM/Deployment + projectId belum ada, reply mesti senarai projek untuk dipilih. ' +
        'Jika user beri banyak lokasi, bina satu item per lokasi dalam drafts dan kongsi projectId/supportType/mainConId. ' +
        'Guna fuzzy matching untuk padankan supportType/mainCon/project. Bahasa reply: BM ringkas.'
    });
    parts.push({ text: `Draf semasa: ${JSON.stringify(currentDraft)}` });
    parts.push({ text: `Mesej terbaru user: ${message || '(tiada mesej tambahan)'}` });
    parts.push({ text: `Sejarah ringkas: ${JSON.stringify(history)}` });
    parts.push({ text: `Support type sah: ${JSON.stringify(effectiveSupportTypeNames)}` });
    parts.push({ text: `Main con sah: ${JSON.stringify(mainConOptions)}` });
    parts.push({ text: `Kod peralatan sah: ${JSON.stringify(equipmentOptions)}` });
    parts.push({ text: `Projek aktif sah (subset ${promptProjectOptions.length}/${projectOptions.length}): ${JSON.stringify(promptProjectOptions)}` });
    parts.push({
      text:
        'Pulangkan JSON padat. Jangan isi field kosong yang tiada data.'
    });

    for (const file of files) {
      const mime = file.mimetype || 'application/octet-stream';
      const ext = getFileExtension(file.originalname);
      const isInlineSupported = mime.startsWith('image/') || INLINE_FILE_MIME_TYPES.has(mime) || INLINE_FILE_EXTENSIONS.has(ext);
      const isTextSupported = TEXT_FILE_MIME_TYPES.has(mime) || TEXT_FILE_EXTENSIONS.has(ext);
      const isSpreadsheetSupported = SPREADSHEET_FILE_MIME_TYPES.has(mime) || SPREADSHEET_FILE_EXTENSIONS.has(ext);

      parts.push({ text: `Fail dilampirkan: ${file.originalname} (${mime}), saiz ${file.size} bytes` });

      if (isSpreadsheetSupported) {
        const spreadsheetText = extractSpreadsheetText(file.buffer);
        if (spreadsheetText) {
          parts.push({ text: `Kandungan jadual fail ${file.originalname}:\n${spreadsheetText}` });
          fallbackSourceParts.push(spreadsheetText);
        } else {
          warnings.push(`Fail ${file.originalname} diterima, tetapi kandungan spreadsheet tidak dapat diekstrak dengan jelas.`);
        }
        continue;
      }

      if (isInlineSupported) {
        parts.push({
          inlineData: {
            data: file.buffer.toString('base64'),
            mimeType: mime
          }
        });
        fallbackSourceParts.push(`Imej/fail: ${file.originalname}`);
        continue;
      }

      if (isTextSupported) {
        const textSnippet = file.buffer.toString('utf8').slice(0, MAX_FILE_TEXT_SNIPPET);
        parts.push({ text: `Kandungan fail ${file.originalname} (${mime}):\n${textSnippet}` });
        fallbackSourceParts.push(textSnippet);
        continue;
      }

      const bestEffortText = getBestEffortTextSnippet(file.buffer, MAX_FILE_TEXT_SNIPPET);
      if (bestEffortText) {
        parts.push({ text: `Ekstrak best-effort fail ${file.originalname} (${mime}):\n${bestEffortText}` });
        fallbackSourceParts.push(bestEffortText);
      } else {
        warnings.push(`Fail ${file.originalname} diterima, tetapi kandungan teks tidak dapat diekstrak dengan jelas. Sila tambah ringkasan isi penting dalam chat.`);
      }
    }

    try {
      const responseText = await generateWithGemini(apiKey, configuredModel, parts);
      const directParsedJson = tryExtractJsonObject(responseText);
      let repairUsed = false;
      let parsedJson = directParsedJson;
      if (!parsedJson && ENABLE_JSON_REPAIR) {
        parsedJson = await repairJsonWithGemini(apiKey, configuredModel, responseText);
        repairUsed = Boolean(parsedJson);
      }
      const fallbackSourceText = fallbackSourceParts.filter(Boolean).join('\n\n');
      const fallbackDraft = extractDraftFromLooseText(responseText || fallbackSourceText, effectiveSupportTypeNames);
      const fallbackDrafts = extractDraftsFromLooseText(fallbackSourceText || responseText, effectiveSupportTypeNames);
      const hasFallbackDraft = Object.values(fallbackDraft).some((value) => {
        if (Array.isArray(value)) return value.length > 0;
        if (typeof value === 'number') return value > 0;
        return Boolean(normalizeString(value));
      });

      const parsed = parsedJson || (fallbackDrafts.length > 0 || hasFallbackDraft ? {
        reply: '',
        draft: fallbackDraft,
        drafts: fallbackDrafts,
        warnings: ['Respons AI diterima dalam format ringkas. Data draf diekstrak setakat yang dapat dibaca.']
      } : null);

      const rawDrafts = pickParsedDrafts(parsed);

      const normalizedDrafts = rawDrafts
        .filter((item: any) => item && typeof item === 'object')
        .slice(0, 20)
        .map((item: any) => {
          const merged = mergeDraft(currentDraft, item);
          merged.supportType = inferSupportTypeFromConversation(
            message,
            history,
            effectiveSupportTypeNames,
            merged.supportType || currentDraft.supportType || ''
          );
          if (typeof item?.mainConId !== 'number') {
            merged.mainConId = currentDraft.mainConId || null;
          }
          if (!normalizeString(merged.state)) {
            merged.state = inferStateFromDraft(merged, fallbackSourceText);
          }
          return merged;
        });

      const aiDraft = normalizedDrafts[0] || mergeDraft(currentDraft, pickParsedDraft(parsed));
      aiDraft.supportType = inferSupportTypeFromConversation(
        message,
        history,
        effectiveSupportTypeNames,
        aiDraft.supportType || currentDraft.supportType || ''
      );

      const parsedMainConId = pickParsedDraft(parsed)?.mainConId;
      if (typeof parsedMainConId !== 'number' && !normalizedDrafts[0]) {
        aiDraft.mainConId = currentDraft.mainConId || null;
      }
      if (!normalizeString(aiDraft.state)) {
        aiDraft.state = inferStateFromDraft(aiDraft, fallbackSourceText);
      }

      const parsedWarnings = pickParsedWarnings(parsed);
      const mergedWarnings = [
        ...warnings,
        ...parsedWarnings,
        ...(parsed ? [] : ['Respons AI diterima dalam format ringkas. Data draf diekstrak setakat yang dapat dibaca.'])
      ];

      if (normalizeString(aiDraft.assetModel) && !normalizeString(aiDraft.assetBrand)) {
        const intel = await inferAndCacheModelIntel({
          model: aiDraft.assetModel,
          serial: aiDraft.assetSerialNumber,
          allowInternet: true,
          allowAi: true
        });
        if (intel?.brand?.name && intel.brand.confidence >= 0.6) {
          aiDraft.assetBrand = String(intel.brand.name);
          mergedWarnings.push(`Cadangan AI jenama aset: ${intel.brand.name} (confidence ${intel.brand.confidence.toFixed(2)}).`);
        }
        if (intel?.category?.name && intel.category.confidence >= 0.6) {
          const catUpper = String(intel.category.name).toUpperCase();
          const current = Array.isArray(aiDraft.equipmentTypes) ? aiDraft.equipmentTypes : [];
          if (!current.includes(catUpper)) {
            aiDraft.equipmentTypes = [...current, catUpper].slice(0, 10);
            mergedWarnings.push(`Cadangan AI kategori aset: ${intel.category.name} (confidence ${intel.category.confidence.toFixed(2)}).`);
          }
        }
      }

      const missingFields = getMissingFields(aiDraft);
      const isComplete = missingFields.length === 0;
      const reply = pickParsedReply(parsed)
        || buildFallbackReply(missingFields, mergedWarnings);
      const parseSource = parsed
        ? (repairUsed ? 'repair' : 'direct')
        : 'fallback_text';

      res.json({
        success: true,
        data: {
          reply,
          draft: aiDraft,
          drafts: normalizedDrafts.length > 0 ? normalizedDrafts : [aiDraft],
          missingFields,
          warnings: mergedWarnings,
          isComplete,
          repairUsed,
          parseSource
        }
      });
    } catch (error: any) {
      console.error('AI task assistant error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Gagal memproses arahan AI.'
      });
    }
  };

  private pickPromptProjects(projectOptions: ProjectOption[], message: string, currentDraft: AssistantDraft): ProjectOption[] {
    if (projectOptions.length <= MAX_PROJECT_OPTIONS_IN_PROMPT) {
      return projectOptions;
    }

    const seedText = [
      message,
      currentDraft.projectName,
      currentDraft.clientName,
      currentDraft.clientLocation,
      currentDraft.branchName
    ].join(' ');

    const tokens = tokenizeText(seedText).slice(0, 20);
    if (tokens.length === 0) {
      return projectOptions.slice(0, MAX_PROJECT_OPTIONS_IN_PROMPT);
    }

    const scored = projectOptions
      .map((project) => {
        const haystack = `${project.code} ${project.name} ${project.clientName}`.toLowerCase();
        const score = tokens.reduce((total, token) => total + (haystack.includes(token) ? 1 : 0), 0);
        return { project, score };
      })
      .sort((a, b) => b.score - a.score || a.project.name.localeCompare(b.project.name));

    const prioritized = scored.filter((item) => item.score > 0);
    const source = prioritized.length >= 5 ? prioritized : scored;
    return source.slice(0, MAX_PROJECT_OPTIONS_IN_PROMPT).map((item) => item.project);
  }
}

async function getGeminiModelFromSettings(): Promise<string> {
  try {
    if (!AppDataSource.isInitialized) return DEFAULT_GEMINI_MODEL;

    const repo = AppDataSource.getRepository(SystemSettings);
    const setting = await repo.findOne({ where: { setting_key: 'gemini_model', is_active: true } });
    const model = String(setting?.setting_value || DEFAULT_GEMINI_MODEL).trim();
    return model.replace(/^models\//, '') || DEFAULT_GEMINI_MODEL;
  } catch {
    return DEFAULT_GEMINI_MODEL;
  }
}

function tryExtractJsonObject(raw: string): any | null {
  try {
    return extractJsonObject(raw);
  } catch {
    return null;
  }
}

const DRAFT_FIELD_KEYS: Array<keyof AssistantDraft> = [
  'title',
  'description',
  'supportType',
  'clientLocation',
  'districtAddress',
  'state',
  'deadline',
  'offerPrice',
  'remarks',
  'mainConId',
  'mainConName',
  'picName',
  'picPhone',
  'clientName',
  'assetTagId',
  'assetBrand',
  'assetModel',
  'assetSerialNumber',
  'branchName',
  'equipmentTypes',
  'links',
  'projectId',
  'projectName'
];

function toIsoDate(value: string): string {
  const text = normalizeString(value);
  if (!text) return '';

  const iso = text.match(/\b(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})\b/);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    const day = Number(iso[3]);
    if (year >= 2000 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  const dmy = text.match(/\b(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})\b/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = Number(dmy[3]);
    if (year >= 2000 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  return '';
}

function parseLooseOfferPrice(value: string): number | '' {
  const cleaned = normalizeString(value)
    .replace(/rm/gi, '')
    .replace(/,/g, '')
    .replace(/\s+/g, ' ');
  const match = cleaned.match(/(\d+(?:\.\d{1,2})?)/);
  if (!match) return '';
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : '';
}

function mapLooseKeyToDraftField(key: string): keyof AssistantDraft | null {
  const normalized = normalizeString(key).toLowerCase();
  if (!normalized) return null;

  if (/^tajuk|title/.test(normalized)) return 'title';
  if (/deskripsi|keterangan|penerangan|description/.test(normalized)) return 'description';
  if (/jenis\s*sokongan|support\s*type|kategori\s*sokongan/.test(normalized)) return 'supportType';
  if (/lokasi\s*klien|lokasi\s*client|lokasi\b|client\s*location/.test(normalized)) return 'clientLocation';
  if (/bandar|alamat\s*daerah|district\s*address|daerah/.test(normalized)) return 'districtAddress';
  if (/negeri|state/.test(normalized)) return 'state';
  if (/tarikh\s*keperluan|deadline|due\s*date|tarikh/.test(normalized)) return 'deadline';
  if (/harga|price|budget|offer\s*price/.test(normalized)) return 'offerPrice';
  if (/remarks|catatan|nota/.test(normalized)) return 'remarks';
  if (/nama\s*pic|pic\s*name/.test(normalized)) return 'picName';
  if (/telefon\s*pic|phone\s*pic|pic\s*phone/.test(normalized)) return 'picPhone';
  if (/nama\s*klien|client\s*name/.test(normalized)) return 'clientName';
  if (/cawangan|branch/.test(normalized)) return 'branchName';
  if (/projek\b|project\b/.test(normalized)) return 'projectName';

  return null;
}

function extractDraftFromLooseText(raw: string, supportOptions: string[]): Partial<AssistantDraft> {
  const draft: Partial<AssistantDraft> = {};
  const text = String(raw || '').replace(/```[\s\S]*?```/g, ' ');
  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    const match = line.match(/^\s*[-*\d.)\s]*"?([A-Za-zÀ-ÿ0-9_\s\/()-]+)"?\s*[:=-]\s*(.+?)\s*$/);
    if (!match) continue;

    const key = mapLooseKeyToDraftField(match[1]);
    if (!key) continue;
    const value = normalizeString(match[2]);
    if (!value) continue;

    if (key === 'offerPrice') {
      const parsedPrice = parseLooseOfferPrice(value);
      if (parsedPrice !== '') draft.offerPrice = parsedPrice;
      continue;
    }

    if (key === 'deadline') {
      const parsedDate = toIsoDate(value);
      if (parsedDate) draft.deadline = parsedDate;
      continue;
    }

    if (key === 'supportType') {
      draft.supportType = resolveSupportTypeName(value, supportOptions);
      continue;
    }

    (draft as any)[key] = value as any;
  }

  if (!draft.offerPrice) {
    draft.offerPrice = parseLooseOfferPrice(text);
  }

  if (!draft.deadline) {
    draft.deadline = toIsoDate(text);
  }

  if (!draft.links) {
    const links = Array.from(text.matchAll(/https?:\/\/[^\s)]+/gi)).map((item) => normalizeString(item[0]));
    if (links.length > 0) {
      draft.links = normalizeLinks(links);
    }
  }

  if (!normalizeString(draft.state)) {
    const inferredState = inferStateFromDraft(draft, text);
    if (inferredState) {
      draft.state = inferredState;
    }
  }

  return draft;
}

function pickDraftFields(candidate: any): Partial<AssistantDraft> {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return {};
  if (!DRAFT_FIELD_KEYS.some((key) => key in candidate)) return {};

  const picked: Partial<AssistantDraft> = {};
  for (const key of DRAFT_FIELD_KEYS) {
    if (key in candidate) {
      (picked as any)[key] = candidate[key];
    }
  }
  return picked;
}

function pickParsedDraft(parsed: any): Partial<AssistantDraft> {
  if (!parsed || typeof parsed !== 'object') return {};

  const candidates: any[] = [
    parsed?.draft,
    parsed?.task,
    parsed?.data?.draft,
    parsed?.data,
    parsed
  ];

  for (const candidate of candidates) {
    const picked = pickDraftFields(candidate);
    if (Object.keys(picked).length > 0) return picked;
  }

  return {};
}

function pickParsedDrafts(parsed: any): any[] {
  if (!parsed || typeof parsed !== 'object') return [];

  const sources = [parsed?.drafts, parsed?.tasks, parsed?.data?.drafts];
  for (const source of sources) {
    if (!Array.isArray(source)) continue;
    return source
      .map((item: any) => pickDraftFields(item))
      .filter((item: Partial<AssistantDraft>) => Object.keys(item).length > 0)
      .slice(0, 20);
  }

  return [];
}

function pickParsedWarnings(parsed: any): string[] {
  if (!parsed || typeof parsed !== 'object') return [];
  const sources = [parsed?.warnings, parsed?.data?.warnings];
  for (const source of sources) {
    if (Array.isArray(source)) {
      return source
        .map((item: any) => normalizeString(item))
        .filter(Boolean)
        .slice(0, 20);
    }
  }
  return [];
}

function pickParsedReply(parsed: any): string {
  if (!parsed || typeof parsed !== 'object') return '';
  return normalizeString(parsed?.reply)
    || normalizeString(parsed?.nextQuestion)
    || normalizeString(parsed?.data?.reply)
    || normalizeString(parsed?.message);
}
