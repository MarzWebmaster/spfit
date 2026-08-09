import { AssetUpdateDraft } from "../controllers/aiMasterlistAssistantController.ts";

// ─── Types ──────────────────────────────────────────────────────────────
export interface RuleExtractionResult {
  drafts: AssetUpdateDraft[];
  reply: string;
  warnings: string[];
  confidence: number;           // 0-100
  formType: string | null;      // Detected form type
  usedAI: boolean;              // Did we use AI?
  skippedReason: string | null; // Why AI was skipped/used
}

// ─── Form Types ─────────────────────────────────────────────────────────
const FORM_PATTERNS: Array<{
  name: string;
  keywords: string[];
  labels: Record<string, RegExp>;
}> = [
  {
    name: "ICT Maintenance",
    keywords: [
      "BORANG PENGESAHAN PERKHIDMATAN",
      "PENYELENGGARAAN PERALATAN ICT",
      "MULTIMAX",
    ],
    labels: {
      user_name: /Nama\s*(Pengguna|User|Staff)\s*[:\-]?\s*(.+)/im,
      department:
        /(Jabatan|Department|Bahagian|Divisyen)\s*[:\-]?\s*(.+)/im,
      floor: /(Tingkat|Floor|Aras|Level)\s*[:\-]?\s*(\d+|.+)/im,
      building:
        /(Bangunan|Building|Blok|Block)\s*[:\-]?\s*(.+)/im,
      location:
        /(Lokasi|Location|Bilik|Room)\s*[:\-]?\s*(.+)/im,
      branch:
        /(Cawangan|Branch)\s*[:\-]?\s*(.+)/im,
      state:
        /(Negeri|State)\s*[:\-]?\s*(.+)/im,
    },
  },
  {
    name: "Asset Handover / Serahan",
    keywords: [
      "SERAHAN ASET",
      "PENYERAHAN ASET",
      "HANDOVER",
      "PENERIMAAN ASET",
    ],
    labels: {
      user_name: /(Nama Penerima|Penerima|Received by|User)\s*[:\-]?\s*(.+)/im,
      department: /(Jabatan|Department)\s*[:\-]?\s*(.+)/im,
      location: /(Lokasi|Location)\s*[:\-]?\s*(.+)/im,
      notes: /(Catatan|Notes|Remarks)\s*[:\-]?\s*(.+)/im,
    },
  },
  {
    name: "Inventory List",
    keywords: [
      "SENARAI ASET",
      "INVENTORI",
      "INVENTORY",
      "DAFTAR ASET",
    ],
    labels: {
      serial_number:
        /(SN|S\/N|Serial|No\.?\s*Siri|No\.?\s*Serial|Kod Aset)\s*[:\-]?\s*([A-Za-z0-9\-\/]+)/im,
      model: /(Model|Tipe|Type)\s*[:\-]?\s*(.+)/im,
      brand: /(Jenama|Brand|Mfg|Pengeluar)\s*[:\-]?\s*(Acer|Asus|Apple|Brother|Canon|Dell|Epson|Fujitsu|HP|Huawei|IBM|Lenovo|Microsoft|NEC|Panasonic|Samsung|Sony|Toshiba|Xerox|Xiaomi)/im,
    },
  },
  {
    name: "Delivery Order / Invoice",
    keywords: [
      "DELIVERY ORDER",
      "DO ",
      "INVOIS",
      "INVOICE",
      "NO\.?\s*DO",
      "NO\.?\s*INVOICE",
    ],
    labels: {
      serial_number:
        /(SN|S\/N|Serial|No\.?\s*Siri)\s*[:\-]?\s*([A-Za-z0-9\-\/]+)/im,
      asset_name:
        /(Perkara|Description|Item|Barang|Product)\s*[:\-]?\s*(.+)/im,
    },
  },
  {
    name: "Generic Label / Tag",
    keywords: [
      "SN",
      "S/N",
      "SERIAL",
      "MODEL",
      "ASSET TAG",
      "TAG",
    ],
    labels: {
      serial_number:
        /(SN|S\/N|Serial|No\.?\s*Siri)\s*[:\-]?\s*([A-Za-z0-9\-\/]+)/im,
      asset_tag:
        /(TAG|Asset Tag|Kod Aset)\s*[:\-]?\s*([A-Za-z0-9\-\/]+)/im,
      model: /(Model|Type)\s*[:\-]?\s*(.+)/im,
      brand:
        /(Brand|Jenama|Mfg)\s*[:\-]?\s*(Acer|Asus|Apple|Brother|Canon|Dell|Epson|Fujitsu|HP|Huawei|IBM|Lenovo|Microsoft|NEC|Panasonic|Samsung|Sony|Toshiba|Xerox|Xiaomi)/im,
    },
  },
];

