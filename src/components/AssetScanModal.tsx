import React, { useRef, useState } from 'react';
import { Camera, CheckCircle, AlertTriangle, XCircle, Upload, X, Plus, Trash2, Loader2 } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { storage } from '../utils/storage';
import { getApiBaseUrl } from '../utils/apiUrl';

// ── Types ────────────────────────────────────────────────────────────────────

interface ScanItem {
  id: string; // local uuid
  label: string;
  file: File | null;
  previewUrl: string | null;
  // After OCR
  extractedSN: string;
  confidence: 'high' | 'medium' | 'low' | null;
  rawText: string;
  // User-confirmed/edited
  confirmedSN: string;
  name: string;
  model: string;
  status: string;
  notes: string;
  // Result after upsert
  action: 'created' | 'updated' | 'conflict' | 'error' | null;
  conflict_masterlist?: string;
  error?: string;
  asset_id?: number;
}

interface UserForm {
  user_name: string;
  position: string;
  department: string;
  floor: string;
  building: string;
  location: string;
  branch: string;
  state: string;
}

interface AssetScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  masterlistId: number;
  masterlistName?: string;
  onScanSuccess: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const makeId = () => Math.random().toString(36).slice(2, 10);

const confidenceBadge = (c: 'high' | 'medium' | 'low' | null) => {
  if (!c) return null;
  const map = {
    high: 'bg-green-100 text-green-700',
    medium: 'bg-yellow-100 text-yellow-700',
    low: 'bg-red-100 text-red-700',
  };
  const label = { high: 'Keyakinan Tinggi', medium: 'Sederhana', low: 'Rendah – Sila Semak' };
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${map[c]}`}>
      {label[c]}
    </span>
  );
};

const resultIcon = (action: ScanItem['action']) => {
  if (action === 'created') return <CheckCircle className="w-4 h-4 text-green-600" />;
  if (action === 'updated') return <CheckCircle className="w-4 h-4 text-blue-600" />;
  if (action === 'conflict') return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
  if (action === 'error') return <XCircle className="w-4 h-4 text-red-600" />;
  return null;
};

const resultLabel = (item: ScanItem): React.ReactNode => {
  if (item.action === 'created') return <span className="text-green-700 text-sm">Berjaya dicipta</span>;
  if (item.action === 'updated') return <span className="text-blue-700 text-sm">Berjaya dikemaskini</span>;
  if (item.action === 'conflict')
    return <span className="text-yellow-700 text-sm">Konflik – SN wujud dalam: {item.conflict_masterlist}</span>;
  if (item.action === 'error')
    return <span className="text-red-700 text-sm">{item.error}</span>;
  return null;
};

const getSNStatusRemark = (item: ScanItem): string | null => {
  if (item.confirmedSN.trim()) return null;
  if (item.confidence === 'low') return 'SN tidak dikesan. Sila isi manual.';
  return 'SN belum disahkan.';
};

// ── Component ─────────────────────────────────────────────────────────────────

type Step = 'upload' | 'confirm' | 'result';

export const AssetScanModal: React.FC<AssetScanModalProps> = ({
  isOpen, onClose, masterlistId, masterlistName, onScanSuccess
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('upload');
  const [items, setItems] = useState<ScanItem[]>([
    { id: makeId(), label: 'CPU', file: null, previewUrl: null, extractedSN: '', confidence: null, rawText: '', confirmedSN: '', name: '', model: '', status: 'Aktif', notes: '', action: null },
    { id: makeId(), label: 'Monitor', file: null, previewUrl: null, extractedSN: '', confidence: null, rawText: '', confirmedSN: '', name: '', model: '', status: 'Aktif', notes: '', action: null },
  ]);
  const [activeItemId, setActiveItemId] = useState<string>('');
  const [userForm, setUserForm] = useState<UserForm>({
    user_name: '', position: '', department: '', floor: '', building: '', location: '', branch: '', state: ''
  });
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  if (!isOpen) return null;

  const token = storage.getToken();

  // ── Upload step handlers ──────────────────────────────────────────────────

  const addItem = () => {
    const id = makeId();
    setItems(prev => [...prev, {
      id, label: `Aset ${prev.length + 1}`, file: null, previewUrl: null,
      extractedSN: '', confidence: null, rawText: '', confirmedSN: '',
      name: '', model: '', status: 'Aktif', notes: '', action: null
    }]);
  };

  const removeItem = (id: string) => {
    setItems(prev => {
      const updated = prev.filter(i => i.id !== id);
      // revoke object URL
      const removed = prev.find(i => i.id === id);
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      return updated;
    });
  };

  const handleFileSelect = (id: string, file: File) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return { ...item, file, previewUrl: URL.createObjectURL(file) };
    }));
  };

  const handleLabelChange = (id: string, label: string) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, label } : item));
  };

  const canScan = items.some(i => i.file);

  // ── OCR Scan ──────────────────────────────────────────────────────────────

  const handleScan = async () => {
    const itemsWithFiles = items.filter(i => i.file);
    if (!itemsWithFiles.length) return;

    setScanning(true);
    setScanError(null);

    try {
      const formData = new FormData();
      itemsWithFiles.forEach((item, idx) => {
        formData.append('images', item.file!);
        formData.append(`labels`, item.label);
      });

      const apiBase = getApiBaseUrl();
      const res = await fetch(`${apiBase}/assets/scan/extract`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        const errMsg = json.message || 'Gagal scan imej.';
        if (errMsg.includes('does not support image') || errMsg.includes('image input')) {
          throw new Error('Model AI semasa tidak menyokong input imej. Sila guna fitur Import CSV (Import Aset) untuk memproses data secara manual, atau aktifkan model Vision di Tetapan → Integrasi AI.');
        }
        throw new Error(errMsg);
      }

      // Merge OCR results back into items
      const resultMap = new Map<number, typeof json.data[0]>();
      (json.data as Array<{ index: number; extractedSN: string; confidence: 'high' | 'medium' | 'low'; rawText: string }>)
        .forEach(r => resultMap.set(r.index, r));

      setItems(prev => prev.map(item => {
        const fileIdx = itemsWithFiles.findIndex(i => i.id === item.id);
        if (fileIdx === -1) return item;
        const result = resultMap.get(fileIdx);
        if (!result) return item;
        return {
          ...item,
          extractedSN: result.extractedSN,
          confidence: result.confidence,
          rawText: result.rawText,
          confirmedSN: result.extractedSN,
          name: item.name || item.label
        };
      }));

      // Items without files keep their state; pre-fill name for them too
      setItems(prev => prev.map(item => ({
        ...item,
        name: item.name || item.label
      })));

      setActiveItemId(itemsWithFiles[0]?.id || '');
      setStep('confirm');
    } catch (err: any) {
      setScanError(err.message || 'Ralat semasa scan.');
    } finally {
      setScanning(false);
    }
  };

  // ── Upsert / Save ─────────────────────────────────────────────────────────

  const handleSave = async () => {
    // Validate: all items with files need confirmedSN + name
    const withFiles = items.filter(i => i.file);
    for (const item of withFiles) {
      if (!item.confirmedSN.trim()) {
        setSaveError(`"${item.label}": Serial number diperlukan.`);
        return;
      }
      if (!item.name.trim()) {
        setSaveError(`"${item.label}": Nama aset diperlukan.`);
        return;
      }
    }

    setSaving(true);
    setSaveError(null);

    try {
      const payload = {
        masterlist_id: masterlistId,
        assets: withFiles.map(item => ({
          label: item.label,
          serial_number: item.confirmedSN.trim(),
          name: item.name.trim(),
          model: item.model.trim() || undefined,
          status: item.status || 'Aktif',
          notes: item.notes.trim() || undefined,
        })),
        user: userForm.user_name.trim() ? {
          user_name: userForm.user_name.trim(),
          position: userForm.position.trim() || undefined,
          department: userForm.department.trim() || undefined,
          floor: userForm.floor.trim() || undefined,
          building: userForm.building.trim() || undefined,
          location: userForm.location.trim() || undefined,
          branch: userForm.branch.trim() || undefined,
          state: userForm.state.trim() || undefined,
        } : undefined
      };

      const apiBase = getApiBaseUrl();
      const res = await fetch(`${apiBase}/assets/scan/upsert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Gagal simpan.');

      const resultsList = json.data.results as Array<{
        label: string;
        serial_number: string;
        action: ScanItem['action'];
        asset_id?: number;
        conflict_masterlist?: string;
        error?: string;
      }>;

      setItems(prev => prev.map(item => {
        const r = resultsList.find(x => x.label === item.label);
        if (!r) return item;
        return { ...item, action: r.action, asset_id: r.asset_id, conflict_masterlist: r.conflict_masterlist, error: r.error };
      }));

      setStep('result');
      onScanSuccess();
    } catch (err: any) {
      setSaveError(err.message || 'Ralat semasa simpan.');
    } finally {
      setSaving(false);
    }
  };

  // ── Reset ─────────────────────────────────────────────────────────────────

  const handleClose = () => {
    items.forEach(i => { if (i.previewUrl) URL.revokeObjectURL(i.previewUrl); });
    setItems([
      { id: makeId(), label: 'CPU', file: null, previewUrl: null, extractedSN: '', confidence: null, rawText: '', confirmedSN: '', name: '', model: '', status: 'Aktif', notes: '', action: null },
      { id: makeId(), label: 'Monitor', file: null, previewUrl: null, extractedSN: '', confidence: null, rawText: '', confirmedSN: '', name: '', model: '', status: 'Aktif', notes: '', action: null },
    ]);
    setUserForm({ user_name: '', position: '', department: '', floor: '', building: '', location: '', branch: '', state: '' });
    setStep('upload');
    setScanError(null);
    setSaveError(null);
    onClose();
  };

  // ── Update helpers ────────────────────────────────────────────────────────

  const updateItem = (id: string, field: keyof ScanItem, value: string) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const activeItem = items.find(i => i.id === activeItemId) || items[0];
  const scannedItems = items.filter(i => i.file);
  const lowConfidenceCount = scannedItems.filter(i => i.confidence === 'low').length;
  const unresolvedCount = scannedItems.filter(i => !i.confirmedSN.trim() || !i.name.trim()).length;

  // ── Step labels ───────────────────────────────────────────────────────────

  const stepLabels: Record<Step, string> = {
    upload: '1. Upload Gambar',
    confirm: '2. Sahkan & Isi Butiran',
    result: '3. Keputusan'
  };

  // ──────────────────────────────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-2xl w-full max-w-5xl h-[100dvh] sm:h-auto sm:max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b flex-shrink-0 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Camera className="w-5 h-5 text-blue-600" />
              <div>
                <h2 className="text-lg font-bold text-gray-800">Scan Aset</h2>
                <p className="text-xs text-gray-500">
                  {masterlistName ? `Masterlist: ${masterlistName}` : `Masterlist ID: ${masterlistId}`}
                </p>
              </div>
            </div>
            <button onClick={handleClose} className="text-gray-400 hover:text-gray-700 p-1">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <div className="flex items-center gap-2 text-xs min-w-max pr-2">
              {(['upload', 'confirm', 'result'] as Step[]).map((s, idx) => (
                <React.Fragment key={s}>
                  <span className={`px-2 py-1 rounded-full font-medium ${step === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                    <span className="sm:hidden">{idx + 1}</span>
                    <span className="hidden sm:inline">{stepLabels[s]}</span>
                  </span>
                  {idx < 2 && <span className="text-gray-300">›</span>}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-24 sm:pb-6 space-y-4">
            <p className="text-sm text-gray-600">
              Upload gambar sticker serial number untuk setiap aset yang ingin didaftarkan.
              AI akan cuba baca SN dari gambar, kemudian anda sahkan/edit sebelum simpan.
            </p>

            {items.map((item) => (
              <div key={item.id} className="border rounded-lg p-3 sm:p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <input
                    className="border rounded px-3 py-1.5 text-sm font-medium w-full sm:w-32 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                    value={item.label}
                    onChange={e => handleLabelChange(item.id, e.target.value)}
                    placeholder="Label (CPU, Monitor...)"
                  />
                  <span className="text-xs text-gray-400 flex-1 hidden sm:inline">Label jenis aset</span>
                  {items.length > 1 && (
                    <button onClick={() => removeItem(item.id)} className="text-red-400 hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {item.previewUrl ? (
                  <div className="flex flex-col sm:flex-row items-start gap-4">
                    <img
                      src={item.previewUrl}
                      alt={item.label}
                      className="w-40 h-28 object-contain border rounded bg-gray-50 cursor-pointer"
                      onClick={() => {
                        if (fileInputRef.current) {
                          fileInputRef.current.dataset.targetId = item.id;
                          fileInputRef.current.click();
                        }
                      }}
                    />
                    <div className="text-sm text-gray-600 space-y-1">
                      <p className="font-medium">{item.file?.name}</p>
                      <p className="text-xs text-gray-400">{item.file ? `${(item.file.size / 1024).toFixed(0)} KB` : ''}</p>
                      <button
                        className="text-xs text-blue-600 underline"
                        onClick={() => {
                          if (fileInputRef.current) {
                            fileInputRef.current.dataset.targetId = item.id;
                            fileInputRef.current.click();
                          }
                        }}
                      >
                        Tukar gambar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="border-2 border-dashed border-gray-300 rounded-lg p-4 sm:p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition"
                    onClick={() => {
                      if (fileInputRef.current) {
                        fileInputRef.current.dataset.targetId = item.id;
                        fileInputRef.current.click();
                      }
                    }}
                  >
                    <Upload className="w-6 h-6 mx-auto text-gray-400 mb-1" />
                    <p className="text-sm text-gray-500">Klik untuk upload gambar SN {item.label}</p>
                    <p className="text-xs text-gray-400 mt-1">JPG, PNG, WEBP – Maks 5MB</p>
                  </div>
                )}
              </div>
            ))}

            <button
              onClick={addItem}
              className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              <Plus className="w-4 h-4" /> Tambah Aset Lain
            </button>

            {scanError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
                {scanError}
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                const targetId = fileInputRef.current?.dataset.targetId;
                if (file && targetId) {
                  handleFileSelect(targetId, file);
                }
                e.target.value = '';
              }}
            />
          </div>
        )}

        {/* Step 2: Confirm + User Form */}
        {step === 'confirm' && (
          <div className="flex-1 overflow-y-auto md:overflow-hidden flex flex-col md:flex-row">
            {/* LEFT: AI Results per item — flows inline on mobile, scrollable sidebar on desktop */}
            <div className="w-full md:w-64 flex-shrink-0 border-b md:border-b-0 md:border-r md:overflow-y-auto bg-gray-50">
              <div className="p-3 border-b">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Hasil Scan AI</p>
                <p className="text-xs text-gray-400 mt-0.5">Klik item untuk semak & edit</p>
              </div>
              <div className="divide-y">
                {scannedItems.map(item => (
                  <button
                    key={item.id}
                    onClick={() => setActiveItemId(item.id)}
                    className={`w-full text-left p-3 space-y-1 transition ${activeItemId === item.id ? 'bg-blue-50 border-l-2 border-blue-500' : 'hover:bg-gray-100'}`}
                  >
                    <p className="text-sm font-semibold text-gray-800">{item.label}</p>
                    <p className="text-xs text-gray-500 font-mono truncate">
                      {item.confirmedSN || <span className="text-red-500 italic">{getSNStatusRemark(item)}</span>}
                    </p>
                    {confidenceBadge(item.confidence)}
                    {item.confidence === 'low' && (
                      <p className="text-xs text-red-500 font-medium">⚠ Sila semak SN</p>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* RIGHT: Edit form for active item + User form */}
            <div className="flex-1 md:overflow-y-auto p-4 sm:p-5 space-y-5">
              <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="inline-flex items-center rounded-full bg-white px-2 py-1 text-blue-700 font-medium">
                    Jumlah Scan: {scannedItems.length}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-white px-2 py-1 text-amber-700 font-medium">
                    Confidence Rendah: {lowConfidenceCount}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-white px-2 py-1 text-red-700 font-medium">
                    Belum Lengkap: {unresolvedCount}
                  </span>
                </div>
                {(lowConfidenceCount > 0 || unresolvedCount > 0) && (
                  <p className="mt-1 text-xs text-gray-600">
                    Sila semak item bertanda amaran sebelum tekan "Simpan ke DB".
                  </p>
                )}
              </div>

              {activeItem && activeItem.file && (
                <div className="border rounded-lg p-4 space-y-3 bg-white">
                  <div className="flex flex-col sm:flex-row items-start gap-4">
                    {activeItem.previewUrl && (
                      <img
                        src={activeItem.previewUrl}
                        alt={activeItem.label}
                        className="w-32 h-24 object-contain border rounded bg-gray-50 flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-800">{activeItem.label}</h3>
                        {confidenceBadge(activeItem.confidence)}
                      </div>
                      {activeItem.rawText && (
                        <p className="text-xs text-gray-400 leading-relaxed">
                          <span className="font-medium">Teks dijumpai:</span> {activeItem.rawText}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Serial Number (SN) *
                        {activeItem.confidence === 'low' && (
                          <span className="ml-2 text-red-500 text-xs">⚠ Sila semak</span>
                        )}
                      </label>
                      <input
                        className="w-full border rounded-md px-3 py-2 text-sm font-mono uppercase focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                        value={activeItem.confirmedSN}
                        onChange={e => updateItem(activeItem.id, 'confirmedSN', e.target.value.toUpperCase())}
                        placeholder="Serial number"
                      />
                      {!activeItem.confirmedSN.trim() && (
                        <p className="mt-1 text-xs text-red-600">{getSNStatusRemark(activeItem)}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nama Aset *</label>
                      <input
                        className="w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                        value={activeItem.name}
                        onChange={e => updateItem(activeItem.id, 'name', e.target.value)}
                        placeholder="Nama aset"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                      <input
                        className="w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                        value={activeItem.model}
                        onChange={e => updateItem(activeItem.id, 'model', e.target.value)}
                        placeholder="Model (opsyenal)"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                      <select
                        className="w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                        value={activeItem.status}
                        onChange={e => updateItem(activeItem.id, 'status', e.target.value)}
                      >
                        <option value="Aktif">Aktif</option>
                        <option value="Tidak Aktif">Tidak Aktif</option>
                        <option value="Rosak">Rosak</option>
                        <option value="Lupus">Lupus</option>
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Catatan</label>
                      <input
                        className="w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                        value={activeItem.notes}
                        onChange={e => updateItem(activeItem.id, 'notes', e.target.value)}
                        placeholder="Catatan (opsyenal)"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* User Details Section */}
              <div className="border rounded-lg p-4 space-y-3 bg-white">
                <h3 className="font-semibold text-gray-800 text-sm">Maklumat Pengguna Aset <span className="font-normal text-gray-400">(dikongsi untuk semua aset yang discan)</span></h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input label="Nama Pengguna" value={userForm.user_name} onChange={e => setUserForm(p => ({ ...p, user_name: e.target.value }))} placeholder="Nama pengguna" />
                  <Input label="Jawatan" value={userForm.position} onChange={e => setUserForm(p => ({ ...p, position: e.target.value }))} placeholder="Opsyenal" />
                  <Input label="Bahagian/Jabatan" value={userForm.department} onChange={e => setUserForm(p => ({ ...p, department: e.target.value }))} placeholder="Opsyenal" />
                  <Input label="Tingkat" value={userForm.floor} onChange={e => setUserForm(p => ({ ...p, floor: e.target.value }))} placeholder="Opsyenal" />
                  <Input label="Bangunan" value={userForm.building} onChange={e => setUserForm(p => ({ ...p, building: e.target.value }))} placeholder="Opsyenal" />
                  <Input label="Lokasi" value={userForm.location} onChange={e => setUserForm(p => ({ ...p, location: e.target.value }))} placeholder="Opsyenal" />
                  <Input label="Cawangan" value={userForm.branch} onChange={e => setUserForm(p => ({ ...p, branch: e.target.value }))} placeholder="Opsyenal" />
                  <Input label="Negeri" value={userForm.state} onChange={e => setUserForm(p => ({ ...p, state: e.target.value }))} placeholder="Opsyenal" />
                </div>
              </div>

              {saveError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
                  {saveError}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Result */}
        {step === 'result' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-24 sm:pb-6 space-y-3">
            <p className="text-sm font-semibold text-gray-700 mb-3">Keputusan Simpan:</p>
            {items.filter(i => i.file).map(item => (
              <div
                key={item.id}
                className={`flex items-start gap-3 p-4 rounded-lg border ${
                  item.action === 'created' ? 'bg-green-50 border-green-200' :
                  item.action === 'updated' ? 'bg-blue-50 border-blue-200' :
                  item.action === 'conflict' ? 'bg-yellow-50 border-yellow-200' :
                  'bg-red-50 border-red-200'
                }`}
              >
                {resultIcon(item.action)}
                <div>
                  <p className="font-semibold text-sm text-gray-800">{item.label}</p>
                  <p className="text-xs text-gray-500 font-mono">{item.confirmedSN}</p>
                  <div className="mt-1">{resultLabel(item)}</div>
                </div>
              </div>
            ))}
            <div className="pt-2">
              <Button onClick={handleClose}>Tutup</Button>
            </div>
          </div>
        )}

        {/* Footer */}
        {step !== 'result' && (
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-t flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3 flex-shrink-0 bg-gray-50">
            <Button className="w-full sm:w-auto" variant="secondary" onClick={handleClose} disabled={scanning || saving}>
              Batal
            </Button>

            {step === 'upload' && (
              <Button
                onClick={handleScan}
                disabled={!canScan || scanning}
                className="w-full sm:w-auto flex items-center justify-center gap-2"
              >
                {scanning
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> AI sedang scan...</>
                  : <><Camera className="w-4 h-4" /> Scan dengan AI</>
                }
              </Button>
            )}

            {step === 'confirm' && (
              <div className="w-full sm:w-auto flex gap-2 sm:gap-3">
                <Button className="flex-1 sm:flex-none" variant="secondary" onClick={() => setStep('upload')}>
                  Kembali
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2"
                >
                  {saving
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...</>
                    : 'Simpan ke DB'
                  }
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
