import React, { useState, useRef, useMemo } from 'react';
import { Upload, ChevronRight, ChevronLeft, AlertCircle, CheckCircle, Download, RefreshCw, Zap, Eye, BarChart3 } from 'lucide-react';
import { masterlistsApi } from '../services/api';
import { storage } from '../utils/storage';
import { getApiBaseUrl } from '../utils/apiUrl';

interface ImportRow {
  [key: string]: string | undefined;
}

interface ImportResult {
  success: boolean;
  totalRows: number;
  successCount: number;
  createdCount?: number;
  updatedCount?: number;
  errorCount: number;
  errors: Array<{
    rowNumber: number;
    rowData: ImportRow;
    errors: string[];
  }>;
}

const IMPORT_BATCH_SIZE = 25;

interface AssetImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  masterlistId?: number;
  onImportSuccess?: (masterlistId: number) => void;
}

const HEADER_SYNONYMS: Record<string, string[]> = {
  masterlist_code: ['kod masterlist', 'masterlist code', 'ml code', 'ml kod'],
  masterlist_name: ['nama masterlist', 'masterlist name', 'ml name', 'ml nama'],
  masterlist_status: ['status masterlist', 'masterlist status', 'ml status'],
  project_code: ['kod projek', 'project code', 'pj code', 'pj kod', 'projek kod'],
  project_name: ['nama projek', 'project name', 'pj name', 'pj nama', 'projek nama'],
  asset_tag: ['tag', 'tag aset', 'asset tag', 'no tag', 'tag number'],
  name: ['nama', 'nama aset', 'asset name', 'peralatan', 'equipment', 'peranti', 'device'],
  serial_number: ['serial', 'sn', 's/n', 'serial no', 'no siri', 'nombor siri', 'serial number', 'serialnumber'],
  brand: ['jenama', 'brand', 'manufacturer', 'pengeluar', 'buatan'],
  model: ['model', 'jenis', 'type', 'tipe'],
  category: ['kategori', 'category', 'jenis aset', 'jenis peralatan'],
  status: ['status', 'status aset', 'keadaan'],
  notes: ['nota', 'notes', 'catatan', 'keterangan', 'remark', 'remarks', 'description', 'desc'],
  user_name: ['nama pengguna', 'user', 'pengguna', 'user name', 'pemilik', 'owner', 'assigned to', 'assigned'],
  position: ['jawatan', 'position', 'title', 'gelaran'],
  department: ['bahagian', 'jabatan', 'department', 'dept', 'division', 'section', 'unit'],
  floor: ['tingkat', 'floor', 'level', 'aras', 'tingkat bangunan'],
  building: ['bangunan', 'building', 'blok', 'block'],
  location: ['lokasi', 'location', 'tempat', 'site', 'alamat', 'address'],
  branch: ['cawangan', 'branch', 'pejabat', 'office'],
  state: ['negeri', 'state', 'wilayah', 'region'],
  monitor_sn: ['monitor sn', 'sn monitor', 'monitor serial', 'serial monitor'],
  monitor_name: ['monitor', 'monitor nama', 'nama monitor', 'monitor name'],
  keyboard_sn: ['keyboard sn', 'sn keyboard', 'papan kekunci sn', 'keyboard serial', 'serial keyboard'],
  keyboard_name: ['keyboard', 'papan kekunci', 'keyboard nama', 'nama keyboard', 'keyboard name'],
  mouse_sn: ['mouse sn', 'sn mouse', 'tetikus sn', 'mouse serial', 'serial mouse'],
  mouse_name: ['mouse', 'tetikus', 'mouse nama', 'nama mouse', 'mouse name'],
};