// ─── Brand list (for detection without label) ────────────────────────────
const BRANDS = [
  "Acer", "Apple", "Asus", "Brother", "Canon", "Dell", "Epson",
  "Fujitsu", "HP", "Huawei", "IBM", "Lenovo", "Microsoft",
  "NEC", "Panasonic", "Samsung", "Sony", "Toshiba", "Xerox", "Xiaomi",
];

// ─── Malaysian states normalisation ─────────────────────────────────────
const STATE_MAP: Record<string, string> = {
  johor: "Johor",
  johore: "Johor",
  jhr: "Johor",
  jhb: "Johor",
  kedah: "Kedah",
  kdh: "Kedah",
  kelantan: "Kelantan",
  klt: "Kelantan",
  ktn: "Kelantan",
  melaka: "Melaka",
  mlk: "Melaka",
  negeri: "Negeri Sembilan",
  sembilan: "Negeri Sembilan",
  nsn: "Negeri Sembilan",
  pahang: "Pahang",
  phg: "Pahang",
  perak: "Perak",
  prk: "Perak",
  perlis: "Perlis",
  pls: "Perlis",
  "pulau pinang": "Pulau Pinang",
  pinang: "Pulau Pinang",
  png: "Pulau Pinang",
  sabah: "Sabah",
  sbh: "Sabah",
  sarawak: "Sarawak",
  swk: "Sarawak",
  selangor: "Selangor",
  "selangor darul ehsan": "Selangor",
  sel: "Selangor",
  sgr: "Selangor",
  terengganu: "Terengganu",
  "kuala lumpur": "W.P. Kuala Lumpur",
  "wp kuala lumpur": "W.P. Kuala Lumpur",
  wpk: "W.P. Kuala Lumpur",
  labuan: "W.P. Labuan",
  "wp labuan": "W.P. Labuan",
  putrajaya: "W.P. Putrajaya",
  "wp putrajaya": "W.P. Putrajaya",
};

