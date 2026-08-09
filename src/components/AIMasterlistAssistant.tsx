import React, { useRef, useState } from 'react';
import { ClipboardList, Send, X, Paperclip, Loader2, FileText, CheckCircle2, AlertTriangle, RefreshCw, Camera, Pencil, Save, FileJson, Ban } from 'lucide-react';
import { Button } from './ui/Button';
import { aiMasterlistAssistantApi, masterlistsApi, projectsApi } from '../services/api';

interface AssetUpdateDraft {
  serial_number?: string;
  asset_tag?: string;
  asset_name?: string;
  brand?: string;
  model?: string;
  user_name?: string;
  position?: string;
  department?: string;
  floor?: string;
  building?: string;
  location?: string;
  branch?: string;
  state?: string;
  notes?: string;
  accessories?: Array<{
    type: 'monitor' | 'keyboard' | 'mouse' | 'other';
    serial_number?: string;
    name?: string;
    brand?: string;
    model?: string;
  }>;
}

interface ApplyResult {
  index: number;
  serial_number?: string;
  asset_tag?: string;
  asset_id?: number;
  status: 'updated' | 'not_found' | 'error' | 'confirmation_required';
  message?: string;
}

interface PendingConfirmation {
  index: number;
  type: 'nearest_candidate' | 'cross_masterlist';
  serial_number: string;
  message: string;
  candidate_asset_id?: number;
  candidate_serial_number?: string;
  candidate_asset_name?: string;
  similarity?: number;
  existing_asset_id?: number;
  existing_masterlist_id?: number;
  existing_masterlist_name?: string;
  existing_project_id?: number;
  existing_project_name?: string;
}

interface ResolutionChoice {
  action: 'use_candidate' | 'create_new' | 'force_cross_masterlist';
  asset_id?: number;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface ProjectOption {
  id: number;
  code: string;
  name: string;
}

interface MasterlistOption {
  id: number;
  project_id: number;
  code: string;
  name: string;
}

type SourceMode = 'combined' | 'files_only' | 'chat_only';

const makeId = () => Math.random().toString(36).slice(2, 10);

const DRAFT_LABELS: Record<keyof AssetUpdateDraft, string> = {
  serial_number: 'Serial Number',
  asset_tag: 'Asset Tag',
  asset_name: 'Nama Aset',
  brand: 'Jenama',
  model: 'Model',
  user_name: 'Nama Pengguna',
  position: 'Jawatan',
  department: 'Bahagian/Jabatan',
  floor: 'Tingkat',
  building: 'Bangunan',
  location: 'Lokasi/Bilik',
  branch: 'Cawangan',
  state: 'Negeri',
  notes: 'Catatan / Remark',
  accessories: 'Aksesori Tambahan'
};

function toUpper(value: unknown): string {
  return String(value || '').trim().toUpperCase();
}

function normalizeSerial(value: unknown): string {
  return toUpper(value).replace(/\s+/g, '').replace(/O/g, '0');
}

function normalizeDraft(item: AssetUpdateDraft): AssetUpdateDraft {
  return {
    ...item,
    serial_number: normalizeSerial(item.serial_number),
    asset_tag: toUpper(item.asset_tag),
    asset_name: toUpper(item.asset_name),
    brand: toUpper(item.brand),
    model: toUpper(item.model),
    user_name: toUpper(item.user_name),
    position: toUpper(item.position),
    department: toUpper(item.department),
    floor: toUpper(item.floor),
    building: toUpper(item.building),
    location: toUpper(item.location),
    branch: toUpper(item.branch),
    state: toUpper(item.state)
  };
}

function extractRows<T>(source: any, key: string): T[] {
  if (!source) return [];
  if (Array.isArray(source[key])) return source[key] as T[];
  if (Array.isArray(source?.data?.[key])) return source.data[key] as T[];
  if (Array.isArray(source)) return source as T[];
  return [];
}

export const AIMasterlistAssistant: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const messageEndRef = useRef<HTMLDivElement>(null);

