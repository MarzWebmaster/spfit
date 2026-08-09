import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCirclePlus, Sparkles, Send, X, Paperclip, Loader2, FileText, CheckCircle2, Pencil, Save } from 'lucide-react';
import { Button } from './ui/Button';
import { aiTaskAssistantApi, mainConsApi, projectsApi, taskSettingsApi, tasksApi } from '../services/api';

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
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface SupportTypeOption {
  id: number;
  value: string;
}

interface ProjectOption {
  id: number;
  code: string;
  name: string;
  clientName: string;
  mainConId?: number | null;
}

interface MainConOption {
  id: number;
  name: string;
}

interface NewProjectFormState {
  code: string;
  name: string;
  client_name: string;
  main_con_id: number | '';
}

const FIELD_LABELS: Record<string, string> = {
  supportType: 'Jenis sokongan',
  clientLocation: 'Lokasi klien',
  districtAddress: 'Bandar / Daerah',
  state: 'Negeri',
  deadline: 'Tarikh keperluan',
  offerPrice: 'Harga tawaran',
  mainConName: 'Main con',
  picName: 'Nama PIC',
  picPhone: 'Telefon PIC',
  clientName: 'Nama klien',
  assetTagId: 'Asset tag',
  assetBrand: 'Jenama aset',
  assetModel: 'Model aset',
  assetSerialNumber: 'Serial number aset',
  branchName: 'Cawangan',
  projectName: 'Projek'
};

const DEFAULT_SUPPORT_TYPE_OPTIONS: SupportTypeOption[] = [
  { id: 1, value: 'Corrective Maintenance' },
  { id: 2, value: 'Preventive Maintenance (PM)' },
  { id: 3, value: 'Deployment' },
  { id: 4, value: 'Add-Hoc Services' }
];

const INITIAL_PROJECT_FORM: NewProjectFormState = {
  code: '',
  name: '',
  client_name: '',
  main_con_id: ''
};

const makeId = () => Math.random().toString(36).slice(2, 10);

function buildTaskFormData(draft: AssistantDraft, files: File[]): FormData {
  const formData = new FormData();
  formData.append('title', String(draft.title || '').trim());
  formData.append('description', String(draft.description || '').trim());
  formData.append('support_type', String(draft.supportType || '').trim());
  formData.append('client_location', String(draft.clientLocation || '').trim());
  if (draft.districtAddress) formData.append('bandar_daerah', draft.districtAddress.trim());
  formData.append('state', String(draft.state || '').trim());
  formData.append('deadline', String(draft.deadline || '').trim());
  formData.append('offer_price', String(draft.offerPrice || '').trim());

  if (draft.remarks) formData.append('remarks', draft.remarks.trim());
  if (draft.mainConId) formData.append('main_con_id', String(draft.mainConId));
  if (draft.picName) formData.append('pic_name', draft.picName.trim());
  if (draft.picPhone) formData.append('pic_phone', draft.picPhone.trim());
  if (draft.clientName) formData.append('client_name', draft.clientName.trim());
  if (draft.assetTagId) formData.append('asset_tag_id', draft.assetTagId.trim());
  if (draft.assetBrand) formData.append('asset_brand', draft.assetBrand.trim());
  if (draft.assetModel) formData.append('asset_model', draft.assetModel.trim());
  if (draft.assetSerialNumber) formData.append('asset_serial_number', draft.assetSerialNumber.trim());
  if (draft.branchName) formData.append('branch_name', draft.branchName.trim());
  if (draft.projectId) formData.append('project_id', String(draft.projectId));
  if (draft.equipmentTypes && draft.equipmentTypes.length > 0) {
    formData.append('equipment_types_id', JSON.stringify(draft.equipmentTypes));
  }
  if (draft.links && draft.links.length > 0) {
    formData.append('links', JSON.stringify(draft.links.map((url) => ({ url }))));
  }

  files.forEach((file) => formData.append('attachments', file));
  return formData;
}

function isProjectBasedSupportType(value?: string): boolean {
  const normalized = String(value || '').toLowerCase();
  return normalized.includes('deployment') || normalized.includes('preventive') || normalized.includes('preventif');
}

function isAssetRequiredSupportType(value?: string): boolean {
  const normalized = String(value || '').toLowerCase();
  return normalized.includes('corrective') || normalized.includes('adhoc') || normalized.includes('ad-hoc') || (normalized.includes('add') && normalized.includes('hoc'));
}