// ─── Main extraction function ───────────────────────────────────────────
export function extractByRules(ocrText: string): RuleExtractionResult {
  const warnings: string[] = [];
  const drafts: AssetUpdateDraft[] = [];
  let detectedForm: string | null = null;
  let totalLabels = 0;
  let matchedLabels = 0;

  // 1. Detect form type
  const form = detectFormType(ocrText);
  detectedForm = form?.name || "Unknown";

  if (!form) {
    // 2. Generic extraction (no specific form)
    warnings.push("Format borang tidak dikenali. Guna ekstrak generik.");
  }

  // 3. Extract fields using form labels or generic patterns
  const draft: AssetUpdateDraft = {};

  if (form) {
    for (const [field, regex] of Object.entries(form.labels)) {
      totalLabels++;
      const match = ocrText.match(regex);
      if (match) {
        const value = match[match.length - 1]?.trim() || "";
        if (value && value.length > 1) {
          (draft as any)[field] = value;
          matchedLabels++;
        }
      }
    }
  }

  // 4. Generic fallback patterns (always apply)
  const serialMatch =
    ocrText.match(
      /(?:SN|S\/N|Serial|No\.?\s*(?:Siri|Serial)|SIN)\s*[:\-]?\s*([A-Za-z0-9][A-Za-z0-9\-\/\s]{3,30})/im
    );
  if (serialMatch && !draft.serial_number) {
    draft.serial_number = serialMatch[1].trim();
    if (!form) matchedLabels++;
  }

  const modelMatch = ocrText.match(
    /(?:Model|Type|Tipe)\s*[:\-]?\s*([A-Za-z0-9][A-Za-z0-9\-\/\s]{2,30})/im
  );
  if (modelMatch && !draft.model) {
    draft.model = modelMatch[1].trim();
    if (!form) matchedLabels++;
  }

  // Brand detection (word-based)
  if (form) totalLabels++; // count brand as a label
  for (const brand of BRANDS) {
    const brandRegex = new RegExp("\\b" + brand + "\\b", "i");
    if (brandRegex.test(ocrText) && !draft.brand) {
      draft.brand = brand;
      matchedLabels++;
      break;
    }
  }

  // State normalization
  if (draft.state) {
    const normalized = normalizeState(draft.state);
    if (normalized) draft.state = normalized;
  }

  // 5. Calculate confidence
  const userFields = ["user_name", "serial_number", "asset_name", "brand", "model", "department"];
  const filled = userFields.filter((f) => (draft as any)[f]).length;
  const confidence = form
    ? Math.min(
        100,
        Math.round(
          (matchedLabels / Math.max(totalLabels, 1)) * 50 +
            (filled / userFields.length) * 30 +
            (draft.serial_number ? 20 : 0)
        )
      )
    : Math.min(
        100,
        Math.round(
          (filled / userFields.length) * 60 + (draft.serial_number ? 40 : 0)
        )
      );

  // Push draft if has any content
  if (
    draft.serial_number ||
    draft.asset_name ||
    draft.brand ||
    draft.model ||
    draft.user_name
  ) {
    drafts.push(draft);
  }

  // 6. Generate response
  let reply = "";
  if (drafts.length > 0 && confidence >= 80) {
    reply = `Saya jumpa **${drafts.length}** aset dari borang "${
      detectedForm || "generic"
    }". Keputusan menggunakan peraturan (rule-based). AI tidak digunakan.`;
  } else if (drafts.length > 0 && confidence >= 50) {
    reply = `Saya jumpa **${drafts.length}** aset secara separa. Keputusan kurang lengkap — AI diperlukan untuk melengkapkan.`;
  } else {
    reply = `Tidak dapat ekstrak aset dengan pasti dari teks OCR. AI diperlukan untuk analisis lanjut.`;
  }

  return {
    drafts,
    reply,
    warnings,
    confidence,
    formType: detectedForm,
    usedAI: false,
    skippedReason: confidence >= 80 ? "Rule confidence high, AI skipped" : null,
  };
}

// ─── Detect form type from OCR text ─────────────────────────────────────
function detectFormType(ocrText: string) {
  const upper = ocrText.toUpperCase();

  for (const form of FORM_PATTERNS) {
    const matchCount = form.keywords.filter((kw) => upper.includes(kw)).length;
    if (matchCount >= 2) {
      return form;
    }
    // Single strong match
    if (matchCount === 1 && form.keywords.some((kw) => upper.includes(kw))) {
      for (const kw of form.keywords) {
        if (upper.includes(kw) && kw.length > 8) return form;
      }
    }
  }

  // Fallback: if OCR has SN + Model, treat as Generic Label
  const hasSN = /(?:SN|S\/N|SERIAL)\s*[:\-]?\s*\S/i.test(ocrText);
  const hasModel = /(?:MODEL|TYPE)\s*[:\-]?\s*\S/i.test(ocrText);
  if (hasSN) {
    return FORM_PATTERNS.find((f) => f.name === "Generic Label / Tag") || null;
  }

  return null;
}

// ─── Normalise Malaysian state names ────────────────────────────────────
function normalizeState(input: string): string | null {
  const clean = input.trim().toLowerCase().replace(/[^a-z\s]/g, "");
  for (const [key, value] of Object.entries(STATE_MAP)) {
    if (clean.includes(key)) return value;
  }
  return null;
}