  const [prompt, setPrompt] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: makeId(),
      role: 'assistant',
      content:
        'Hantar gambar label peralatan (untuk baca serial number) dan/atau borang pengguna (nama, jabatan, lokasi, cawangan dll). Saya akan ekstrak maklumat dan sediakan kemaskini untuk masterlist.'
    }
  ]);
  const [drafts, setDrafts] = useState<AssetUpdateDraft[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [masterlists, setMasterlists] = useState<MasterlistOption[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedMasterlistId, setSelectedMasterlistId] = useState('');
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [hasSentFiles, setHasSentFiles] = useState(false);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applyResults, setApplyResults] = useState<ApplyResult[] | null>(null);
  const [pendingConfirmations, setPendingConfirmations] = useState<PendingConfirmation[]>([]);
  const [resolutions, setResolutions] = useState<Record<string, ResolutionChoice>>({});
  const [sourceMode, setSourceMode] = useState<SourceMode>('combined');
  const [editingDraftIndex, setEditingDraftIndex] = useState<number | null>(null);
  const [editingDraft, setEditingDraft] = useState<AssetUpdateDraft>({});
  const [draftSavedMessage, setDraftSavedMessage] = useState(false);
  const [pdfProcessing, setPdfProcessing] = useState(false);
  const [pdfProgress, setPdfProgress] = useState({ current: 0, total: 0 });
  const [pdfStatusMsg, setPdfStatusMsg] = useState('');
  const [pdfFileName, setPdfFileName] = useState('');
  const pdfAbortRef = useRef<AbortController | null>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  React.useEffect(() => {
    const loadProjects = async () => {
      setLoadingOptions(true);
      try {
        const response = await projectsApi.getAll(1, 100, { sortBy: 'name', sort: 'asc' });
        if (!response.success || !response.data) {
          setProjects([]);
          return;
        }
        setProjects(extractRows<ProjectOption>(response.data as any, 'projects'));
      } catch {
        setProjects([]);
      } finally {
        setLoadingOptions(false);
      }
    };

    loadProjects();
  }, []);

  React.useEffect(() => {
    const loadMasterlists = async () => {
      if (!selectedProjectId) {
        setMasterlists([]);
        setSelectedMasterlistId('');
        return;
      }

      setLoadingOptions(true);
      try {
        const response = await masterlistsApi.getAll(1, 100, {
          project_id: Number(selectedProjectId),
          sortBy: 'name',
          sort: 'asc'
        });
        if (!response.success || !response.data) {
          setMasterlists([]);
          setSelectedMasterlistId('');
          return;
        }
        const rows = extractRows<MasterlistOption>(response.data as any, 'masterlists');
        setMasterlists(rows);
        setSelectedMasterlistId((prev) => (rows.some((item) => String(item.id) === prev) ? prev : ''));
      } catch {
        setMasterlists([]);
        setSelectedMasterlistId('');
      } finally {
        setLoadingOptions(false);
      }
    };

    loadMasterlists();
  }, [selectedProjectId]);

  const resetAssistant = () => {
    setPrompt('');
    setFiles([]);
    setDrafts([]);
    setWarnings([]);
    setIsComplete(false);
    setHasSentFiles(false);
    setError(null);
    setApplyResults(null);
    setPendingConfirmations([]);
    setResolutions({});
    setEditingDraftIndex(null);
    setEditingDraft({});
    setDraftSavedMessage(false);
    setMessages([
      {
        id: makeId(),
        role: 'assistant',
        content:
          'Hantar gambar label peralatan (untuk baca serial number) dan/atau borang pengguna (nama, jabatan, lokasi, cawangan dll). Saya akan ekstrak maklumat dan sediakan kemaskini untuk masterlist.'
      }
    ]);
  };

  const removeDraft = (index: number) => {
    setDrafts(drafts.filter((_, i) => i !== index));
  };

  const resetForNextUser = () => {
    setPrompt('');
    setFiles([]);
    setDrafts([]);
    setWarnings([]);
    setIsComplete(false);
    setHasSentFiles(false);
    setError(null);
    setApplyResults(null);
    setPendingConfirmations([]);
    setResolutions({});
    setEditingDraftIndex(null);
    setEditingDraft({});
    setDraftSavedMessage(false);
    setMessages([
      {
        id: makeId(),
        role: 'assistant',
        content: 'Data user sebelum ini selesai. Teruskan upload/chat untuk user seterusnya pada masterlist yang sama.'
      }
    ]);
  };

  const appendFiles = (incoming: File[]) => {
    if (!incoming.length) return;
    setFiles(prev => [...prev, ...incoming].slice(0, 10));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedProjectId || !selectedMasterlistId) {
      setError('Sila pilih Projek dan Masterlist dahulu sebelum lampir fail.');
      e.target.value = '';
      return;
    }
    const selected = Array.from(e.target.files || []);
    appendFiles(selected);
    e.target.value = '';
  };

  const handleCameraChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedProjectId || !selectedMasterlistId) {
      setError('Sila pilih Projek dan Masterlist dahulu sebelum ambil gambar.');
      e.target.value = '';
      return;
    }
    const selected = Array.from(e.target.files || []);
    appendFiles(selected);
    e.target.value = '';
  };

  const removeFile = (name: string) => {
    setFiles(prev => prev.filter(f => f.name !== name));
  };

  const handleSend = async () => {
    if (!selectedProjectId || !selectedMasterlistId) {
      setError('Sila pilih Projek dan Masterlist dahulu sebelum chat atau upload.');
      return;
    }
    const userPrompt = prompt.trim();
    if (sourceMode === 'chat_only' && !userPrompt) {
      setError('Masukkan mesej chat dahulu untuk mod Chat Sahaja.');
      return;
    }
    if (sourceMode === 'files_only' && files.length === 0) {
      setError('Lampirkan fail/gambar dahulu untuk mod Fail/Gambar Sahaja.');
      return;
    }
    if (!userPrompt && files.length === 0 && drafts.length === 0) return;

    const userMsg = sourceMode === 'files_only'
      ? `Proses fail/gambar sahaja (${files.length} fail).`
      : (userPrompt || `Rujuk fail dilampirkan (${files.length} fail).`);
    const nextMessages = [...messages, { id: makeId(), role: 'user' as const, content: userMsg }];
    setMessages(nextMessages);
    setPrompt('');
    setError(null);
    setApplyResults(null);
    setPendingConfirmations([]);
    setResolutions({});
    setLoading(true);

    try {
      const messageAsksFileRecheck = /fail|file|gambar|image|snap|upload|lampir|baca semula/i.test(userMsg);
      const shouldSendFiles = sourceMode !== 'chat_only' && files.length > 0
        && (sourceMode !== 'combined' ? true : (!hasSentFiles || messageAsksFileRecheck));
      const outboundMessage = sourceMode === 'files_only' ? '' : userPrompt;

      const formData = new FormData();
      formData.append('message', outboundMessage);
      formData.append('source_mode', sourceMode);
      formData.append('drafts', JSON.stringify(drafts));
      formData.append('project_id', selectedProjectId);
      formData.append('masterlist_id', selectedMasterlistId);
      formData.append('history', JSON.stringify(nextMessages.map(({ role, content }) => ({ role, content }))));
      if (shouldSendFiles) {
        files.forEach(f => formData.append('files', f));
      }

      const response = await aiMasterlistAssistantApi.chat(formData);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'AI assistant gagal menjawab.');
      }

      const payload: any = response.data;
      setDrafts(Array.isArray(payload.drafts) ? payload.drafts.map((d: AssetUpdateDraft) => normalizeDraft(d)) : []);
      setWarnings(Array.isArray(payload.warnings) ? payload.warnings : []);
      setIsComplete(Boolean(payload.isComplete));
      if (shouldSendFiles) setHasSentFiles(true);
      setMessages(prev => [...prev, { id: makeId(), role: 'assistant', content: payload.reply || 'Saya dah proses maklumat.' }]);
    } catch (err: any) {
      setError(err.message || 'Ralat semasa hubungi AI assistant.');
    } finally {
      setLoading(false);
    }
  };

  const handleProcessPdf = () => {
    if (!selectedProjectId || !selectedMasterlistId) {
      setError('Sila pilih Projek dan Masterlist dahulu.');
      return;
    }
    const pdfFile = pdfInputRef.current?.files?.[0];
    if (!pdfFile) {
      setError('Sila pilih fail PDF dahulu.');
      return;
    }

    setPdfProcessing(true);
    setPdfProgress({ current: 0, total: 0 });
    setPdfStatusMsg('Memulakan OCR...');
    setError(null);
    setDrafts([]);
    setWarnings([]);
    setApplyResults(null);
    setMessages(prev => [...prev, { id: makeId(), role: 'user', content: `📄 Proses PDF: ${pdfFile.name}` }]);

    const formData = new FormData();
    formData.append('pdf', pdfFile);
    formData.append('drafts', JSON.stringify(drafts));
    formData.append('project_id', selectedProjectId);
    formData.append('masterlist_id', selectedMasterlistId);

    pdfAbortRef.current = aiMasterlistAssistantApi.processPdf(formData, {
      onStatus: (data) => {
        setPdfStatusMsg(data.message || 'Memproses...');
      },
      onPageOcr: (data) => {
        setPdfProgress({ current: data.page || 0, total: data.totalPages || 0 });
        setPdfStatusMsg(`Halaman ${data.page}/${data.totalPages}: OCR ${data.source === 'text' ? '(text)' : '(imej)'} selesai`);
      },
      onPageProgress: (data) => {
        setPdfProgress({ current: data.page || 0, total: data.totalPages || 0 });
        setPdfStatusMsg(`AI proses halaman ${data.page}/${data.totalPages}...`);
        // Accumulate drafts
        if (data.drafts && data.drafts.length > 0) {
          setDrafts(prev => {
            const existing = [...prev];
            for (const draft of data.drafts) {
              const normalized = normalizeDraft(draft);
              if (normalized.serial_number) {
                const dup = existing.some(d => d.serial_number === normalized.serial_number);
                if (!dup) existing.push(normalized);
              } else {
                existing.push(normalized);
              }
            }
            return existing;
          });
        }
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant' && last.content.startsWith('📄 Halaman')) {
            return [...prev.slice(0, -1), { id: makeId(), role: 'assistant', content: `📄 Halaman ${data.page}/${data.totalPages}: ${data.reply || 'Diproses'}` }];
          }
          return [...prev, { id: makeId(), role: 'assistant', content: `📄 Halaman ${data.page}/${data.totalPages}: ${data.reply || 'Diproses'}` }];
        });
      },
      onPageSkip: (data) => {
        setPdfStatusMsg(`Halaman ${data.page}: ${data.message || 'Tiada teks'}`);
      },
      onPageError: (data) => {
        setPdfStatusMsg(`Halaman ${data.page}: Ralat AI - ${data.message}`);
      },
      onComplete: (data) => {
        setPdfProcessing(false);
        setPdfStatusMsg('');
        setIsComplete(true);
        setMessages(prev => [...prev, { id: makeId(), role: 'assistant', content: `✅ PDF selesai diproses. Dijumpai ${data.totalDrafts || 0} aset dari ${data.processedPages || 0} halaman.` }]);
        pdfInputRef.current && (pdfInputRef.current.value = '');
      },
      onError: (data) => {
        setPdfProcessing(false);
        setPdfStatusMsg('');
        setError(data.message || 'Gagal proses PDF.');
        setMessages(prev => [...prev, { id: makeId(), role: 'assistant', content: `❌ Ralat: ${data.message || 'Gagal proses PDF'}` }]);
        pdfInputRef.current && (pdfInputRef.current.value = '');
      }
    });
  };

  const cancelPdfProcessing = () => {
    if (pdfAbortRef.current) {
      pdfAbortRef.current.abort();
      pdfAbortRef.current = null;
    }
    setPdfProcessing(false);
    setPdfStatusMsg('Dibatalkan');
    setMessages(prev => [...prev, { id: makeId(), role: 'assistant', content: '⏹️ Pemprosesan PDF dibatalkan.' }]);
    if (pdfInputRef.current) pdfInputRef.current.value = '';
  };

  const handleApply = async () => {
    if (!drafts.length) return;
    setApplying(true);
    setError(null);

    try {
      const response = await aiMasterlistAssistantApi.apply(
        drafts,
        Number(selectedProjectId),
        Number(selectedMasterlistId),
        resolutions,
        files
      );
      if (!response.success && !response.data) {
        throw new Error(response.error || 'Gagal apply kemaskini.');
      }
      const data: any = response.data;
      const pending = Array.isArray(data?.pendingConfirmations) ? data.pendingConfirmations : [];
      setPendingConfirmations(pending);

      if (pending.length > 0) {
        setApplyResults(null);
        setMessages(prev => [
          ...prev,
          {
            id: makeId(),
            role: 'assistant',
            content: response.message || `Perlu pengesahan untuk ${pending.length} item sebelum update diteruskan.`
          }
        ]);
        return;
      }

      setApplyResults(Array.isArray(data?.results) ? data.results : []);
      setPendingConfirmations([]);
      setMessages(prev => [
        ...prev,
        {
          id: makeId(),
          role: 'assistant',
          content: response.message || `${data?.updatedCount || 0} rekod dikemaskini.`
        }
      ]);
    } catch (err: any) {
      setError(err.message || 'Gagal apply kemaskini.');
    } finally {
      setApplying(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const filledDrafts = drafts.filter(d => d.serial_number || d.asset_tag);
  const selectionReady = Boolean(selectedProjectId && selectedMasterlistId);

  const setResolution = (index: number, choice: ResolutionChoice) => {
    setResolutions((prev) => ({ ...prev, [String(index)]: choice }));
  };

  const allPendingResolved = pendingConfirmations.length > 0
    && pendingConfirmations.every((item) => Boolean(resolutions[String(item.index)]));

  const handleStartEditDraft = (index: number) => {
    setEditingDraftIndex(index);
    setEditingDraft({ ...drafts[index] });
    setDraftSavedMessage(false);
  };

  const handleEditDraftFieldChange = (key: keyof AssetUpdateDraft, value: string) => {
    setEditingDraft((prev) => ({ ...prev, [key]: value }));
  };

  const handleEditAccessoryChange = (index: number, field: string, value: string) => {
    setEditingDraft((prev) => {
      const accs = [...(prev.accessories || [])];
      if (!accs[index]) return prev;
      accs[index] = { ...accs[index], [field]: value };
      return { ...prev, accessories: accs };
    });
  };

  const handleAddAccessory = () => {
    setEditingDraft((prev) => ({
      ...prev,
      accessories: [...(prev.accessories || []), { type: 'other' as const, serial_number: '', name: '', brand: '', model: '' }]
    }));
  };

  const handleRemoveAccessory = (index: number) => {
    setEditingDraft((prev) => {
      const accs = [...(prev.accessories || [])];
      accs.splice(index, 1);
      return { ...prev, accessories: accs };
    });
  };

  const handleSaveEditedDraft = () => {
    if (editingDraftIndex === null) return;
    setDrafts((prev) => prev.map((d, i) => (i === editingDraftIndex ? normalizeDraft(editingDraft) : d)));
    setEditingDraftIndex(null);
    setEditingDraft({});
    setDraftSavedMessage(true);
    setTimeout(() => setDraftSavedMessage(false), 3000);
  };

  const handleCancelEditDraft = () => {
    setEditingDraftIndex(null);
    setEditingDraft({});
  };

  return (
    <div className="flex min-h-[70vh] w-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_90px_rgba(15,23,42,0.15)]">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 bg-[linear-gradient(135deg,#4f1aba,#7c3aed)] px-4 py-3 text-white">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold">
            <ClipboardList className="h-4 w-4" /> AI Masterlist Assistant
          </p>
          <p className="text-xs text-purple-200">Snap label peralatan & borang pengguna → AI kemaskini masterlist</p>
        </div>
        <button
          type="button"
          onClick={resetAssistant}
          title="Mula semula"
          className="self-end rounded-full p-1 text-purple-200 hover:bg-white/10 sm:self-auto"
        >
          <RefreshCw className="h-5 w-5" />
        </button>
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto bg-slate-50 px-3 py-3">
        <div className="space-y-3">
          <div className="rounded-2xl border border-violet-200 bg-violet-50 p-3">
            <p className="mb-2 text-xs font-semibold text-violet-900">Pilih skop kemaskini dahulu</p>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <select
                value={selectedProjectId}
                onChange={(e) => {
                  setSelectedProjectId(e.target.value);
                  setError(null);
                }}
                className="rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-violet-400 focus:outline-none"
                disabled={loadingOptions}
              >
                <option value="">Pilih Projek</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>{project.code} - {project.name}</option>
                ))}
              </select>

              <select
                value={selectedMasterlistId}
                onChange={(e) => {
                  setSelectedMasterlistId(e.target.value);
                  setError(null);
                }}
                className="rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-violet-400 focus:outline-none"
                disabled={!selectedProjectId || loadingOptions}
              >
                <option value="">Pilih Masterlist</option>
                {masterlists.map((masterlist) => (
                  <option key={masterlist.id} value={masterlist.id}>{masterlist.code} - {masterlist.name}</option>
                ))}
              </select>
            </div>
            {selectedProjectId && !loadingOptions && masterlists.length === 0 && (
              <p className="mt-2 text-[11px] text-amber-700">Tiada masterlist ditemui untuk projek ini.</p>
            )}
            {!selectionReady && (
              <p className="mt-2 text-[11px] text-violet-700">Upload dan chat akan aktif selepas Projek & Masterlist dipilih.</p>
            )}

            <div className="mt-2">
              <p className="mb-1 text-[11px] font-medium text-violet-900">Sumber data AI</p>
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() => setSourceMode('combined')}
                  className={`rounded-full px-2 py-1 text-[11px] ${sourceMode === 'combined' ? 'bg-violet-600 text-white' : 'bg-white text-violet-700 border border-violet-200'}`}
                >
                  Gabung Chat + Fail/Gambar
                </button>
                <button
                  type="button"
                  onClick={() => setSourceMode('files_only')}
                  className={`rounded-full px-2 py-1 text-[11px] ${sourceMode === 'files_only' ? 'bg-violet-600 text-white' : 'bg-white text-violet-700 border border-violet-200'}`}
                >
                  Fail/Gambar Sahaja
                </button>
                <button
                  type="button"
                  onClick={() => setSourceMode('chat_only')}
                  className={`rounded-full px-2 py-1 text-[11px] ${sourceMode === 'chat_only' ? 'bg-violet-600 text-white' : 'bg-white text-violet-700 border border-violet-200'}`}
                >
                  Chat Sahaja
                </button>
              </div>
            </div>
          </div>

          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.role === 'assistant' ? 'justify-start' : 'justify-end'}`}>
              <div className={`max-w-[85%] rounded-2xl border px-3 py-2 text-sm leading-relaxed ${
                msg.role === 'assistant'
                  ? 'border-purple-200 bg-purple-50 text-purple-950 shadow-sm'
                  : 'border-violet-600 bg-violet-600 text-white'
              }`}>
                {msg.content}
              </div>
            </div>
          ))}

          {/* Draft cards */}
          {filledDrafts.length > 0 && !applyResults && (
            <div className="rounded-2xl border border-purple-100 bg-purple-50 p-3">
              <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-purple-900">
                <CheckCircle2 className="h-4 w-4" />
                {filledDrafts.length} aset dikenal pasti
              </p>
              {draftSavedMessage && (
                <div className="mb-2 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-[11px] font-medium text-emerald-700">Draf disimpan sementara. Teruskan edit atau klik "Kemaskini" bila sedia.</div>
              )}
              <div className="space-y-2">
                {filledDrafts.map((d, i) => {
                  const isEditingThis = editingDraftIndex === i;
                  return (
                  <div key={i} className={`rounded-xl border px-3 py-2 text-xs ${isEditingThis ? 'border-blue-300 bg-blue-50' : 'border-purple-200 bg-white text-slate-700'}`}>
                    {!isEditingThis ? (
                      <>
                        <div className="mb-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <p className="font-semibold text-purple-800">
                            Aset {i + 1}: {d.serial_number ? `SN ${d.serial_number}` : ''}{d.asset_tag ? ` TAG ${d.asset_tag}` : ''}
                          </p>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleStartEditDraft(i)}
                              title="Edit draf aset ini"
                              className="shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 transition border border-blue-200"
                            >
                              <Pencil className="h-3 w-3" /> Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => removeDraft(i)}
                              title="Padam aset ini"
                              className="shrink-0 rounded-full p-1 text-slate-400 hover:bg-red-100 hover:text-red-600 transition"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 gap-x-4 gap-y-0.5 sm:grid-cols-2">
                          {(Object.keys(DRAFT_LABELS) as Array<keyof AssetUpdateDraft>).map(key => {
                            const val = d[key];
                            if (!val || key === 'serial_number' || key === 'asset_tag') return null;
                            
                            if (key === 'accessories' && Array.isArray(val) && val.length > 0) {
                              return (
                                <span key={key} className="col-span-1 sm:col-span-2 mt-1 block">
                                  <span className="font-medium text-slate-500">{DRAFT_LABELS[key]}:</span>{' '}
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {val.map((acc, idx) => (
                                      <span key={idx} className="inline-flex items-center rounded-md bg-purple-50 px-2 py-1 text-[10px] font-medium text-purple-700 ring-1 ring-inset ring-purple-600/20 capitalize">
                                        {acc.type} {acc.serial_number ? `(${acc.serial_number})` : ''}
                                      </span>
                                    ))}
                                  </div>
                                </span>
                              );
                            }
                            
                            if (key === 'accessories') return null;

                            return (
                              <span key={key} className="truncate">
                                <span className="font-medium text-slate-500">{DRAFT_LABELS[key]}:</span>{' '}
                                {String(val)}
                              </span>
                            );
                          })}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <p className="font-semibold text-blue-900 flex items-center gap-2"><Pencil className="h-3.5 w-3.5" /> Edit Aset {i + 1}</p>
                          <div className="flex gap-2">
                            <button type="button" onClick={handleSaveEditedDraft} className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-[11px] font-semibold text-white bg-blue-600 hover:bg-blue-700"><Save className="h-3 w-3" /> Simpan Draf</button>
                            <button type="button" onClick={handleCancelEditDraft} className="rounded-md px-3 py-1.5 text-[11px] font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50">Batal</button>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <label className="flex flex-col gap-1">
                            <span className="font-medium text-slate-700">Serial Number</span>
                            <input value={String(editingDraft.serial_number || '')} onChange={(e) => handleEditDraftFieldChange('serial_number', e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:border-blue-400 focus:outline-none" />
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="font-medium text-slate-700">Asset Tag</span>
                            <input value={String(editingDraft.asset_tag || '')} onChange={(e) => handleEditDraftFieldChange('asset_tag', e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:border-blue-400 focus:outline-none" />
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="font-medium text-slate-700">Nama Aset</span>
                            <input value={String(editingDraft.asset_name || '')} onChange={(e) => handleEditDraftFieldChange('asset_name', e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:border-blue-400 focus:outline-none" />
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="font-medium text-slate-700">Jenama</span>
                            <input value={String(editingDraft.brand || '')} onChange={(e) => handleEditDraftFieldChange('brand', e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:border-blue-400 focus:outline-none" />
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="font-medium text-slate-700">Model</span>
                            <input value={String(editingDraft.model || '')} onChange={(e) => handleEditDraftFieldChange('model', e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:border-blue-400 focus:outline-none" />
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="font-medium text-slate-700">Nama Pengguna</span>
                            <input value={String(editingDraft.user_name || '')} onChange={(e) => handleEditDraftFieldChange('user_name', e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:border-blue-400 focus:outline-none" />
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="font-medium text-slate-700">Jawatan</span>
                            <input value={String(editingDraft.position || '')} onChange={(e) => handleEditDraftFieldChange('position', e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:border-blue-400 focus:outline-none" />
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="font-medium text-slate-700">Bahagian/Jabatan</span>
                            <input value={String(editingDraft.department || '')} onChange={(e) => handleEditDraftFieldChange('department', e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:border-blue-400 focus:outline-none" />
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="font-medium text-slate-700">Tingkat</span>
                            <input value={String(editingDraft.floor || '')} onChange={(e) => handleEditDraftFieldChange('floor', e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:border-blue-400 focus:outline-none" />
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="font-medium text-slate-700">Bangunan</span>
                            <input value={String(editingDraft.building || '')} onChange={(e) => handleEditDraftFieldChange('building', e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:border-blue-400 focus:outline-none" />
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="font-medium text-slate-700">Lokasi/Bilik</span>
                            <input value={String(editingDraft.location || '')} onChange={(e) => handleEditDraftFieldChange('location', e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:border-blue-400 focus:outline-none" />
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="font-medium text-slate-700">Cawangan</span>
                            <input value={String(editingDraft.branch || '')} onChange={(e) => handleEditDraftFieldChange('branch', e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:border-blue-400 focus:outline-none" />
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="font-medium text-slate-700">Negeri</span>
                            <input value={String(editingDraft.state || '')} onChange={(e) => handleEditDraftFieldChange('state', e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:border-blue-400 focus:outline-none" />
                          </label>
                          <label className="flex flex-col gap-1 sm:col-span-2">
                            <span className="font-medium text-slate-700">Catatan / Remark</span>
                            <textarea value={String(editingDraft.notes || '')} onChange={(e) => handleEditDraftFieldChange('notes', e.target.value)} rows={2} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:border-blue-400 focus:outline-none resize-none" placeholder="Contoh: Monitor ada dead pixel, Keyboard rosak, dll." />
                          </label>
                          {/* Aksesori Tambahan */}
                          <div className="sm:col-span-2">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium text-slate-700">Aksesori Tambahan</span>
                              <button
                                type="button"
                                onClick={handleAddAccessory}
                                className="inline-flex items-center gap-1 rounded-md bg-purple-100 px-2 py-1 text-[10px] font-medium text-purple-700 hover:bg-purple-200"
                              >
                                + Tambah Aksesori
                              </button>
                            </div>
                            {(editingDraft.accessories || []).length === 0 ? (
                              <p className="text-[11px] text-slate-400 italic">Tiada aksesori</p>
                            ) : (
                              <div className="space-y-2">
                                {(editingDraft.accessories || []).map((acc, idx) => (
                                  <div key={idx} className="relative rounded-lg border border-purple-100 bg-purple-50/50 p-2">
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveAccessory(idx)}
                                      className="absolute right-1 top-1 rounded-full p-0.5 text-purple-300 hover:bg-red-100 hover:text-red-500"
                                      title="Padam aksesori"
                                    >
                                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 pr-5">
                                      <select
                                        value={acc.type || 'other'}
                                        onChange={(e) => handleEditAccessoryChange(idx, 'type', e.target.value)}
                                        className="rounded border border-purple-200 px-2 py-1 text-[11px] bg-white"
                                      >
                                        <option value="monitor">Monitor</option>
                                        <option value="keyboard">Keyboard</option>
                                        <option value="mouse">Mouse</option>
                                        <option value="other">Lain-lain</option>
                                      </select>
                                      <input value={acc.serial_number || ''} onChange={(e) => handleEditAccessoryChange(idx, 'serial_number', e.target.value)} placeholder="Serial No." className="rounded border border-purple-200 px-2 py-1 text-[11px]" />
                                      <input value={acc.name || ''} onChange={(e) => handleEditAccessoryChange(idx, 'name', e.target.value)} placeholder="Nama" className="rounded border border-purple-200 px-2 py-1 text-[11px]" />
                                      <input value={acc.brand || ''} onChange={(e) => handleEditAccessoryChange(idx, 'brand', e.target.value)} placeholder="Jenama" className="rounded border border-purple-200 px-2 py-1 text-[11px]" />
                                      <input value={acc.model || ''} onChange={(e) => handleEditAccessoryChange(idx, 'model', e.target.value)} placeholder="Model" className="rounded border border-purple-200 px-2 py-1 text-[11px]" />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )})}
              </div>
            </div>
          )}

          {/* Warnings */}
          {warnings.length > 0 && (
            <div className="rounded-2xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <p className="mb-1 flex items-center gap-1 font-semibold"><AlertTriangle className="h-3 w-3" /> Amaran</p>
              <ul className="space-y-0.5">
                {warnings.map((w, i) => <li key={i}>• {w}</li>)}
              </ul>
            </div>
          )}

          {/* Apply results */}
          {applyResults && (
            <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-xs">
              <p className="mb-2 font-semibold text-slate-800">Keputusan Kemaskini:</p>
              <div className="space-y-1">
                {applyResults.map((r, i) => (
                  <div key={i} className={`flex items-center gap-2 rounded-lg px-2 py-1 ${
                    r.status === 'updated' ? 'bg-emerald-50 text-emerald-800' :
                    r.status === 'not_found' ? 'bg-amber-50 text-amber-800' :
                    'bg-red-50 text-red-800'
                  }`}>
                    <span>{r.status === 'updated' ? '✓' : r.status === 'not_found' ? '?' : '✗'}</span>
                    <span className="font-medium">{r.serial_number || r.asset_tag || `Aset ${i + 1}`}</span>
                    <span className="ml-auto">
                      {r.status === 'updated' ? 'Dikemaskini' :
                       r.status === 'not_found' ? 'Tidak dijumpai' :
                       r.message || 'Ralat'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pending confirmations */}
          {pendingConfirmations.length > 0 && (
            <div className="rounded-2xl border border-orange-200 bg-orange-50 px-3 py-3 text-xs">
              <p className="mb-2 font-semibold text-orange-900">Pengesahan Diperlukan</p>
              <div className="space-y-2">
                {pendingConfirmations.map((item) => {
                  const selected = resolutions[String(item.index)];
                  return (
                    <div key={`${item.type}-${item.index}`} className="rounded-lg border border-orange-200 bg-white p-2">
                      <p className="font-medium text-slate-800">SN: {item.serial_number}</p>
                      <p className="mt-0.5 text-slate-600">{item.message}</p>

                      {item.type === 'nearest_candidate' && (
                        <p className="mt-1 text-slate-600">
                          Cadangan: {item.candidate_serial_number} ({item.candidate_asset_name || 'Aset'})
                          {typeof item.similarity === 'number' ? `, similarity ${item.similarity}` : ''}
                        </p>
                      )}

                      {item.type === 'cross_masterlist' && (
                        <p className="mt-1 text-slate-600">
                          Rekod asal: {item.existing_masterlist_name || '-'}
                          {item.existing_project_name ? ` / ${item.existing_project_name}` : ''}
                        </p>
                      )}

                      <div className="mt-2 flex flex-wrap gap-2">
                        {item.type === 'nearest_candidate' && (
                          <>
                            <button
                              type="button"
                              onClick={() => setResolution(item.index, { action: 'use_candidate', asset_id: item.candidate_asset_id })}
                              className={`rounded-md px-2 py-1 ${selected?.action === 'use_candidate' ? 'bg-emerald-600 text-white' : 'bg-emerald-100 text-emerald-800'}`}
                            >
                              Guna Rekod Dicadangkan
                            </button>
                            <button
                              type="button"
                              onClick={() => setResolution(item.index, { action: 'create_new' })}
                              className={`rounded-md px-2 py-1 ${selected?.action === 'create_new' ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-700'}`}
                            >
                              Tambah Rekod Baru
                            </button>
                          </>
                        )}

                        {item.type === 'cross_masterlist' && (
                          <button
                            type="button"
                            onClick={() => setResolution(item.index, { action: 'force_cross_masterlist' })}
                            className={`rounded-md px-2 py-1 ${selected?.action === 'force_cross_masterlist' ? 'bg-amber-700 text-white' : 'bg-amber-100 text-amber-800'}`}
                          >
                            Teruskan & Tambah Rekod Baru
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {error && (
            <p className="rounded-2xl bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
          )}

          {/* PDF Processing Progress */}
          {pdfProcessing && (
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-3">
              <div className="mb-2 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                <span className="text-xs font-semibold text-blue-900">{pdfStatusMsg}</span>
              </div>
              {pdfProgress.total > 0 && (
                <div className="mb-2">
                  <div className="flex items-center justify-between text-[10px] text-blue-700">
                    <span>Halaman {pdfProgress.current} / {pdfProgress.total}</span>
                    <span>{Math.round((pdfProgress.current / pdfProgress.total) * 100)}%</span>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-blue-100">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-all duration-500"
                      style={{ width: `${(pdfProgress.current / pdfProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}
              <button
                type="button"
                onClick={cancelPdfProcessing}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-red-700 bg-red-50 border border-red-200 hover:bg-red-100"
              >
                <Ban className="h-3 w-3" /> Batal
              </button>
            </div>
          )}

          <div ref={messageEndRef} />
        </div>
      </div>

      {/* File attachments strip */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t border-slate-100 bg-white px-3 py-2">
          {files.map(f => (
            <span key={f.name} className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700">
              <FileText className="h-3 w-3 text-violet-500" />
              <span className="max-w-[120px] truncate">{f.name}</span>
              <button type="button" onClick={() => removeFile(f.name)} className="text-slate-400 hover:text-red-500">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-slate-200 bg-white p-3">
        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.tsv,.json,.xml,.md,.html,.rtf,.yaml,.yml,.log,.ini"
            className="hidden"
            onChange={handleFileChange}
          />

          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleCameraChange}
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Lampirkan fail/gambar"
            disabled={!selectionReady}
            className="shrink-0 rounded-full p-2 text-slate-500 hover:bg-purple-50 hover:text-purple-600 disabled:opacity-40"
          >
            <Paperclip className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            title="Snap gambar"
            disabled={!selectionReady}
            className="shrink-0 rounded-full p-2 text-slate-500 hover:bg-purple-50 hover:text-purple-600 disabled:opacity-40"
          >
            <Camera className="h-5 w-5" />
          </button>

          {/* Hidden PDF input */}
          <input
            ref={pdfInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                setPdfFileName(file.name);
                // Auto-start processing
                handleProcessPdf();
              }
            }}
          />

          <button
            type="button"
            onClick={() => pdfInputRef.current?.click()}
            title="Upload PDF untuk OCR berjadual"
            disabled={!selectionReady || pdfProcessing}
            className="shrink-0 rounded-full p-2 text-slate-500 hover:bg-amber-50 hover:text-amber-600 disabled:opacity-40"
          >
            <FileJson className="h-5 w-5" />
          </button>

          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Hantar arahan atau lampirkan gambar label/borang..."
            rows={1}
            disabled={!selectionReady}
            className="flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-100 disabled:opacity-60"
            style={{ maxHeight: '120px', overflowY: 'auto' }}
          />

          <button
            type="button"
            onClick={handleSend}
            disabled={!selectionReady || loading || (!prompt.trim() && files.length === 0)}
            className="shrink-0 rounded-full bg-violet-600 p-2 text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-40"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </button>
        </div>

        {/* Apply button */}
        {isComplete && filledDrafts.length > 0 && !applyResults && (
          <div className="mt-2 flex justify-end">
            <Button
              onClick={handleApply}
              disabled={applying || (pendingConfirmations.length > 0 && !allPendingResolved)}
              className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
            >
              {applying ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin inline" />Mengaplikasi...</>
              ) : pendingConfirmations.length > 0 ? (
                'Sahkan Pilihan & Teruskan Update'
              ) : (
                `Kemaskini ${filledDrafts.length} Aset`
              )}
            </Button>
          </div>
        )}

        {applyResults && (
          <div className="mt-2 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={resetForNextUser}
              className="rounded-xl border border-purple-200 bg-purple-50 px-4 py-2 text-sm font-medium text-purple-700 hover:bg-purple-100"
            >
              Tambah User Lain
            </button>
            <button
              type="button"
              onClick={resetAssistant}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Update Masterlist/Projek Lain
            </button>
          </div>
        )}
      </div>
    </div>
  );
};