const HEADER_DISPLAY_NAMES: Record<string, string> = {
  masterlist_code: 'Kod Masterlist',
  masterlist_name: 'Nama Masterlist',
  masterlist_status: 'Status Masterlist',
  project_code: 'Kod Projek',
  project_name: 'Nama Projek',
  asset_tag: 'Asset Tag',
  name: 'Nama Aset',
  serial_number: 'Serial Number',
  brand: 'Jenama',
  model: 'Model',
  category: 'Kategori',
  status: 'Status Aset',
  notes: 'Nota/Catatan',
  user_name: 'Nama Pengguna',
  position: 'Jawatan',
  department: 'Bahagian/Jabatan',
  floor: 'Tingkat',
  building: 'Bangunan',
  location: 'Lokasi',
  branch: 'Cawangan',
  state: 'Negeri',
  monitor_sn: 'Monitor (SN)',
  monitor_name: 'Monitor (Nama)',
  keyboard_sn: 'Papan Kekunci (SN)',
  keyboard_name: 'Papan Kekunci (Nama)',
  mouse_sn: 'Tetikus (SN)',
  mouse_name: 'Tetikus (Nama)'
};

const EXPECTED_HEADERS = [
  'masterlist_code',
  'masterlist_name',
  'masterlist_status',
  'project_code',
  'project_name',
  'asset_tag',
  'name',
  'serial_number',
  'brand',
  'model',
  'category',
  'status',
  'notes',
  'user_name',
  'position',
  'department',
  'floor',
  'building',
  'location',
  'branch',
  'state',
  'monitor_sn',
  'monitor_name',
  'keyboard_sn',
  'keyboard_name',
  'mouse_sn',
  'mouse_name'
];

const SAMPLE_DATA = [
  {
    masterlist_code: 'ML-001',
    masterlist_name: 'IT Equipment HQ',
    masterlist_status: 'Aktif',
    project_code: 'PRJ-001',
    project_name: 'Infrastructure 2025',
    asset_tag: 'PC-001',
    name: 'Dell OptiPlex 7090',
    serial_number: 'SN-DELL-001',
    brand: 'Dell',
    model: 'OptiPlex 7090',
    category: 'Desktop',
    status: 'Aktif',
    notes: 'Main office workstation',
    user_name: 'Ahmad Ali',
    position: 'System Admin',
    department: 'IT Department',
    floor: '3',
    building: 'Block A',
    location: 'Desk 301',
    branch: 'Kuala Lumpur',
    state: 'WP Kuala Lumpur',
    monitor_sn: 'SN-LG-001',
    monitor_name: 'LG 27UP550',
    keyboard_sn: 'SN-KB-001',
    keyboard_name: 'Logitech K120',
    mouse_sn: 'SN-MS-001',
    mouse_name: 'Logitech M185'
  },
  {
    masterlist_code: 'ML-001',
    masterlist_name: 'IT Equipment HQ',
    masterlist_status: 'Aktif',
    project_code: 'PRJ-001',
    project_name: 'Infrastructure 2025',
    asset_tag: 'PC-002',
    name: 'HP EliteDesk 800',
    serial_number: 'SN-HP-002',
    brand: 'HP',
    model: 'EliteDesk 800 G6',
    category: 'Desktop',
    status: 'Aktif',
    notes: 'Developer workstation',
    user_name: 'Fatimah Hassan',
    position: 'Developer',
    department: 'Engineering',
    floor: '3',
    building: 'Block A',
    location: 'Desk 305',
    branch: 'Kuala Lumpur',
    state: 'WP Kuala Lumpur',
    monitor_sn: 'SN-DELL-M002',
    monitor_name: 'Dell U2722DE',
    keyboard_sn: '',
    keyboard_name: '',
    mouse_sn: 'SN-MS-002',
    mouse_name: 'HP Wireless Mouse'
  }
];