interface FloatingTaskAssistantProps {
  embedded?: boolean;
}

export const FloatingTaskAssistant: React.FC<FloatingTaskAssistantProps> = ({ embedded = false }) => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageEndRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(embedded);
  const [prompt, setPrompt] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [availableProjects, setAvailableProjects] = useState<ProjectOption[]>([]);
  const [supportTypeOptions, setSupportTypeOptions] = useState<SupportTypeOption[]>(DEFAULT_SUPPORT_TYPE_OPTIONS);
  const [mainConOptions, setMainConOptions] = useState<MainConOption[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: makeId(),
      role: 'assistant',
      content: 'Hantar arahan dan fail. Saya akan fahamkan kandungan, isi draf task, dan tanya balik jika maklumat belum cukup.'
    }
  ]);
  const [draft, setDraft] = useState<AssistantDraft>({});
  const [draftList, setDraftList] = useState<AssistantDraft[]>([]);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [hideDraftCard, setHideDraftCard] = useState(false);
  const [hideMissingCard, setHideMissingCard] = useState(false);
  const [hideWarningCard, setHideWarningCard] = useState(false);
  const [hasSentFilesToAi, setHasSentFilesToAi] = useState(false);
  const [showCreateProjectForm, setShowCreateProjectForm] = useState(false);
  const [creatingProjectInline, setCreatingProjectInline] = useState(false);
  const [newProjectForm, setNewProjectForm] = useState<NewProjectFormState>(INITIAL_PROJECT_FORM);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditingDraft, setIsEditingDraft] = useState(false);
  const [editedDraft, setEditedDraft] = useState<AssistantDraft>({});
  const [draftSavedMessage, setDraftSavedMessage] = useState(false);

  const getRequiredMissing = (item: AssistantDraft): string[] => {
    const required: Array<keyof AssistantDraft> = ['supportType', 'clientLocation', 'state'];
    const isPreventiveDeployment = isProjectBasedSupportType(item.supportType);
    if (isPreventiveDeployment) required.push('projectId');
    return required.filter((key) => {
      const value = item[key];
      if (typeof value === 'number') return !(value > 0);
      return !String(value || '').trim();
    });
  };

  const completedDraftCount = useMemo(() => {
    if (!draftList.length) return 0;
    return draftList.filter((item) => getRequiredMissing(item).length === 0).length;
  }, [draftList]);

  const isPreventiveDeploymentType = useMemo(() => isProjectBasedSupportType(draft.supportType), [draft.supportType]);

  const needsProjectPicker = (isPreventiveDeploymentType || Boolean(draft.projectName)) && !draft.projectId;

  const supportTypeRequired = !String(draft.supportType || '').trim();

  useEffect(() => {
    if (!isOpen) return;
    void Promise.all([
      projectsApi.getAll(1, 100, { status: 'Aktif' }),
      taskSettingsApi.getAll(),
      mainConsApi.getAll()
    ]).then(([projectsResponse, taskSettingsResponse, mainConsResponse]) => {
      if (projectsResponse.success && projectsResponse.data) {
        const data = projectsResponse.data as any;
        const list = Array.isArray(data.projects)
          ? data.projects
          : Array.isArray(data.data)
            ? data.data
            : Array.isArray(data)
              ? data
              : [];
        setAvailableProjects(list.map((p: any) => ({
          id: p.id,
          code: p.code || '',
          name: p.name || '',
          clientName: p.client_name || p.clientName || '',
          mainConId: p.main_con_id ?? p.mainCon?.id ?? null
        })));
      }

      if (taskSettingsResponse.success && taskSettingsResponse.data) {
        const data = taskSettingsResponse.data as any;
        const options = Array.isArray(data?.supportTypeOptions)
          ? data.supportTypeOptions.map((item: any) => ({ id: Number(item.id), value: String(item.value) }))
          : [];
        if (options.length > 0) {
          setSupportTypeOptions(options);
        }
      }

      if (mainConsResponse.success && mainConsResponse.data) {
        const list = Array.isArray(mainConsResponse.data) ? mainConsResponse.data : [];
        setMainConOptions(list.map((item: any) => ({ id: Number(item.id), name: String(item.name) })));
      }
    });
  }, [isOpen]);

  const filledSummary = useMemo(() => {
    return Object.entries(draft)
      .filter(([key, value]) => {
        if (!FIELD_LABELS[key]) return false;
        if (Array.isArray(value)) return value.length > 0;
        return String(value || '').trim().length > 0;
      })
      .slice(0, 8);
  }, [draft]);

  React.useEffect(() => {
    if (isOpen) {
      messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen, messages]);

  React.useEffect(() => {
    if (embedded) {
      setIsOpen(true);
    }
  }, [embedded]);

  React.useEffect(() => {
    if (filledSummary.length > 0) {
      setHideDraftCard(false);
    }
  }, [filledSummary]);

  React.useEffect(() => {
    if (missingFields.length > 0) {
      setHideMissingCard(false);
    }
  }, [missingFields]);

  React.useEffect(() => {
    if (warnings.length > 0) {
      setHideWarningCard(false);
    }
  }, [warnings]);

  const resetAssistant = () => {
    setPrompt('');
    setFiles([]);
    setDraft({});
    setDraftList([]);
    setMissingFields([]);
    setWarnings([]);
    setIsComplete(false);
    setHideDraftCard(false);
    setHideMissingCard(false);
    setHideWarningCard(false);
    setHasSentFilesToAi(false);
    setShowCreateProjectForm(false);
    setCreatingProjectInline(false);
    setNewProjectForm(INITIAL_PROJECT_FORM);
    setError(null);
    setIsEditingDraft(false);
    setEditedDraft({});
    setDraftSavedMessage(false);
    setMessages([
      {
        id: makeId(),
        role: 'assistant',
        content: 'Hantar arahan dan fail. Saya akan fahamkan kandungan, isi draf task, dan tanya balik jika maklumat belum cukup.'
      }
    ]);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files || []);
    if (!selected.length) return;
    setFiles((prev) => [...prev, ...selected].slice(0, 5));
    event.target.value = '';
  };

  const removeFile = (name: string) => {
    setFiles((prev) => prev.filter((file) => file.name !== name));
  };

  const appendAssistantMessage = (content: string) => {
    setMessages((prev) => [...prev, { id: makeId(), role: 'assistant', content }]);
  };

  const handleSupportTypeSelect = (value: string) => {
    setDraft((prev) => ({
      ...prev,
      supportType: value,
      projectId: isProjectBasedSupportType(value) ? prev.projectId : null,
      projectName: isProjectBasedSupportType(value) ? prev.projectName : ''
    }));
    setShowCreateProjectForm(false);

    if (isProjectBasedSupportType(value)) {
      appendAssistantMessage('Jenis sokongan dipilih. Sekarang pilih projek sedia ada atau tambah projek baru dulu. Lepas itu baru beri detail task sama ada single, multiple, list, chat, atau dokumen.');
      return;
    }

    if (isAssetRequiredSupportType(value)) {
      appendAssistantMessage('Jenis sokongan dipilih. Sekarang beri detail task. Anda boleh beri satu task atau banyak task dalam bentuk list, chat, atau dokumen. Untuk jenis ini, sekurang-kurangnya Tag ID atau Serial Number aset diperlukan.');
      return;
    }

    appendAssistantMessage('Jenis sokongan dipilih. Sekarang beri detail task. Anda boleh beri satu task atau banyak task dalam bentuk list, chat, atau dokumen.');
  };

  const handleProjectSelect = (project: ProjectOption) => {
    setDraft((prev) => ({
      ...prev,
      projectId: project.id,
      projectName: project.name,
      mainConId: project.mainConId ?? prev.mainConId ?? null
    }));
    setShowCreateProjectForm(false);
    appendAssistantMessage(`Projek dipilih: ${project.code} - ${project.name}. Sekarang beri detail task sama ada single, multiple, list, chat, atau dokumen.`);
  };

  const handleCreateProjectInline = async () => {
    const code = newProjectForm.code.trim();
    const name = newProjectForm.name.trim();
    if (!code || !name) {
      setError('Kod projek dan nama projek wajib diisi.');
      return;
    }

    setCreatingProjectInline(true);
    setError(null);

    try {
      const response = await projectsApi.create({
        code,
        name,
        client_name: newProjectForm.client_name.trim() || undefined,
        main_con_id: newProjectForm.main_con_id || undefined,
        status: 'Aktif'
      });

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Gagal cipta projek baru.');
      }

      const rawProject = (response.data as any).project || response.data;
      const createdProject: ProjectOption = {
        id: Number(rawProject.id),
        code: String(rawProject.code || code),
        name: String(rawProject.name || name),
        clientName: String(rawProject.client_name || newProjectForm.client_name || ''),
        mainConId: rawProject.main_con_id ?? newProjectForm.main_con_id ?? null
      };

      setAvailableProjects((prev) => [createdProject, ...prev.filter((item) => item.id !== createdProject.id)]);
      setNewProjectForm(INITIAL_PROJECT_FORM);
      handleProjectSelect(createdProject);
    } catch (err: any) {
      setError(err.message || 'Gagal cipta projek baru.');
    } finally {
      setCreatingProjectInline(false);
    }
  };

  const handleSend = async () => {
    if (!prompt.trim() && files.length === 0 && Object.keys(draft).length === 0) return;

    const userMessage = prompt.trim() || `Rujuk fail dilampirkan (${files.length} fail).`;
    const nextMessages = [...messages, { id: makeId(), role: 'user' as const, content: userMessage }];
    setMessages(nextMessages);
    setPrompt('');
    setError(null);
    setLoading(true);

    try {
      const messageAsksFileRecheck = /fail|file|pdf|lampir|lampiran|rujuk|extract|ekstrak|baca semula/i.test(userMessage);
      const shouldSendFiles = files.length > 0 && (!hasSentFilesToAi || messageAsksFileRecheck);
      const formData = new FormData();
      const compactHistory = nextMessages
        .slice(-5)
        .map(({ role, content }) => ({ role, content: String(content || '').trim().slice(0, 350) }));
      formData.append('message', userMessage);
      formData.append('draft', JSON.stringify(draft));
      formData.append('history', JSON.stringify(compactHistory));
      if (shouldSendFiles) {
        files.forEach((file) => formData.append('files', file));
      }

      const response = await aiTaskAssistantApi.chat(formData);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'AI assistant gagal menjawab.');
      }

      const payload: any = response.data;
      const incomingDrafts = Array.isArray(payload.drafts)
        ? payload.drafts
        : (payload?.draft ? [payload.draft] : []);
      setDraftList(incomingDrafts);
      setDraft(payload.draft || incomingDrafts[0] || {});
      setMissingFields(Array.isArray(payload.missingFields) ? payload.missingFields : []);
      setWarnings(Array.isArray(payload.warnings) ? payload.warnings : []);
      setIsComplete(Boolean(payload.isComplete));
      if (shouldSendFiles) {
        setHasSentFilesToAi(true);
      }
      setMessages((prev) => [...prev, { id: makeId(), role: 'assistant', content: payload.reply || 'Saya dah proses maklumat yang diberi.' }]);
    } catch (err: any) {
      setError(err.message || 'Ralat semasa hubungi AI assistant.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async () => {
    setCreating(true);
    setError(null);

    try {
      const response = await tasksApi.create(buildTaskFormData(draft, files));
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Gagal create task.');
      }

      const task: any = (response.data as any).task || response.data;
      resetAssistant();
      setIsOpen(false);
      navigate(`/tasks/${task.id}`);
    } catch (err: any) {
      setError(err.message || 'Gagal create task.');
    } finally {
      setCreating(false);
    }
  };

  const handleCreateAllTasks = async () => {
    const candidates = (draftList.length > 0 ? draftList : [draft]).filter((item) => Object.keys(item || {}).length > 0);
    if (!candidates.length) {
      setError('Tiada draf task untuk dicipta.');
      return;
    }

    setCreating(true);
    setError(null);

    let successCount = 0;
    let failedCount = 0;

    try {
      for (const candidate of candidates) {
        const response = await tasksApi.create(buildTaskFormData(candidate, files));
        if (response.success && response.data) {
          successCount += 1;
        } else {
          failedCount += 1;
        }
      }

      if (successCount === 0) {
        throw new Error('Semua draf gagal dicipta. Sila semak medan wajib setiap task.');
      }

      if (failedCount > 0) {
        setError(`Berjaya cipta ${successCount}/${candidates.length} task. ${failedCount} task gagal.`);
      } else {
        resetAssistant();
        setIsOpen(false);
        navigate('/tasks');
      }
    } catch (err: any) {
      setError(err.message || 'Gagal create task secara batch.');
    } finally {
      setCreating(false);
    }
  };

  const handleStartEditDraft = () => {
    setEditedDraft({ ...draft });
    setIsEditingDraft(true);
    setDraftSavedMessage(false);
  };

  const handleEditFieldChange = (key: keyof AssistantDraft, value: string | number | string[] | null) => {
    setEditedDraft((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveDraft = () => {
    setDraft(editedDraft);
    setIsEditingDraft(false);
    setDraftSavedMessage(true);
    setTimeout(() => setDraftSavedMessage(false), 3000);
  };

  const handleCancelEdit = () => {
    setIsEditingDraft(false);
    setEditedDraft({});
  };

  return (
    <div className={embedded ? 'w-full' : 'fixed bottom-4 right-4 z-40 sm:bottom-6 sm:right-6'}>
      {isOpen && (
        <div className={embedded
          ? 'flex min-h-[70vh] w-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_90px_rgba(15,23,42,0.15)]'
          : 'mb-3 flex h-[78dvh] w-[calc(100vw-2rem)] max-w-[420px] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_90px_rgba(15,23,42,0.22)]'}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 bg-[linear-gradient(135deg,#0f172a,#1d4ed8)] px-4 py-3 text-white">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4" /> AI Task Assistant</p>
              <p className="text-xs text-blue-100">Baca fail, isi draf, tanya balik sampai lengkap</p>
            </div>
            {!embedded && (
              <button type="button" onClick={() => setIsOpen(false)} className="rounded-full p-1 text-blue-100 hover:bg-white/10">
                <X className="h-5 w-5" />
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto bg-slate-50 px-3 py-3">
            <div className="space-y-3">
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.role === 'assistant' ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[85%] rounded-2xl border px-3 py-2 text-sm leading-relaxed ${message.role === 'assistant' ? 'border-sky-200 bg-sky-100 text-sky-950 shadow-sm' : 'border-blue-600 bg-blue-600 text-white'}`}>
                    {message.content}
                  </div>
                </div>
              ))}

              {supportTypeOptions.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-xs text-slate-800 shadow-sm">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="font-semibold">Jenis Sokongan</p>
                    {supportTypeRequired && <span className="text-[11px] font-medium text-amber-600">Pilih dulu</span>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {supportTypeOptions.map((option) => {
                      const isActive = option.value === draft.supportType;
                      return (
                        <button
                          key={`${option.id}-${option.value}`}
                          type="button"
                          onClick={() => handleSupportTypeSelect(option.value)}
                          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${isActive ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-blue-300 hover:bg-blue-50'}`}
                        >
                          {option.value}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {filledSummary.length > 0 && !hideDraftCard && !isEditingDraft && (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-3 text-xs text-emerald-900">
                  <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-4 w-4" /> Draf semasa</p>
                    <div className="flex gap-2">
                      <button type="button" onClick={handleStartEditDraft} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 border border-blue-200"><Pencil className="h-3 w-3" /> Edit Draf</button>
                      <button type="button" onClick={() => setHideDraftCard(true)} className="rounded-md px-2 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100">Padam</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {filledSummary.map(([key, value]) => (
                      <div key={key} className="rounded-lg bg-white/70 px-2 py-1">
                        <span className="font-medium">{FIELD_LABELS[key]}:</span> {Array.isArray(value) ? value.join(', ') : String(value)}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {isEditingDraft && (
                <div className="rounded-2xl border border-blue-200 bg-blue-50 px-3 py-3 text-xs">
                  <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="flex items-center gap-2 font-semibold text-blue-900"><Pencil className="h-4 w-4" /> Edit Draf Task</p>
                    <div className="flex gap-2">
                      <button type="button" onClick={handleSaveDraft} className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-[11px] font-semibold text-white bg-blue-600 hover:bg-blue-700"><Save className="h-3 w-3" /> Simpan Draf Sementara</button>
                      <button type="button" onClick={handleCancelEdit} className="rounded-md px-3 py-1.5 text-[11px] font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50">Batal</button>
                    </div>
                  </div>

                  {draftSavedMessage && (
                    <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-[11px] font-medium text-emerald-700">Draf disimpan sementara. Teruskan edit atau klik "Cipta Task" bila sedia.</div>
                  )}

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="flex flex-col gap-1">
                      <span className="font-medium text-slate-700">Tajuk</span>
                      <input value={String(editedDraft.title || '')} onChange={(e) => handleEditFieldChange('title', e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:border-blue-400 focus:outline-none" />
                    </label>
                    <label className="flex flex-col gap-1 sm:col-span-2">
                      <span className="font-medium text-slate-700">Deskripsi</span>
                      <textarea value={String(editedDraft.description || '')} onChange={(e) => handleEditFieldChange('description', e.target.value)} rows={2} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:border-blue-400 focus:outline-none resize-none" />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="font-medium text-slate-700">Jenis Sokongan</span>
                      <select value={String(editedDraft.supportType || '')} onChange={(e) => handleEditFieldChange('supportType', e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:border-blue-400 focus:outline-none">
                        <option value="">Pilih jenis</option>
                        {supportTypeOptions.map((opt) => <option key={opt.id} value={opt.value}>{opt.value}</option>)}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="font-medium text-slate-700">Lokasi Klien</span>
                      <input value={String(editedDraft.clientLocation || '')} onChange={(e) => handleEditFieldChange('clientLocation', e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:border-blue-400 focus:outline-none" />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="font-medium text-slate-700">Bandar / Daerah</span>
                      <input value={String(editedDraft.districtAddress || '')} onChange={(e) => handleEditFieldChange('districtAddress', e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:border-blue-400 focus:outline-none" />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="font-medium text-slate-700">Negeri</span>
                      <input value={String(editedDraft.state || '')} onChange={(e) => handleEditFieldChange('state', e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:border-blue-400 focus:outline-none" />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="font-medium text-slate-700">Tarikh Keperluan</span>
                      <input type="date" value={String(editedDraft.deadline || '')} onChange={(e) => handleEditFieldChange('deadline', e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:border-blue-400 focus:outline-none" />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="font-medium text-slate-700">Harga Tawaran (RM)</span>
                      <input type="number" value={String(editedDraft.offerPrice || '')} onChange={(e) => handleEditFieldChange('offerPrice', e.target.value ? Number(e.target.value) : '')} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:border-blue-400 focus:outline-none" />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="font-medium text-slate-700">Main Con</span>
                      <select value={String(editedDraft.mainConId || '')} onChange={(e) => handleEditFieldChange('mainConId', e.target.value ? Number(e.target.value) : null)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:border-blue-400 focus:outline-none">
                        <option value="">Pilih main con</option>
                        {mainConOptions.map((mc) => <option key={mc.id} value={mc.id}>{mc.name}</option>)}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="font-medium text-slate-700">Nama PIC</span>
                      <input value={String(editedDraft.picName || '')} onChange={(e) => handleEditFieldChange('picName', e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:border-blue-400 focus:outline-none" />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="font-medium text-slate-700">Telefon PIC</span>
                      <input value={String(editedDraft.picPhone || '')} onChange={(e) => handleEditFieldChange('picPhone', e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:border-blue-400 focus:outline-none" />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="font-medium text-slate-700">Nama Klien</span>
                      <input value={String(editedDraft.clientName || '')} onChange={(e) => handleEditFieldChange('clientName', e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:border-blue-400 focus:outline-none" />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="font-medium text-slate-700">Asset Tag</span>
                      <input value={String(editedDraft.assetTagId || '')} onChange={(e) => handleEditFieldChange('assetTagId', e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:border-blue-400 focus:outline-none" />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="font-medium text-slate-700">Jenama Aset</span>
                      <input value={String(editedDraft.assetBrand || '')} onChange={(e) => handleEditFieldChange('assetBrand', e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:border-blue-400 focus:outline-none" />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="font-medium text-slate-700">Model Aset</span>
                      <input value={String(editedDraft.assetModel || '')} onChange={(e) => handleEditFieldChange('assetModel', e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:border-blue-400 focus:outline-none" />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="font-medium text-slate-700">Serial Number Aset</span>
                      <input value={String(editedDraft.assetSerialNumber || '')} onChange={(e) => handleEditFieldChange('assetSerialNumber', e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:border-blue-400 focus:outline-none" />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="font-medium text-slate-700">Cawangan</span>
                      <input value={String(editedDraft.branchName || '')} onChange={(e) => handleEditFieldChange('branchName', e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:border-blue-400 focus:outline-none" />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="font-medium text-slate-700">Projek</span>
                      <select value={String(editedDraft.projectId || '')} onChange={(e) => handleEditFieldChange('projectId', e.target.value ? Number(e.target.value) : null)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:border-blue-400 focus:outline-none">
                        <option value="">Pilih projek</option>
                        {availableProjects.map((p) => <option key={p.id} value={p.id}>{p.code} - {p.name}</option>)}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 sm:col-span-2">
                      <span className="font-medium text-slate-700">Remarks</span>
                      <textarea value={String(editedDraft.remarks || '')} onChange={(e) => handleEditFieldChange('remarks', e.target.value)} rows={2} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:border-blue-400 focus:outline-none resize-none" />
                    </label>
                  </div>
                </div>
              )}

              {needsProjectPicker && (
                <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-3 py-3 text-xs text-indigo-900">
                  <p className="mb-2 font-semibold">Pilih Projek terlebih dahulu</p>
                  <p className="mb-3 text-[11px] text-indigo-700">Untuk Preventive Maintenance atau Deployment, projek perlu dipilih sebelum detail task dimasukkan.</p>
                  {availableProjects.length > 0 && (
                    <div className="max-h-40 space-y-1 overflow-y-auto">
                      {availableProjects.map((proj) => (
                        <button
                          key={proj.id}
                          type="button"
                          onClick={() => handleProjectSelect(proj)}
                          className="w-full rounded-lg border border-indigo-100 bg-white px-2 py-1.5 text-left hover:bg-indigo-100"
                        >
                          <span className="font-medium">{proj.code}</span> — {proj.name}
                          {proj.clientName && <span className="ml-1 text-indigo-500">({proj.clientName})</span>}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateProjectForm((prev) => !prev);
                        if (!showCreateProjectForm) {
                          appendAssistantMessage('Sila isi detail projek baru dahulu. Minimum: Kod Projek dan Nama Projek. Lepas projek berjaya dicipta, baru beri detail task.');
                        }
                      }}
                      className="rounded-lg border border-indigo-200 bg-white px-3 py-1.5 font-medium text-indigo-700 hover:bg-indigo-100"
                    >
                      + Tambah Projek Baru
                    </button>
                  </div>

                  {showCreateProjectForm && (
                    <div className="mt-3 space-y-2 rounded-xl border border-indigo-200 bg-white p-3">
                      <p className="font-semibold text-slate-800">Detail Projek Baru</p>
                      <input
                        value={newProjectForm.code}
                        onChange={(event) => setNewProjectForm((prev) => ({ ...prev, code: event.target.value }))}
                        placeholder="Kod projek"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500"
                      />
                      <input
                        value={newProjectForm.name}
                        onChange={(event) => setNewProjectForm((prev) => ({ ...prev, name: event.target.value }))}
                        placeholder="Nama projek"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500"
                      />
                      <input
                        value={newProjectForm.client_name}
                        onChange={(event) => setNewProjectForm((prev) => ({ ...prev, client_name: event.target.value }))}
                        placeholder="Nama klien (optional)"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500"
                      />
                      <select
                        value={newProjectForm.main_con_id}
                        onChange={(event) => setNewProjectForm((prev) => ({ ...prev, main_con_id: event.target.value ? Number(event.target.value) : '' }))}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500"
                      >
                        <option value="">Main con (optional)</option>
                        {mainConOptions.map((option) => (
                          <option key={option.id} value={option.id}>{option.name}</option>
                        ))}
                      </select>
                      <div className="flex items-center gap-2">
                        <Button variant="secondary" onClick={() => setShowCreateProjectForm(false)} disabled={creatingProjectInline}>Batal</Button>
                        <Button onClick={handleCreateProjectInline} disabled={creatingProjectInline}>
                          {creatingProjectInline ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Menyimpan...</> : 'Simpan Projek'}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {missingFields.length > 0 && !hideMissingCard && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-900">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="font-semibold">Masih belum cukup</p>
                    <button type="button" onClick={() => setHideMissingCard(true)} className="rounded-md px-2 py-1 text-[11px] font-medium text-amber-700 hover:bg-amber-100">Padam</button>
                  </div>
                  <p className="mt-1">{missingFields.join(', ')}</p>
                </div>
              )}

              {warnings.length > 0 && !hideWarningCard && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-3 text-xs text-rose-900">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="font-semibold">Perhatian fail</p>
                    <button type="button" onClick={() => setHideWarningCard(true)} className="rounded-md px-2 py-1 text-[11px] font-medium text-rose-700 hover:bg-rose-100">Padam</button>
                  </div>
                  <div className="mt-1 space-y-1">
                    {warnings.map((warning, index) => (
                      <p key={`${warning}-${index}`}>{warning}</p>
                    ))}
                  </div>
                </div>
              )}

              <div ref={messageEndRef} />
            </div>
          </div>

          <div className="border-t border-slate-200 bg-white p-3">
            {files.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {files.map((file) => (
                  <div key={`${file.name}-${file.size}`} className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                    <FileText className="h-3.5 w-3.5" />
                    <span className="max-w-32 truncate">{file.name}</span>
                    <button type="button" onClick={() => removeFile(file.name)} className="text-slate-500 hover:text-slate-800">×</button>
                  </div>
                ))}
              </div>
            )}

            {error && <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>}

            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  if (!loading && !creating) {
                    void handleSend();
                  }
                }
              }}
              placeholder={supportTypeRequired
                ? 'Pilih Jenis Sokongan dulu. Lepas itu anda boleh paste chat, list, atau lampir dokumen.'
                : needsProjectPicker
                  ? 'Pilih atau cipta projek dulu. Selepas itu masukkan detail task sama ada single atau multiple.'
                  : 'Masukkan detail task. Boleh single, multiple, list, chat, atau lampir dokumen.'}
              className="min-h-[86px] w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white"
            />

            <div className="mt-3 flex items-center gap-2">
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileChange} />
              <button type="button" onClick={() => fileInputRef.current?.click()} className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 text-slate-600 hover:bg-slate-50" title="Lampir fail">
                <Paperclip className="h-4 w-4" />
              </button>
              <div className="min-w-0 flex-1 text-[11px] leading-tight text-slate-600">
                Anda boleh lampirkan hampir semua jenis dokumen. AI akan cuba baca kandungan secara best-effort. Maksimum 5 fail, saiz maksimum 10MB setiap fail.
              </div>
              <Button
                className={`justify-center ${(loading || creating) ? 'disabled:opacity-100' : ''}`}
                variant="secondary"
                onClick={handleSend}
                disabled={loading || creating}
              >
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Memproses...</> : <><Send className="mr-2 h-4 w-4" /> Hantar ke AI</>}
              </Button>
            </div>

            {isComplete && (
              <div className="mb-3 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
                ✅ Draf lengkap — klik <span className="underline">Cipta Task</span> untuk simpan ke sistem.
              </div>
            )}
            {draftList.length > 1 && (
              <div className="mb-3 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-800">
                📌 AI kesan {draftList.length} draf task. Draf lengkap: {completedDraftCount}/{draftList.length}.
              </div>
            )}
            <div className="mt-3 flex items-center gap-2">
              <Button
                className={`flex-1 justify-center ${isComplete && !creating ? 'animate-pulse ring-2 ring-emerald-400 ring-offset-1' : ''}`}
                onClick={handleCreateTask}
                disabled={!isComplete || loading || creating}
              >
                {creating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Mencipta Task...</> : '✅ Cipta Task'}
              </Button>
              {draftList.length > 1 && (
                <Button
                  variant="secondary"
                  className={`justify-center ${creating ? 'disabled:opacity-100' : ''}`}
                  onClick={handleCreateAllTasks}
                  disabled={loading || creating || completedDraftCount === 0}
                >
                  {creating ? 'Memproses...' : `Cipta Semua (${completedDraftCount})`}
                </Button>
              )}
              <Button variant="secondary" onClick={resetAssistant} disabled={loading || creating}>Reset</Button>
            </div>
          </div>
        </div>
      )}

      {!embedded && (
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="group inline-flex h-16 items-center gap-3 rounded-full bg-[linear-gradient(135deg,#0f172a,#2563eb)] px-5 text-sm font-semibold text-white shadow-[0_18px_50px_rgba(37,99,235,0.35)] transition hover:translate-y-[-1px]"
        >
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/15"><MessageCirclePlus className="h-5 w-5" /></span>
          <span className="hidden sm:inline">Bina Task Dengan AI</span>
        </button>
      )}
    </div>
  );
};