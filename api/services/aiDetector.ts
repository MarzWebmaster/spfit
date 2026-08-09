import axios from "axios";
import { AppDataSource } from "../config/database.ts";
import { SystemSettings } from "../models/SystemSettings.ts";
import { decrypt } from "../utils/encryption.ts";

/**
 * Result of AI capability detection
 */
export interface AiCapability {
  provider: string;       // "ilmu" | "gemini" | "openai" | "none"
  vision: boolean;        // Does this AI support image input?
  key: string;            // API key
  model: string;          // Model name
  baseUrl?: string;       // Base URL (for OpenAI-compatible)
  connected: boolean;     // Is AI configured?
  modelType: "vision" | "text" | "none";  // Convenience field
}

/**
 * Detect which AI provider is active and what it supports.
 * Checks DB system_settings -> falls back to env vars.
 * Priority: Gemini (vision) > OpenAI (vision/text) > ILMU (text-only)
 */
export async function detectAiCapability(): Promise<AiCapability> {
  // Try Gemini first (supports images/vision)
  const geminiKey = await getSetting("gemini_api_key", true);
  if (geminiKey) {
    const model = (await getSetting("gemini_model")) || "gemini-2.0-flash";
    return {
      provider: "gemini",
      vision: true,      // Gemini supports images
      key: geminiKey,
      model,
      connected: true,
      modelType: "vision",
    };
  }

  // Try OpenAI-compatible (any provider — may or may not support vision)
  const openaiKey = await getSetting("openai_api_key");
  if (openaiKey) {
    const model = (await getSetting("openai_model")) || "gpt-4o-mini";
    const baseUrl =
      (await getSetting("openai_base_url")) || "https://api.openai.com/v1";
    // Vision-capable models (common ones)
    const visionModels = [
      "gpt-4o", "gpt-4o-mini", "gpt-4", "gpt-4-turbo",
      "claude-sonnet", "claude-opus", "claude-haiku",
      "gemini-", "qwen-vl", "llava",
    ];
    const isVision = visionModels.some((v) => model.includes(v));

    return {
      provider: "openai",
      vision: isVision,
      key: openaiKey,
      model,
      baseUrl,
      connected: true,
      modelType: isVision ? "vision" : "text",
    };
  }

  // Try ILMU last (text-only — no image support)
  const ilmuKey = await getSetting("ilmu_api_key");
  if (ilmuKey) {
    const model = (await getSetting("ilmu_model")) || "nemo-super";
    const baseUrl = (await getSetting("ilmu_base_url")) || "https://api.ilmu.ai/v1";
    return {
      provider: "ilmu",
      vision: false,     // ILMU = text-only
      key: ilmuKey,
      model,
      baseUrl,
      connected: true,
      modelType: "text",
    };
  }

  // No AI configured
  return {
    provider: "none",
    vision: false,
    key: "",
    model: "",
    connected: false,
    modelType: "none",
  };
}

/**
 * Quick check: can this AI accept image data?
 * (Uses cached capability result, no API call)
 */
export function supportsVision(capability: AiCapability): boolean {
  return capability.connected && capability.vision;
}

/**
 * Quick check: text-only AI (needs OCR before sending)
 */
export function supportsTextOnly(capability: AiCapability): boolean {
  return capability.connected && !capability.vision;
}

/**
 * Get a setting from DB or env
 */
async function getSetting(
  key: string,
  encrypted: boolean = false
): Promise<string | null> {
  try {
    if (AppDataSource.isInitialized) {
      const repo = AppDataSource.getRepository(SystemSettings);
      const s = await repo.findOne({
        where: { setting_key: key, is_active: true },
      });
      if (s?.setting_value) {
        return encrypted ? decrypt(s.setting_value) ?? s.setting_value : s.setting_value;
      }
    }
  } catch {}

  // Fallback to env
  const envKey = key.toUpperCase();
  return process.env[envKey] || null;
}