export const AssetImportModal: React.FC<AssetImportModalProps> = ({
  isOpen,
  onClose,
  masterlistId,
  onImportSuccess
}) => {
  const isMasterlistLocked = Boolean(masterlistId);
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [selectedMasterlist, setSelectedMasterlist] = useState<number | null>(masterlistId || null);
  const [file, setFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<ImportRow[]>([]);
  const [allRows, setAllRows] = useState<ImportRow[]>([]);
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<{ [key: string]: string }>({});
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [masterlists, setMasterlists] = useState<Array<{ id: number; code?: string; name: string }>>([]);
  const [samplingMode, setSamplingMode] = useState(false);
  const [samplingResult, setSamplingResult] = useState<any>(null);
  const [showAdvancedMapping, setShowAdvancedMapping] = useState(false);
  const [columnTransforms, setColumnTransforms] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Data type detection ──────────────────────────────────────────────────
  const detectedTypes = useMemo(() => {
    const types: Record<string, string> = {};
    fileHeaders.forEach(h => {
      const values = allRows.slice(0, 50).map(r => r[h]).filter(Boolean);
      if (!values.length) { types[h] = 'empty'; return; }
      const numCount = values.filter(v => !isNaN(Number(v)) && v!.trim() !== '').length;
      const dateCount = values.filter(v => !isNaN(Date.parse(v!)) && v!.trim() !== '').length;
      const len = values.length;
      if (numCount / len > 0.7) types[h] = 'number';
      else if (dateCount / len > 0.5 && /^\d{2,4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,4}/.test(values[0]!))
        types[h] = 'date';
      else types[h] = 'text';
    });
    return types;
  }, [fileHeaders, allRows]);

  const TYPE_ICONS: Record<string, string> = { text: 'Aa', number: '123', date: '📅', empty: '—' };
  const TYPE_COLORS: Record<string, string> = { text: 'bg-blue-50 text-blue-700', number: 'bg-green-50 text-green-700', date: 'bg-yellow-50 text-yellow-700', empty: 'bg-gray-50 text-gray-400' };

  // ── Helpers (defined before validationPreview to avoid TDZ) ──────────────
  const mapRowsForPreview = () => {
    return allRows.slice(0, 10).map((row) => {
      const mapped: ImportRow = {};
      Object.entries(columnMapping).forEach(([src, tgt]) => { if (tgt) mapped[tgt] = row[src]; });
      return mapped;
    });
  };

  const getSourceKey = (target: string) => {
    return Object.entries(columnMapping).find(([, v]) => v === target)?.[0] || '';
  };

  // ── Validation preview ───────────────────────────────────────────────────
  const validationPreview = useMemo(() => {
    const warnings: Array<{ row: number; field: string; issue: string; severity: 'warn' | 'error' }> = [];
    const mappedRows = mapRowsForPreview();
    mappedRows.forEach((row, idx) => {
      if (!row.name && !row.serial_number) {
        warnings.push({ row: idx + 1, field: 'name', issue: 'Nama atau Serial Number diperlukan', severity: 'error' });
      }
      if (row.status && !['Aktif', 'Tidak Aktif', 'Diselenggara', 'Rosak', 'Dilupuskan'].includes(row.status)) {
        warnings.push({ row: idx + 1, field: 'status', issue: `Status "${row.status}" mungkin tidak sah`, severity: 'warn' });
      }
      if (row.serial_number && allRows.some((r, i) => i !== idx && r[row.serial_number ? getSourceKey('serial_number') : ''] === row.serial_number)) {
        warnings.push({ row: idx + 1, field: 'serial_number', issue: 'Serial Number pendua dalam fail', severity: 'error' });
      }
    });
    return warnings;
  }, [allRows, columnMapping]);

  const importPhaseLabels = isMasterlistLocked
    ? ['Upload', 'Mapping', 'Pratonton', 'Import', 'Hasil']
    : ['Masterlist', 'Mapping', 'Pratonton', 'Import', 'Hasil'];

  // Phase indicator rendering
  const phases = isMasterlistLocked
    ? [1, 2, 3, 4, 5]
    : [1, 2, 3, 4, 5];

  // Load masterlists on mount
  React.useEffect(() => {
    if (isOpen) {
      setStep(1);
      setError(null);
      setSelectedMasterlist(masterlistId || null);
      fetchMasterlists();
    }
  }, [isOpen, masterlistId]);

  const fetchMasterlists = async () => {
    try {
      const response = await masterlistsApi.getAll(1, 100, { sortBy: 'name', sort: 'asc' });
      if (!response.success || !response.data) {
        setMasterlists([]);
        return;
      }

      const data = response.data as any;
      setMasterlists(Array.isArray(data.masterlists) ? data.masterlists : []);
    } catch (err) {
      setMasterlists([]);
      console.error('Error loading masterlists:', err);
    }
  };

  // ── Smart header matching (component-level, reused by mapRowsForImport) ──
  const smartMatchHeader = (header: string): string | null => {
    const h = header.toLowerCase().trim().replace(/[\s\-_]+/g, ' ').replace(/[\(\)]/g, '');
    if (EXPECTED_HEADERS.includes(h)) return h;
    const byDisp = EXPECTED_HEADERS.find(k => HEADER_DISPLAY_NAMES[k]?.toLowerCase() === h);
    if (byDisp) return byDisp;
    for (const [key, synonyms] of Object.entries(HEADER_SYNONYMS)) {
      if (synonyms.some(s => s === h)) return key;
    }
    for (const [key, synonyms] of Object.entries(HEADER_SYNONYMS)) {
      if (synonyms.some(s => h.includes(s) || s.includes(h))) return key;
    }
    const words = h.split(' ').filter(w => w.length > 0);
    let bestScore = 0; let bestKey: string | null = null;
    for (const [key, synonyms] of Object.entries(HEADER_SYNONYMS)) {
      const score = synonyms.reduce((acc, s) => acc + s.split(' ').filter(w => words.includes(w)).length, 0);
      if (score > bestScore) { bestScore = score; bestKey = key; }
    }
    return bestScore >= 1 ? bestKey : null;
  };

  const mapRowsForImport = () => {
    // Auto-fill any missing mappings before building rows
    let mapping = { ...columnMapping };
    let added = 0;
    fileHeaders.forEach(h => {
      if (!mapping[h]) {
        const m = smartMatchHeader(h);
        if (m) { mapping[h] = m; added++; }
      }
    });
    if (added > 0) {
      setColumnMapping(mapping);
      console.log(`[mapRowsForImport] Auto-filled ${added} missing mappings`);
    }

    const result = allRows.map((row) => {
      const mappedRow: ImportRow = {};
      Object.entries(mapping).forEach(([sourceHeader, targetField]) => {
        if (!targetField) return;
        const val = row[sourceHeader];
        if (val !== undefined && val !== null) mappedRow[targetField] = String(val).trim();
      });
      return mappedRow;
    }).filter((row) => Object.values(row).some((value) => String(value || '').trim() !== ''));

    if (result.length > 0) {
      console.log('[mapRowsForImport] First row keys:', Object.keys(result[0]));
      console.log('[mapRowsForImport] Paired fields:', { monitor_sn: result[0].monitor_sn, keyboard_sn: result[0].keyboard_sn, mouse_sn: result[0].mouse_sn });
    }
    return result;
  };

  const generateCSVTemplate = () => {
    const headerDisplayNames = EXPECTED_HEADERS.map(h => HEADER_DISPLAY_NAMES[h] || h);
    const headers = headerDisplayNames.join(',');

    const rows = SAMPLE_DATA.map(row =>
      EXPECTED_HEADERS.map(header => {
        const value = row[header as keyof typeof row] || '';
        // Escape values containing commas or quotes
        if (value.includes(',') || value.includes('"')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',')
    );
    const csv = [headers, ...rows].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `template_import_aset_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setError(null);
    setFile(selectedFile);

    try {
      const token = storage.getToken();
      if (!token) {
        setError('Sesi log masuk tidak sah. Sila log masuk semula.');
        return;
      }

      const formData = new FormData();
      formData.append('file', selectedFile);
      if (selectedMasterlist) {
        formData.append('masterlist_id', selectedMasterlist.toString());
      }

      const apiBase = getApiBaseUrl();
      const response = await fetch(`${apiBase}/assets/import/validate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      const data = await response.json();
      if (data.success) {
        const headers = data.data.headers || [];
        setPreviewRows(data.data.sampleRows || []);
        setAllRows(data.data.allRows || []);
        setFileHeaders(headers);

        // Smart auto-map: match headers using synonyms, fuzzy matching, and display names
        const autoMapping: { [key: string]: string } = {};
        const unmatched: string[] = [];

        headers.forEach((header: string) => {
          const match = smartMatchHeader(header);
          if (match) {
            autoMapping[header] = match;
          } else {
            unmatched.push(header);
          }
        });

        // Log unmatched for debugging
        if (unmatched.length > 0) {
          console.log('Unmapped columns:', unmatched);
        }

        setColumnMapping(autoMapping);

        setStep(2);
      } else {
        setError(data.message || 'Error validating file');
      }
    } catch (err) {
      setError('Error memuat naik fail. Pastikan fail CSV atau XLSX sah.');
      console.error('File validation error:', err);
    }
  };

  const handleMapColumn = (fileHeader: string, mappedTo: string) => {
    setColumnMapping(prev => ({
      ...prev,
      [fileHeader]: mappedTo || ''
    }));
  };

  const handleImport = async () => {
    if (!selectedMasterlist) {
      setError('Select masterlist first');
      return;
    }

    if (!Object.values(columnMapping).includes('name')) {
      setError('Mapping untuk field name diperlukan sebelum import');
      return;
    }

    setIsImporting(true);
    setImportProgress(0);
    setError(null);

    try {
      const token = storage.getToken();
      if (!token) {
        setError('Sesi log masuk tidak sah. Sila log masuk semula.');
        return;
      }

      const mappedRows = mapRowsForImport();

      // Debug: log first row with paired data
      if (mappedRows.length > 0) {
        const first = mappedRows[0];
        console.log('[Import Debug] First mapped row:', {
          name: first.name,
          serial_number: first.serial_number,
          monitor_sn: first.monitor_sn,
          monitor_name: first.monitor_name,
          keyboard_sn: first.keyboard_sn,
          keyboard_name: first.keyboard_name,
          mouse_sn: first.mouse_sn,
          mouse_name: first.mouse_name,
          user_name: first.user_name,
        });
      }

      if (mappedRows.length === 0) {
        setError('Tiada data yang boleh diimport selepas mapping');
        return;
      }

      const totalBatches = Math.ceil(mappedRows.length / IMPORT_BATCH_SIZE);
      const aggregateResult: ImportResult = {
        success: true,
        totalRows: mappedRows.length,
        successCount: 0,
        errorCount: 0,
        errors: []
      };

      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const start = batchIndex * IMPORT_BATCH_SIZE;
        const end = start + IMPORT_BATCH_SIZE;
        const batchRows = mappedRows.slice(start, end);

        const apiBase = getApiBaseUrl();
        const response = await fetch(`${apiBase}/assets/import/process`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            masterlist_id: selectedMasterlist,
            rows: batchRows,
            columnMapping
          })
        });

        const data = await response.json();
        if (!response.ok || !data.data) {
          setError(data.message || 'Import failed');
          return;
        }

        const batchResult = data.data as ImportResult;
        aggregateResult.success = aggregateResult.success && batchResult.success;
        aggregateResult.successCount += batchResult.successCount;
        aggregateResult.errorCount += batchResult.errorCount;
        aggregateResult.errors.push(...batchResult.errors);
        if ((batchResult as any).createdCount) aggregateResult.createdCount = (aggregateResult.createdCount || 0) + (batchResult as any).createdCount;
        if ((batchResult as any).updatedCount) aggregateResult.updatedCount = (aggregateResult.updatedCount || 0) + (batchResult as any).updatedCount;

        setImportProgress(Math.round(((batchIndex + 1) / totalBatches) * 100));
      }

      setImportResult(aggregateResult);
      setStep(5);
    } catch (err) {
      setError('Error during import. Please try again.');
      console.error('Import error:', err);
    } finally {
      setIsImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="mx-4 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg bg-white shadow-xl">
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 text-white flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-bold">Import Aset</h2>
          <button
            onClick={onClose}
            className="text-white hover:bg-blue-800 rounded p-1"
          >
            ✕
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="text-red-800 text-sm">{error}</div>
            </div>
          )}

          {/* Step Indicators */}
          <div className="mb-6 flex flex-wrap gap-2 text-sm">
            {phases.map((p, idx) => (
              <div
                key={p}
                className={`px-2 py-0.5 rounded text-xs font-medium ${
                  step >= p ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {idx + 1}. {importPhaseLabels[idx]}
              </div>
            ))}
          </div>

          {/* Step 1: Select Masterlist & Upload */}
          {step === 1 && (
            <div className="space-y-4">
              {!isMasterlistLocked && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Pilih Masterlist
                  </label>
                  <select
                    value={selectedMasterlist || ''}
                    onChange={e => setSelectedMasterlist(Number(e.target.value) || null)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Pilih Masterlist --</option>
                    {masterlists.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.code ? `${m.code} - ${m.name}` : m.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {isMasterlistLocked && (
                <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
                  Import untuk masterlist semasa.
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload File CSV
                </label>
                <div
                  className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                  <p className="text-sm text-gray-600">Drag and drop atau klik untuk pilih fail</p>
                  <p className="text-xs text-gray-500 mt-0.5">CSV, XLSX, PDF, DOCX, TXT</p>
                  <p className="text-xs text-gray-500 mt-1">Max 10MB</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls,.pdf,.docx,.txt,.log,.md,.rtf"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              <button
                onClick={generateCSVTemplate}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 transition"
              >
                <Download className="w-4 h-4" />
                Download Sample Template
              </button>

              <div className="flex flex-wrap justify-end gap-2 pt-4">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Batal
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Field Mapping */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-gray-900 mb-2">Preview Data ({previewRows.length} rows)</h3>
                <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 max-h-32 overflow-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b">
                        {fileHeaders.slice(0, 5).map(h => (
                          <th key={h} className="px-2 py-1 text-left">{h}</th>
                        ))}
                        {fileHeaders.length > 5 && <th className="px-2 py-1">...</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.slice(0, 2).map((row, idx) => (
                        <tr key={idx} className="border-b">
                          {fileHeaders.slice(0, 5).map(h => (
                            <td key={h} className="px-2 py-1 text-gray-600">
                              {row[h] || '-'}
                            </td>
                          ))}
                          {fileHeaders.length > 5 && <td className="px-2 py-1">...</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

               <div>
                <h3 className="font-medium text-gray-900 mb-2">Field Mapping</h3>
                <p className="text-xs text-gray-500 mb-3">
                  {Object.keys(columnMapping).length > 0
                    ? `${Object.keys(columnMapping).length} lajur dipadankan secara automatik.`
                    : 'Tiada lajur dipadankan automatik.'}{' '}
                  Semak dan laraskan pemetaan di bawah. Lajur yang tidak dipadankan akan dilangkau.
                </p>
                <div className="space-y-2 max-h-60 overflow-auto">
                  {fileHeaders.map(header => {
                    const isMapped = Boolean(columnMapping[header]);
                    return (
                    <div key={header} className={`flex items-center gap-2 p-1 rounded ${isMapped ? 'bg-green-50' : 'bg-yellow-50'}`}>
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isMapped ? 'bg-green-500' : 'bg-yellow-500'}`} />
                      <span className={`text-sm w-36 truncate ${isMapped ? 'text-gray-800 font-medium' : 'text-gray-600'}`}>{header}</span>
                      <span className="text-gray-400">→</span>
                      <select
                        value={columnMapping[header] || ''}
                        onChange={e => handleMapColumn(header, e.target.value)}
                        className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">-- Skip --</option>
                        {EXPECTED_HEADERS.map(exp => (
                          <option key={exp} value={exp}>
                            {HEADER_DISPLAY_NAMES[exp] || exp}
                          </option>
                        ))}
                      </select>
                    </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col-reverse gap-2 pt-4 sm:flex-row sm:justify-between">
                <button
                  onClick={() => setStep(1)}
                  className="flex items-center gap-2 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Kembali
                </button>
                <button
                  onClick={() => setStep(3)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Pratonton
                  <Eye className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Pratonton & Validasi */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="w-5 h-5 text-indigo-600" />
                <h3 className="font-medium text-gray-900">Pratonton & Validasi Data</h3>
              </div>

              {/* Data Type Summary */}
              <div className="border rounded-lg p-3 bg-gray-50">
                <p className="text-xs font-semibold text-gray-500 mb-2 uppercase">Jenis Data Dikesan</p>
                <div className="flex flex-wrap gap-2">
                  {fileHeaders.map(h => {
                    const t = detectedTypes[h];
                    const mapped = columnMapping[h];
                    return (
                      <span key={h} className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${TYPE_COLORS[t]}`}>
                        <span className="font-mono text-[10px]">{TYPE_ICONS[t]}</span>
                        {mapped ? HEADER_DISPLAY_NAMES[mapped] || h : h}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Validation Warnings */}
              {validationPreview.length > 0 && (
                <div className={`border rounded-lg p-3 ${validationPreview.some(w => w.severity === 'error') ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'}`}>
                  <p className="text-xs font-semibold text-gray-600 mb-2">
                    {validationPreview.filter(w => w.severity === 'error').length} ralat, {validationPreview.filter(w => w.severity === 'warn').length} amaran dikesan
                  </p>
                  <div className="space-y-1 max-h-32 overflow-auto">
                    {validationPreview.slice(0, 10).map((w, i) => (
                      <div key={i} className={`flex items-center gap-2 text-xs ${w.severity === 'error' ? 'text-red-700' : 'text-yellow-700'}`}>
                        <AlertCircle className="w-3 h-3 flex-shrink-0" />
                        <span className="font-mono">Baris {w.row}</span>
                        <span>· {w.field}:</span>
                        <span>{w.issue}</span>
                      </div>
                    ))}
                    {validationPreview.length > 10 && <p className="text-xs text-gray-500 ml-5">... dan {validationPreview.length - 10} lagi</p>}
                  </div>
                </div>
              )}

              {/* Data Preview Table */}
              <div className="border rounded-lg overflow-hidden">
                <div className="max-h-48 overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-100 sticky top-0">
                      <tr>
                        <th className="px-2 py-1.5 text-left font-semibold">#</th>
                        {fileHeaders.filter(h => columnMapping[h]).slice(0, 6).map(h => (
                          <th key={h} className="px-2 py-1.5 text-left font-semibold">
                            {HEADER_DISPLAY_NAMES[columnMapping[h]] || columnMapping[h]}
                            <span className="ml-1 font-normal text-gray-400">{TYPE_ICONS[detectedTypes[h]]}</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {allRows.slice(0, 5).map((row, idx) => (
                        <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-2 py-1 text-gray-400">{idx + 1}</td>
                          {fileHeaders.filter(h => columnMapping[h]).slice(0, 6).map(h => (
                            <td key={h} className="px-2 py-1 max-w-[150px] truncate">{row[h] || '—'}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-3 py-1.5 bg-gray-50 border-t text-xs text-gray-500">
                  Memaparkan 5 / {allRows.length} baris · {Object.keys(columnMapping).length} lajur dipetakan
                </div>
              </div>

              {/* Sampling Dry-Run */}
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={samplingMode} onChange={e => setSamplingMode(e.target.checked)} className="rounded" />
                  <span className="text-gray-700">Mod Ujian (Import 3 baris pertama dahulu untuk pengesahan)</span>
                </label>
                {samplingResult && (
                  <div className={`p-3 rounded-lg text-sm ${samplingResult.success ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
                    <p className="font-medium">{samplingResult.message}</p>
                    {samplingResult.errors?.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {samplingResult.errors.slice(0, 5).map((e: string, i: number) => (
                          <p key={i} className="text-xs text-red-700">• {e}</p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex justify-between gap-2 pt-4">
                <button onClick={() => setStep(2)} className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50">
                  <ChevronLeft className="w-4 h-4" />Kembali ke Mapping
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      if (!selectedMasterlist) { setError('Pilih masterlist dahulu'); return; }
                      setSamplingResult(null);
                      try {
                        const token = storage.getToken();
                        const mappedRows = allRows.slice(0, 3).map((row) => {
                          const m: ImportRow = {};
                          Object.entries(columnMapping).forEach(([s, t]) => { if (t && row[s]) m[t] = row[s]; });
                          return m;
                        }).filter(r => Object.values(r).some(v => String(v || '').trim()));
                        const apiBase = getApiBaseUrl();
                        const res = await fetch(`${apiBase}/assets/import/process`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                          body: JSON.stringify({ masterlist_id: selectedMasterlist, rows: mappedRows, columnMapping, dryRun: true }),
                        });
                        const data = await res.json();
                        setSamplingResult(data.data || data);
                      } catch { setError('Gagal ujian import'); }
                    }}
                    className="flex items-center gap-2 px-3 py-2 text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 text-sm"
                  >
                    <Zap className="w-4 h-4" />Uji 3 Baris
                  </button>
                  <button onClick={() => setStep(4)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    Mula Import <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Import Progress */}
          {step === 4 && (
            <div className="space-y-6 py-4">
              <div className="text-center">
                <h3 className="font-medium text-gray-900 mb-4">Memproses Import...</h3>
                <div className="bg-gray-100 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-blue-600 to-blue-700 h-full transition-all duration-500 ease-out"
                    style={{ width: `${importProgress}%` }}
                  />
                </div>
                <p className="text-sm text-gray-600 mt-3">
                  {importProgress > 0 ? `${Math.round(importProgress * allRows.length / 100)} / ${allRows.length} baris` : 'Bermula...'}
                </p>
              </div>

              <button
                onClick={handleImport}
                disabled={isImporting}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isImporting ? 'Mengimport...' : 'Mulakan Import'}
              </button>
            </div>
          )}

          {/* Step 5: Import Results */}
          {step === 5 && importResult && (
            <div className="space-y-4">
              <div className={`p-4 rounded-lg ${importResult.success ? 'bg-green-50' : 'bg-yellow-50'}`}>
                <div className="flex items-center gap-3 mb-2">
                  {importResult.success ? (
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  ) : (
                    <AlertCircle className="w-6 h-6 text-yellow-600" />
                  )}
                  <h3 className={`font-medium ${importResult.success ? 'text-green-900' : 'text-yellow-900'}`}>
                    {importResult.success ? 'Import Berjaya!' : 'Import Selesai dengan Ralat'}
                  </h3>
                </div>
                <div className="text-sm space-y-1">
                  <p>Total: {importResult.totalRows} rows</p>
                  <p className="text-green-700 font-medium">✓ Berjaya: {importResult.successCount}</p>
                  {typeof importResult.createdCount === 'number' && (
                    <p className="text-blue-700 font-medium">+ Baru: {importResult.createdCount}</p>
                  )}
                   {typeof importResult.updatedCount === 'number' && (
                     <p className="text-indigo-700 font-medium">↻ Kemaskini: {importResult.updatedCount}</p>
                   )}
                   {typeof (importResult as any).pairedCount === 'number' && (importResult as any).pairedCount > 0 && (
                     <p className="text-purple-700 font-medium">⚡ Aset Berpasangan: {(importResult as any).pairedCount}</p>
                   )}
                   {importResult.errorCount > 0 && (
                    <p className="text-red-700 font-medium">✗ Gagal: {importResult.errorCount}</p>
                  )}
                </div>
              </div>

              {importResult.errors.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-gray-900">Errors:</h4>
                  <div className="space-y-2 max-h-40 overflow-auto border border-red-200 rounded-lg p-3 bg-red-50">
                    {importResult.errors.map((err, idx) => (
                      <div key={idx} className="text-sm">
                        <p className="font-medium text-red-700 flex items-center gap-2">
                          <span>Row {err.rowNumber}:</span>
                          {err.errors.some((message) => /serial number|masterlist lain/i.test(message)) && (
                            <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700 border border-red-200">
                              Conflict Serial
                            </span>
                          )}
                        </p>
                        <ul className="text-red-600 ml-4 text-xs">
                          {err.errors.map((e, i) => (
                            <li key={i}>• {e}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2 pt-4 sm:flex-row">
                <button
                  onClick={() => {
                    onClose();
                    if (onImportSuccess && selectedMasterlist) {
                      onImportSuccess(selectedMasterlist);
                    }
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Tutup & Lihat Aset
                </button>
                <button
                  onClick={() => {
                    setStep(1);
                    setFile(null);
                    setError(null);
                    setImportResult(null);
                  }}
                  className="px-4 py-2 text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50"
                >
                  Import Lagi
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AssetImportModal;
