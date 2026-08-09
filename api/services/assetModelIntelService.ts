import axios from 'axios';
import { AppDataSource } from '../config/database.ts';
import { AssetBrandOption } from '../models/AssetBrandOption.ts';
import { AssetCategoryOption } from '../models/AssetCategoryOption.ts';
import { AssetModelIntel } from '../models/AssetModelIntel.ts';
import { Asset } from '../models/Asset.ts';
import { SystemSettings } from '../models/SystemSettings.ts';
import { decrypt } from '../utils/encryption.ts';

const GEMINI_API_URL = process.env.GEMINI_API_URL || 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_GEMINI_MODEL = (process.env.GEMINI_MODEL || 'gemini-2.5-flash').replace(/^models\//, '');

export type ModelIntelResult = {
  model_raw?: string | null;
  model_norm: string;
  serial_norm?: string | null;
  brand?: { id?: number | null; name?: string | null; confidence: number };
  category?: { id?: number | null; name?: string | null; confidence: number };
  confidence_overall: number;
  sources: Array<'cache' | 'db' | 'internet' | 'ai'>;
  evidence: {
    db?: any;
    internet?: any;
    ai?: any;
  };
};

function normalizeUpper(v: unknown): string {
  return String(v || '').trim().toUpperCase();
}

export function normalizeSerial(value: unknown): string {
  return normalizeUpper(value).replace(/\s+/g, '').replace(/O/g, '0');
}

export function normalizeModel(value: unknown): string {
  const raw = normalizeUpper(value);
  if (!raw) return '';
  const cleaned = raw
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const fixes: Array<[RegExp, string]> = [
    [/\bLAITITUDE\b/g, 'LATITUDE'],
    [/\bLATITUTE\b/g, 'LATITUDE'],
    [/\bLATTITUDE\b/g, 'LATITUDE'],
    [/\bHP\s+INC\b/g, 'HP'],
    [/\bHEWLETT\s+PACKARD\b/g, 'HP'],
    [/\bLENOV0\b/g, 'LENOVO']
  ];

  return fixes.reduce((acc, [re, rep]) => acc.replace(re, rep), cleaned);
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function pickBest<T extends { name: string; score: number }>(candidates: T[]): T | null {
  if (!candidates.length) return null;
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0] || null;
}

async function getGeminiApiKey(): Promise<string | null> {
  try {
    if (!AppDataSource.isInitialized) return null;
    const repo = AppDataSource.getRepository(SystemSettings);
    const s = await repo.findOne({ where: { setting_key: 'gemini_api_key', is_active: true } });
    if (!s?.setting_value) return null;
    return decrypt(s.setting_value) ?? s.setting_value;
  } catch {
    return null;
  }
}

async function getGeminiModel(): Promise<string> {
  try {
    if (!AppDataSource.isInitialized) return DEFAULT_GEMINI_MODEL;
    const repo = AppDataSource.getRepository(SystemSettings);
    const s = await repo.findOne({ where: { setting_key: 'gemini_model', is_active: true } });
    return String(s?.setting_value || DEFAULT_GEMINI_MODEL).trim().replace(/^models\//, '') || DEFAULT_GEMINI_MODEL;
  } catch {
    return DEFAULT_GEMINI_MODEL;
  }
}

async function generateWithGemini(apiKey: string, model: string, prompt: string): Promise<string> {
  const url = `${GEMINI_API_URL}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const payload = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 600 }
  };
  const response = await axios.post(url, payload, { timeout: 45000, headers: { 'Content-Type': 'application/json' } });
  return String(response.data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || '').join('\n') || '').trim();
}

async function inferFromDb(modelNorm: string): Promise<{ brand?: any; category?: any; evidence: any }> {
  const evidence: any = {};
  const brandRepo = AppDataSource.getRepository(AssetBrandOption);
  const categoryRepo = AppDataSource.getRepository(AssetCategoryOption);
  const assetRepo = AppDataSource.getRepository(Asset);

  const [brands, categories] = await Promise.all([
    brandRepo.find({ where: { is_active: true } }),
    categoryRepo.find({ where: { is_active: true } })
  ]);

  const brandCandidates = brands
    .map((b) => {
      const bn = normalizeUpper(b.name);
      if (!bn) return null;
      const hit = modelNorm.includes(bn);
      const score = hit ? clamp01(Math.min(1, bn.length / Math.max(10, modelNorm.length))) : 0;
      return hit ? { id: b.id, name: b.name, score } : null;
    })
    .filter(Boolean) as Array<{ id: number; name: string; score: number }>;

  const bestBrand = pickBest(brandCandidates);
  if (bestBrand) evidence.brand_match = bestBrand;

  const categoryKeywords: Array<{ key: string; alias: string[] }> = [
    { key: 'desktop', alias: ['DESKTOP', 'CPU', 'PC', 'OPTIPLEX', 'TOWER', 'WORKSTATION'] },
    { key: 'laptop', alias: ['LAPTOP', 'NOTEBOOK', 'ULTRABOOK', 'LATITUDE', 'THINKPAD', 'ELITEBOOK', 'MACBOOK'] },
    { key: 'server', alias: ['SERVER', 'POWEREDGE', 'PROLIANT', 'RACK', 'DELL EMC'] },
    { key: 'printer', alias: ['PRINTER', 'LASERJET', 'DESKJET', 'INKJET', 'MFP', 'PENCETAK'] },
    { key: 'monitor', alias: ['MONITOR', 'DISPLAY', 'LCD', 'LED'] }
  ];

  const categoryByPattern = categoryKeywords
    .map((c) => ({
      key: c.key,
      score: c.alias.some((a) => modelNorm.includes(a)) ? 0.7 : 0
    }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)[0];

  let bestCategory: { id?: number; name?: string; confidence: number } | undefined;
  if (categoryByPattern) {
    const mapped = categories.find((x) => normalizeUpper(x.name) === normalizeUpper(categoryByPattern.key));
    bestCategory = {
      id: mapped?.id ?? null,
      name: mapped?.name ?? categoryByPattern.key,
      confidence: categoryByPattern.score
    };
    evidence.category_pattern = categoryByPattern;
  }

  const tokens = modelNorm.split(/\s+/).filter((t) => t.length >= 4).slice(0, 3);
  if (tokens.length) {
    const like = `%${tokens[0]}%`;
    const rows = await assetRepo.find({
      where: { model: like as any },
      select: ['brand_id', 'category_id'] as any,
      take: 50
    });
    const brandFreq = new Map<number, number>();
    const catFreq = new Map<number, number>();
    rows.forEach((r: any) => {
      if (r.brand_id) brandFreq.set(r.brand_id, (brandFreq.get(r.brand_id) || 0) + 1);
      if (r.category_id) catFreq.set(r.category_id, (catFreq.get(r.category_id) || 0) + 1);
    });
    const topBrand = Array.from(brandFreq.entries()).sort((a, b) => b[1] - a[1])[0];
    const topCat = Array.from(catFreq.entries()).sort((a, b) => b[1] - a[1])[0];
    evidence.historical = { tokens, sampleSize: rows.length, topBrand, topCat };

    if (!bestBrand && topBrand) {
      const b = brands.find((x) => x.id === topBrand[0]);
      if (b) {
        evidence.brand_historical = { id: b.id, name: b.name, count: topBrand[1] };
      }
    }

    if (!bestCategory && topCat) {
      const c = categories.find((x) => x.id === topCat[0]);
      if (c) {
        bestCategory = { id: c.id, name: c.name, confidence: clamp01(topCat[1] / Math.max(1, rows.length)) };
        evidence.category_historical = { id: c.id, name: c.name, count: topCat[1] };
      }
    }
  }

  return {
    brand: bestBrand ? { id: bestBrand.id, name: bestBrand.name, confidence: clamp01(bestBrand.score) } : undefined,
    category: bestCategory,
    evidence
  };
}

async function inferFromInternet(modelNorm: string, knownBrands: string[]): Promise<{ brand?: any; category?: any; evidence: any } | null> {
  const evidence: any = {};
  const q = encodeURIComponent(`${modelNorm} specs`);
  const ddgUrl = `https://api.duckduckgo.com/?q=${q}&format=json&no_redirect=1&no_html=1&skip_disambig=1`;
  try {
    const ddg = await axios.get(ddgUrl, { timeout: 8000 });
    const text = String(ddg.data?.AbstractText || ddg.data?.Heading || '').trim();
    evidence.ddg = { heading: ddg.data?.Heading || null, abstract: text.slice(0, 400) };

    const hay = normalizeUpper(text);
    const brandHit = knownBrands.find((b) => hay.includes(normalizeUpper(b)));
    const categoryHit = ['LAPTOP', 'NOTEBOOK', 'DESKTOP', 'SERVER', 'PRINTER', 'MONITOR'].find((k) => hay.includes(k));

    return {
      brand: brandHit ? { name: brandHit, confidence: 0.55 } : undefined,
      category: categoryHit ? { name: categoryHit.toLowerCase(), confidence: 0.55 } : undefined,
      evidence
    };
  } catch (e) {
    return null;
  }
}

async function inferWithAi(modelNorm: string, contextText: string): Promise<{ brand?: any; category?: any; evidence: any } | null> {
  const apiKey = await getGeminiApiKey();
  if (!apiKey) return null;
  const model = await getGeminiModel();
  const prompt =
    'Anda ialah pembantu klasifikasi aset ICT. Berdasarkan MODEL aset, berikan jenama dan kategori terbaik. ' +
    'Kategori mesti salah satu: desktop, laptop, server, printer, monitor, other. ' +
    'Balas dalam JSON sahaja: {"brand": "", "category": "", "confidence_brand": 0-1, "confidence_category": 0-1, "notes": ""}.\n' +
    `MODEL: ${modelNorm}\n` +
    (contextText ? `KONTEKS: ${contextText.slice(0, 1500)}\n` : '');

  try {
    const raw = await generateWithGemini(apiKey, model, prompt);
    const jsonText = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
    const parsed = JSON.parse(jsonText);
    const brand = normalizeUpper(parsed?.brand);
    const category = String(parsed?.category || '').trim().toLowerCase();
    return {
      brand: brand ? { name: brand, confidence: clamp01(Number(parsed?.confidence_brand)) } : undefined,
      category: category ? { name: category, confidence: clamp01(Number(parsed?.confidence_category)) } : undefined,
      evidence: { raw: jsonText, notes: parsed?.notes }
    };
  } catch {
    return null;
  }
}

export async function inferAndCacheModelIntel(args: {
  model?: string | null;
  serial?: string | null;
  language?: string | null;
  allowInternet?: boolean;
  allowAi?: boolean;
}): Promise<ModelIntelResult | null> {
  const modelNorm = normalizeModel(args.model);
  if (!modelNorm) return null;
  const serialNorm = args.serial ? normalizeSerial(args.serial) : null;

  const repo = AppDataSource.getRepository(AssetModelIntel);

  const existing = await repo.findOne({ where: { model_norm: modelNorm } });
  if (existing) {
    existing.hit_count = (existing.hit_count || 0) + 1;
    existing.last_seen_at = new Date();
    await repo.save(existing);
    return {
      model_raw: existing.model_raw ?? null,
      model_norm: existing.model_norm,
      serial_norm: existing.serial_norm ?? null,
      brand: {
        id: existing.detected_brand_id ?? null,
        name: existing.detected_brand ?? null,
        confidence: Number(existing.confidence_brand || 0)
      },
      category: {
        id: existing.detected_category_id ?? null,
        name: existing.detected_category ?? null,
        confidence: Number(existing.confidence_category || 0)
      },
      confidence_overall: Number(existing.confidence_overall || 0),
      sources: ['cache'],
      evidence: {
        db: existing.evidence_json?.db,
        internet: existing.evidence_json?.internet,
        ai: existing.evidence_json?.ai
      }
    };
  }

  const sources: Array<'db' | 'internet' | 'ai'> = [];
  const evidence: any = {};

  const dbResult = await inferFromDb(modelNorm);
  sources.push('db');
  evidence.db = dbResult.evidence;

  const brandRepo = AppDataSource.getRepository(AssetBrandOption);
  const brands = await brandRepo.find({ where: { is_active: true } });
  const knownBrands = brands.map((b) => b.name);

  let internetResult: any = null;
  if (args.allowInternet !== false) {
    internetResult = await inferFromInternet(modelNorm, knownBrands);
    if (internetResult) {
      sources.push('internet');
      evidence.internet = internetResult.evidence;
    }
  }

  let aiResult: any = null;
  if (args.allowAi !== false) {
    const contextText = internetResult?.evidence?.ddg?.abstract || '';
    aiResult = await inferWithAi(modelNorm, contextText);
    if (aiResult) {
      sources.push('ai');
      evidence.ai = aiResult.evidence;
    }
  }

  const pickBrand = () => {
    const candidates = [
      aiResult?.brand ? { ...aiResult.brand, source: 'ai' } : null,
      dbResult.brand ? { ...dbResult.brand, source: 'db' } : null,
      internetResult?.brand ? { ...internetResult.brand, source: 'internet' } : null
    ].filter(Boolean) as any[];
    candidates.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
    return candidates[0] || null;
  };

  const pickCategory = () => {
    const candidates = [
      aiResult?.category ? { ...aiResult.category, source: 'ai' } : null,
      dbResult.category ? { ...dbResult.category, source: 'db' } : null,
      internetResult?.category ? { ...internetResult.category, source: 'internet' } : null
    ].filter(Boolean) as any[];
    candidates.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
    return candidates[0] || null;
  };

  const bestBrand = pickBrand();
  const bestCategory = pickCategory();

  const confidenceBrand = clamp01(Number(bestBrand?.confidence || 0));
  const confidenceCategory = clamp01(Number(bestCategory?.confidence || 0));
  const confidenceOverall = clamp01((confidenceBrand + confidenceCategory) / 2);

  const categoryRepo = AppDataSource.getRepository(AssetCategoryOption);
  const categories = await categoryRepo.find({ where: { is_active: true } });

  const brandId = bestBrand?.id
    ? Number(bestBrand.id)
    : (bestBrand?.name
        ? brands.find((b) => normalizeUpper(b.name) === normalizeUpper(bestBrand.name))?.id
        : null);

  const categoryId = bestCategory?.id
    ? Number(bestCategory.id)
    : (bestCategory?.name
        ? categories.find((c) => normalizeUpper(c.name) === normalizeUpper(bestCategory.name))?.id
        : null);

  const row = repo.create({
    model_raw: args.model ? String(args.model) : null,
    model_norm: modelNorm,
    serial_norm: serialNorm,
    detected_brand: bestBrand?.name ?? null,
    detected_category: bestCategory?.name ?? null,
    detected_brand_id: brandId ?? null,
    detected_category_id: categoryId ?? null,
    confidence_brand: confidenceBrand,
    confidence_category: confidenceCategory,
    confidence_overall: confidenceOverall,
    language: args.language ?? null,
    sources_json: sources,
    evidence_json: evidence,
    hit_count: 1,
    last_seen_at: new Date()
  });
  await repo.save(row);

  return {
    model_raw: row.model_raw ?? null,
    model_norm: row.model_norm,
    serial_norm: row.serial_norm ?? null,
    brand: { id: brandId ?? null, name: row.detected_brand ?? null, confidence: confidenceBrand },
    category: { id: categoryId ?? null, name: row.detected_category ?? null, confidence: confidenceCategory },
    confidence_overall: confidenceOverall,
    sources,
    evidence
  };
}
