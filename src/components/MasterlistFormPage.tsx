import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Masterlist, Project } from '../types';
import { MasterlistStatus } from '../types';
import { masterlistsApi, projectsApi } from '../services/api';
import api from '../utils/axios';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Textarea } from './ui/Textarea';

interface FormState {
  project_id: number | '';
  code: string;
  name: string;
  description: string;
  status: MasterlistStatus;
}

const defaultFormState: FormState = {
  project_id: '',
  code: '',
  name: '',
  description: '',
  status: MasterlistStatus.AKTIF
};

type MasterlistEntryMode = 'link' | 'document';

const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_DOCUMENT_EXTENSIONS = ['.doc', '.docx', '.pdf', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.rtf'];
const ACCEPTED_DOCUMENT_MIME_TYPES = [
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/pdf',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'application/rtf',
  'text/rtf'
];
const ACCEPTED_DOCUMENT_INPUT = ACCEPTED_DOCUMENT_EXTENSIONS.join(',');

type MasterlistFormPageProps = {
  showToast: (message: string, type?: 'success' | 'error') => void;
  hasPermission: (permission: string) => boolean;
};

export const MasterlistFormPage: React.FC<MasterlistFormPageProps> = ({ showToast, hasPermission }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditMode = Boolean(id);

  const [formState, setFormState] = useState<FormState>(defaultFormState);
  const [loadedMasterlist, setLoadedMasterlist] = useState<Masterlist | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entryMode, setEntryMode] = useState<MasterlistEntryMode>('link');

  const [links, setLinks] = useState<Array<{ title: string; url: string }>>([]);
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkUrlError, setLinkUrlError] = useState<string | null>(null);

  const [documentTitle, setDocumentTitle] = useState('');
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const documentInputRef = useRef<HTMLInputElement | null>(null);
  const canDeleteWorkItems = useMemo(() => hasPermission('tasks:edit:all'), [hasPermission]);
  const [pendingDelete, setPendingDelete] = useState<{ kind: 'link' | 'document'; index: number } | null>(null);
  const [deletingWorkItem, setDeletingWorkItem] = useState(false);

  const selectedProject = useMemo(() => {
    if (!formState.project_id) return null;
    return projects.find((project) => project.id === Number(formState.project_id)) || null;
  }, [formState.project_id, projects]);

  const selectedMainConLabel = selectedProject?.mainCon?.name || '-';
  const selectedClientLabel = selectedProject?.client_name || '-';

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const response = await projectsApi.getAll(1, 100, { sortBy: 'name', sort: 'asc' });
        if (!response.success || !response.data) return;

        const data = response.data as any;
        setProjects(Array.isArray(data.projects) ? data.projects : []);
      } catch {
        setProjects([]);
      }
    };

    fetchProjects();
  }, []);

  useEffect(() => {
    const loadMasterlist = async () => {
      if (!id) return;

      setLoading(true);
      setError(null);

      try {
        const response = await masterlistsApi.getById(Number(id), { include_assets: false });
        if (!response.success || !response.data) {
          setError(response.error || 'Gagal memuatkan masterlist.');
          return;
        }

        const masterlist = response.data as Masterlist;
        setLoadedMasterlist(masterlist);
        setFormState({
          project_id: masterlist.project_id,
          code: masterlist.code || '',
          name: masterlist.name || '',
          description: masterlist.description || '',
          status: masterlist.status || MasterlistStatus.AKTIF
        });
        setLinks(Array.isArray(masterlist.work_links) ? masterlist.work_links : []);
        setEntryMode('link');
      } catch {
        setError('Ralat semasa memuatkan masterlist.');
      } finally {
        setLoading(false);
      }
    };

    loadMasterlist();
  }, [id]);

  const confirmDeleteWorkItem = async () => {
    if (!id || !pendingDelete || deletingWorkItem || !canDeleteWorkItems) return;

    setDeletingWorkItem(true);
    try {
      const response =
        pendingDelete.kind === 'link'
          ? await masterlistsApi.deleteWorkLink(Number(id), pendingDelete.index)
          : await masterlistsApi.deleteWorkDocument(Number(id), pendingDelete.index);

      if (!response?.success || !response?.data) {
        showToast(response?.error || response?.message || 'Gagal memadam item.', 'error');
        return;
      }

      const updated = response.data as Masterlist;
      setLoadedMasterlist(updated);
      setLinks(Array.isArray(updated.work_links) ? updated.work_links : []);
      showToast(response.message || 'Berjaya dipadam.', 'success');
    } catch (error: any) {
      showToast(error?.response?.data?.message || 'Gagal memadam item.', 'error');
    } finally {
      setDeletingWorkItem(false);
      setPendingDelete(null);
    }
  };

  const isValidHttpUrl = (value: string) => {
    try {
      const parsed = new URL(value);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const validateLinkUrl = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (!isValidHttpUrl(trimmed)) return 'URL mesti bermula dengan http:// atau https://';
    return null;
  };

  const addLink = () => {
    const titleValue = linkTitle.trim();
    const urlValue = linkUrl.trim();
    const urlError = validateLinkUrl(urlValue);
    setLinkUrlError(urlError);

    if (!titleValue || !urlValue) {
      setError('Nama link dan URL wajib diisi.');
      return;
    }
    if (urlError) {
      setError('Sila betulkan URL link.');
      return;
    }

    setLinks((prev) => [...prev, { title: titleValue, url: urlValue }]);
    setLinkTitle('');
    setLinkUrl('');
    setLinkUrlError(null);
  };

  const validateDocumentFile = (file: File) => {
    const extension = `.${String(file.name).split('.').pop() || ''}`.toLowerCase();
    const mimeType = String(file.type || '').toLowerCase();
    const sizeOk = file.size <= MAX_DOCUMENT_SIZE_BYTES;
    const typeOk = ACCEPTED_DOCUMENT_EXTENSIONS.includes(extension) || ACCEPTED_DOCUMENT_MIME_TYPES.includes(mimeType);

    if (!typeOk) return `Jenis fail tidak dibenarkan. Hanya: ${ACCEPTED_DOCUMENT_EXTENSIONS.join(', ')}`;
    if (!sizeOk) return 'Saiz fail melebihi 10MB.';
    return null;
  };

  const handlePickDocument = (file: File) => {
    const fileError = validateDocumentFile(file);
    if (fileError) {
      setDocumentFile(null);
      setDocumentError(fileError);
      return;
    }

    setDocumentFile(file);
    setDocumentError(null);
  };

  const handleSave = async () => {
    if (!formState.project_id || !formState.code.trim() || !formState.name.trim()) {
      setError('Projek, kod masterlist, dan nama masterlist wajib diisi.');
      return;
    }

    setSaving(true);
    setError(null);
    setDocumentError(null);
    setUploadProgress(null);

    try {
      const payload = {
        project_id: Number(formState.project_id),
        code: formState.code.trim(),
        name: formState.name.trim(),
        description: formState.description.trim() || undefined,
        status: formState.status,
        ...(entryMode === 'link' ? { links } : {})
      };

      const response =
        entryMode === 'document' && documentFile
          ? await (async () => {
              const documentTitleValue = documentTitle.trim();
              if (!documentTitleValue) {
                setDocumentError('Nama dokumen wajib diisi.');
                return { success: false, error: 'Nama dokumen wajib diisi.' } as any;
              }

              const fileError = validateDocumentFile(documentFile);
              if (fileError) {
                setDocumentError(fileError);
                return { success: false, error: fileError } as any;
              }

              const formData = new FormData();
              formData.append('project_id', String(payload.project_id));
              formData.append('code', payload.code);
              formData.append('name', payload.name);
              if (payload.description) formData.append('description', payload.description);
              if (payload.status) formData.append('status', payload.status);
              formData.append('document_title', documentTitleValue);
              formData.append('document', documentFile);

              setUploadProgress(0);
              const axiosResponse = isEditMode
                ? await api.put(`/masterlists/${id}`, formData, {
                    onUploadProgress: (event) => {
                      const total = event.total || 0;
                      if (!total) return;
                      const percent = Math.round((event.loaded / total) * 100);
                      setUploadProgress(Math.min(100, Math.max(0, percent)));
                    }
                  })
                : await api.post('/masterlists', formData, {
                    onUploadProgress: (event) => {
                      const total = event.total || 0;
                      if (!total) return;
                      const percent = Math.round((event.loaded / total) * 100);
                      setUploadProgress(Math.min(100, Math.max(0, percent)));
                    }
                  });

              const data = axiosResponse.data;
              return {
                success: Boolean(data?.success),
                data: data?.data,
                error: data?.message || data?.error
              };
            })()
          : isEditMode
            ? await masterlistsApi.update(Number(id), payload)
            : await masterlistsApi.create(payload);

      if (!response.success) {
        setError(response.error || 'Gagal menyimpan masterlist.');
        return;
      }

      navigate('/masterlists');
    } catch {
      setError('Ralat semasa menyimpan masterlist.');
    } finally {
      setSaving(false);
      setUploadProgress(null);
    }
  };

  if (loading) {
    return <div className="bg-white rounded-lg shadow-md p-6">Memuatkan borang masterlist...</div>;
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="px-6 py-4 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">{isEditMode ? 'Kemaskini Masterlist' : 'Tambah Masterlist'}</h2>
          <p className="text-sm text-gray-600 mt-1">Masterlist berada di bawah projek.</p>
        </div>
        <Button variant="secondary" onClick={() => navigate('/masterlists')}>Kembali</Button>
      </div>

      <div className="p-6 space-y-4">
        {error && (
          <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Select
            label="Projek"
            value={formState.project_id}
            onChange={(e) => setFormState((prev) => ({ ...prev, project_id: e.target.value ? Number(e.target.value) : '' }))}
          >
            <option value="">Pilih Projek</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>{project.code} - {project.name}</option>
            ))}
          </Select>

          <Input
            label="Main-Con"
            value={selectedMainConLabel}
            readOnly
            disabled
          />

          <Input
            label="Client"
            value={selectedClientLabel}
            readOnly
            disabled
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Kod Masterlist"
            value={formState.code}
            onChange={(e) => setFormState((prev) => ({ ...prev, code: e.target.value }))}
            placeholder="Contoh: ML-001"
          />
          <Select
            label="Status"
            options={[
              { label: MasterlistStatus.AKTIF, value: MasterlistStatus.AKTIF },
              { label: MasterlistStatus.TIDAK_AKTIF, value: MasterlistStatus.TIDAK_AKTIF }
            ]}
            value={formState.status}
            onChange={(e) => setFormState((prev) => ({ ...prev, status: e.target.value as MasterlistStatus }))}
          />
        </div>

        <Input
          label="Nama Masterlist"
          value={formState.name}
          onChange={(e) => setFormState((prev) => ({ ...prev, name: e.target.value }))}
          placeholder="Nama kumpulan aset"
        />

        <Textarea
          label="Penerangan"
          value={formState.description}
          onChange={(e) => setFormState((prev) => ({ ...prev, description: e.target.value }))}
          placeholder="Penerangan ringkas"
          rows={4}
        />

        <div className="rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-gray-800">Mod Input</div>
              <div className="text-xs text-gray-600">Pilih sama ada tambah link atau upload dokumen kerja.</div>
            </div>
            <div className="flex w-full sm:w-auto gap-2">
              <button
                type="button"
                onClick={() => setEntryMode('link')}
                className={`flex-1 sm:flex-none px-3 py-2 rounded-md text-sm border transition-colors ${
                  entryMode === 'link'
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                Link
              </button>
              <button
                type="button"
                onClick={() => setEntryMode('document')}
                className={`flex-1 sm:flex-none px-3 py-2 rounded-md text-sm border transition-colors ${
                  entryMode === 'document'
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                Dokumen
              </button>
            </div>
          </div>

          <div className="p-4 space-y-4">
            {entryMode === 'link' ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Nama Link"
                    value={linkTitle}
                    onChange={(e) => setLinkTitle(e.target.value)}
                    placeholder="Contoh: Manual Vendor"
                  />
                  <div>
                    <Input
                      label="URL"
                      value={linkUrl}
                      onChange={(e) => {
                        const value = e.target.value;
                        setLinkUrl(value);
                        setLinkUrlError(validateLinkUrl(value));
                      }}
                      placeholder="https://..."
                    />
                    {linkUrlError && <div className="mt-1 text-xs text-red-600">{linkUrlError}</div>}
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button variant="secondary" onClick={addLink} disabled={!linkTitle.trim() || !linkUrl.trim()}>
                    Tambah Link
                  </Button>
                </div>

                {links.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-gray-800">Senarai Link</div>
                    <div className="space-y-2">
                      {links.map((item, idx) => {
                        const persistedLinksCount = (loadedMasterlist?.work_links || []).length;
                        const isPersisted = isEditMode && idx < persistedLinksCount;
                        return (
                          <div
                            key={`${item.url}-${idx}`}
                            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-md border border-gray-200 px-3 py-2"
                          >
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-gray-800 truncate">{item.title}</div>
                              <div className="text-xs text-gray-600 truncate">{item.url}</div>
                            </div>
                            {isPersisted ? (
                              <Button
                                size="sm"
                                variant="danger"
                                disabled={!canDeleteWorkItems || deletingWorkItem}
                                onClick={() => setPendingDelete({ kind: 'link', index: idx })}
                              >
                                Padam
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => setLinks((prev) => prev.filter((_, i) => i !== idx))}
                              >
                                Buang
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <Input
                  label="Nama Dokumen"
                  value={documentTitle}
                  onChange={(e) => setDocumentTitle(e.target.value)}
                  placeholder="Contoh: Borang Kerja"
                />

                <input
                  ref={documentInputRef}
                  type="file"
                  accept={ACCEPTED_DOCUMENT_INPUT}
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handlePickDocument(file);
                  }}
                />

                <div
                  className={`rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
                    isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 bg-white'
                  }`}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDragging(true);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDragging(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDragging(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDragging(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) handlePickDocument(file);
                  }}
                >
                  <div className="text-sm font-medium text-gray-800">Drag & drop dokumen di sini</div>
                  <div className="mt-1 text-xs text-gray-600">
                    {ACCEPTED_DOCUMENT_EXTENSIONS.join(', ')} • Maks 10MB
                  </div>
                  <div className="mt-4 flex justify-center">
                    <Button
                      variant="secondary"
                      onClick={() => documentInputRef.current?.click()}
                    >
                      Pilih Fail
                    </Button>
                  </div>

                  {documentFile && (
                    <div className="mt-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-left">
                      <div className="text-sm font-medium text-green-800 truncate">{documentFile.name}</div>
                      <div className="text-xs text-green-700">
                        {(documentFile.size / 1024 / 1024).toFixed(2)} MB
                      </div>
                      <div className="mt-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setDocumentFile(null);
                            setDocumentError(null);
                            if (documentInputRef.current) documentInputRef.current.value = '';
                          }}
                        >
                          Buang Fail
                        </Button>
                      </div>
                    </div>
                  )}

                  {documentError && (
                    <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-left text-sm text-red-700">
                      {documentError}
                    </div>
                  )}

                  {uploadProgress !== null && (
                    <div className="mt-4">
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>Upload</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <div className="mt-1 h-2 w-full rounded bg-gray-200 overflow-hidden">
                        <div className="h-2 bg-indigo-600" style={{ width: `${uploadProgress}%` }} />
                      </div>
                    </div>
                  )}
                </div>

                {isEditMode && (loadedMasterlist?.work_documents || []).length > 0 && (
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-gray-800">Dokumen Sedia Ada</div>
                    <div className="space-y-2">
                      {(loadedMasterlist?.work_documents || []).map((doc, idx) => {
                        const path = String(doc.file_path || '').replace(/^\.?\//, '').replace(/\\/g, '/');
                        const url = `${window.location.origin}/${path}`;
                        return (
                          <div
                            key={`${doc.file_name}-${idx}`}
                            className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 rounded-md border border-gray-200 px-3 py-2"
                          >
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-gray-800 truncate">{doc.title}</div>
                              <div className="text-xs text-gray-600 truncate">{doc.file_name}</div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <a
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center justify-center px-3 py-2 rounded-md text-sm border border-gray-300 hover:bg-gray-50"
                              >
                                Buka
                              </a>
                              {canDeleteWorkItems && (
                                <Button
                                  size="sm"
                                  variant="danger"
                                  disabled={deletingWorkItem}
                                  onClick={() => setPendingDelete({ kind: 'document', index: idx })}
                                >
                                  Padam
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white shadow-lg">
            <div className="px-5 py-4 border-b">
              <div className="text-base font-semibold text-gray-900">Sahkan Penghapusan</div>
              <div className="mt-1 text-sm text-gray-600">
                Anda pasti mahu memadam {pendingDelete.kind === 'link' ? 'link' : 'dokumen'} ini? Tindakan ini tidak boleh dipulihkan.
              </div>
            </div>
            <div className="px-5 py-4 flex justify-end gap-2">
              <Button
                variant="secondary"
                disabled={deletingWorkItem}
                onClick={() => setPendingDelete(null)}
              >
                Batal
              </Button>
              <Button
                variant="danger"
                disabled={deletingWorkItem || !canDeleteWorkItems}
                onClick={confirmDeleteWorkItem}
              >
                {deletingWorkItem ? 'Memadam...' : 'Padam'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-2">
        <Button variant="secondary" onClick={() => navigate('/masterlists')}>Batal</Button>
        <Button onClick={handleSave} disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan'}</Button>
      </div>
    </div>
  );
};
