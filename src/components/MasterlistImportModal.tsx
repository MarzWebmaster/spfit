import React, { useState, useRef } from 'react';
import { Upload, ChevronRight, ChevronLeft, AlertCircle, CheckCircle, Download } from 'lucide-react';
import { masterlistsApi } from '../services/api';
import { storage } from '../utils/storage';
import { getApiBaseUrl } from '../utils/apiUrl';

interface ImportRow {
  [key: string]: string | undefined;
}

const HEADER_DISPLAY_NAMES: Record<string, string> = {
  project_code: 'Kod Projek',
  code: 'Kod Masterlist',
  name: 'Nama Masterlist',
  description: 'Keterangan',
  status: 'Status',
};

const EXPECTED_HEADERS = ['project_code', 'code', 'name', 'description', 'status'];

const SAMPLE_DATA = [
  { project_code: 'PRJ-001', code: 'ML-001', name: 'IT Equipment HQ', description: 'Peralatan IT ibu pejabat', status: 'Aktif' },
  { project_code: 'PRJ-001', code: 'ML-002', name: 'Network Devices', description: 'Peralatan rangkaian', status: 'Aktif' },
];

interface MasterlistImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: () => void;
}

export const MasterlistImportModal: React.FC<MasterlistImportModalProps> = ({ isOpen, onClose, onImportSuccess }) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [file, setFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<ImportRow[]>([]);
  const [allRows, setAllRows] = useState<ImportRow[]>([]);
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<{ [key: string]: string }>({});
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const generateTemplate = () => {
    const headers = EXPECTED_HEADERS.map(h => HEADER_DISPLAY_NAMES[h] || h).join(',');
    const rows = SAMPLE_DATA.map(row => EXPECTED_HEADERS.map(h => row[h as keyof typeof row] || '').join(','));
    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `template_import_masterlist_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setError(null);
    setFile(f);

    try {
      const token = storage.getToken();
      if (!token) { setError('Sesi log masuk tidak sah.'); return; }

      const formData = new FormData();
      formData.append('file', f);

      const apiBase = getApiBaseUrl();
      const res = await fetch(`${apiBase}/masterlists/import/validate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();
      if (!data.success) { setError(data.message || 'Ralat validasi fail'); return; }

      setPreviewRows(data.data.sampleRows || []);
      setAllRows(data.data.allRows || []);
      setFileHeaders(data.data.headers || []);

      // Auto-map
      const auto: Record<string, string> = {};
      data.data.headers.forEach((h: string) => {
        const lh = h.toLowerCase().trim();
        const match = EXPECTED_HEADERS.find(k => k === lh || HEADER_DISPLAY_NAMES[k]?.toLowerCase() === lh);
        if (match) auto[h] = match;
      });
      setColumnMapping(auto);
      setStep(2);
    } catch { setError('Ralat memuat naik fail.'); }
  };

  const handleMapColumn = (header: string, to: string) => {
    setColumnMapping(prev => ({ ...prev, [header]: to || '' }));
  };

  const handleImport = async () => {
    if (!file) return;
    setError(null);
    setIsImporting(true);

    try {
      const token = storage.getToken();
      if (!token) { setError('Sesi log masuk tidak sah.'); return; }

      const mappedRows = allRows.map(row => {
        const m: Record<string, string> = {};
        Object.entries(columnMapping).forEach(([src, target]) => {
          if (target && row[src]) m[target] = row[src];
        });
        return m;
      }).filter(r => Object.values(r).some(v => v?.trim()));

      const apiBase = getApiBaseUrl();
      const res = await fetch(`${apiBase}/masterlists/import/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ rows: mappedRows, columnMapping }),
      });

      const data = await res.json();
      setImportResult(data.data || data);
      setStep(4);
      if (data.success) onImportSuccess();
    } catch { setError('Ralat semasa import.'); }
    finally { setIsImporting(false); }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="mx-4 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg bg-white shadow-xl">
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 text-white flex items-center justify-between">
          <h2 className="text-xl font-bold">Import Masterlist</h2>
          <button onClick={onClose} className="text-white hover:bg-blue-800 rounded p-1">✕</button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-800 text-sm">
              <AlertCircle className="w-4 h-4" />{error}
            </div>
          )}

          {/* Step 1: Upload */}
          {step === 1 && (
            <div className="space-y-4">
              <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition">
                <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                <p className="text-sm text-gray-600">Drag & drop atau klik untuk pilih fail</p>
                <p className="text-xs text-gray-500 mt-1">CSV, XLSX, PDF, DOCX, TXT</p>
              </div>
              <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls,.pdf,.docx,.txt" onChange={handleFileSelect} className="hidden" />
              <button onClick={generateTemplate} className="w-full flex items-center justify-center gap-2 px-4 py-2 text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50">
                <Download className="w-4 h-4" />Muat Turun Template
              </button>
              <div className="flex justify-end">
                <button onClick={onClose} className="px-4 py-2 text-gray-700 border rounded-lg hover:bg-gray-50">Batal</button>
              </div>
            </div>
          )}

          {/* Step 2: Mapping */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-gray-900 mb-2">Preview ({previewRows.length} baris)</h3>
                <div className="border rounded-lg p-3 bg-gray-50 max-h-32 overflow-auto text-xs">
                  <table className="w-full"><thead><tr>{fileHeaders.slice(0, 5).map(h => <th key={h} className="px-2 py-1 text-left">{h}</th>)}</tr></thead>
                    <tbody>{previewRows.slice(0, 2).map((r, i) => <tr key={i}>{fileHeaders.slice(0, 5).map(h => <td key={h} className="px-2 py-1">{r[h] || '-'}</td>)}</tr>)}</tbody></table>
                </div>
              </div>

              <div>
                <h3 className="font-medium text-gray-900 mb-2">Field Mapping</h3>
                <p className="text-xs text-gray-500 mb-3">{Object.keys(columnMapping).length} lajur dipadankan automatik. Semak di bawah.</p>
                <div className="space-y-2 max-h-60 overflow-auto">
                  {fileHeaders.map(h => {
                    const mapped = Boolean(columnMapping[h]);
                    return (
                      <div key={h} className={`flex items-center gap-2 p-1 rounded ${mapped ? 'bg-green-50' : 'bg-yellow-50'}`}>
                        <span className={`w-2 h-2 rounded-full ${mapped ? 'bg-green-500' : 'bg-yellow-500'}`} />
                        <span className={`text-sm w-36 truncate ${mapped ? 'font-medium' : ''}`}>{h}</span>
                        <span className="text-gray-400">→</span>
                        <select value={columnMapping[h] || ''} onChange={e => handleMapColumn(h, e.target.value)} className="flex-1 px-2 py-1 border rounded text-sm">
                          <option value="">-- Skip --</option>
                          {EXPECTED_HEADERS.map(k => <option key={k} value={k}>{HEADER_DISPLAY_NAMES[k]}</option>)}
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-between gap-2 pt-4">
                <button onClick={() => setStep(1)} className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"><ChevronLeft className="w-4 h-4" />Kembali</button>
                <button onClick={() => setStep(3)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Seterusnya<ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
          )}

          {/* Step 3: Import */}
          {step === 3 && (
            <div className="space-y-6 py-4 text-center">
              <p className="text-gray-700">{allRows.length} rekod sedia untuk diimport.</p>
              <button onClick={handleImport} disabled={isImporting} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400">
                {isImporting ? 'Mengimport...' : 'Mulakan Import'}
              </button>
            </div>
          )}

          {/* Step 4: Result */}
          {step === 4 && importResult && (
            <div className="space-y-4">
              <div className={`p-4 rounded-lg ${importResult.errorCount === 0 ? 'bg-green-50' : 'bg-yellow-50'}`}>
                <div className="flex items-center gap-3 mb-2">
                  {importResult.errorCount === 0 ? <CheckCircle className="w-6 h-6 text-green-600" /> : <AlertCircle className="w-6 h-6 text-yellow-600" />}
                  <h3 className="font-medium">{importResult.errorCount === 0 ? 'Import Berjaya!' : 'Import Selesai dengan Ralat'}</h3>
                </div>
                <div className="text-sm space-y-1">
                  <p className="text-blue-700">+ Baru: {importResult.created || 0}</p>
                  <p className="text-indigo-700">↻ Dikemaskini: {importResult.updated || 0}</p>
                  {importResult.errors?.length > 0 && <p className="text-red-700">✗ Ralat: {importResult.errors.length}</p>}
                </div>
              </div>
              {importResult.errors?.length > 0 && (
                <div className="border border-red-200 rounded-lg p-3 bg-red-50 max-h-40 overflow-auto">
                  {importResult.errors.map((e: string, i: number) => <p key={i} className="text-sm text-red-700">• {e}</p>)}
                </div>
              )}
              <button onClick={onClose} className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Tutup</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MasterlistImportModal;
