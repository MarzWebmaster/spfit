import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Masterlist, Project } from '../types';
import { MasterlistStatus } from '../types';
import { masterlistsApi, projectsApi } from '../services/api';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { MasterlistImportModal } from './MasterlistImportModal';
import { MASTERLIST_COLUMN_KEYS, MASTERLIST_DEFAULT_ORDER, MASTERLIST_DEFAULT_VISIBLE, type MasterlistColumnKey } from '../utils/columnViewDefaults';

export const MasterlistsPage: React.FC = () => {
  const navigate = useNavigate();
  const [masterlists, setMasterlists] = useState<Masterlist[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Record<MasterlistColumnKey, boolean>>(() => ({ ...MASTERLIST_DEFAULT_VISIBLE }));
  const [columnOrder, setColumnOrder] = useState<MasterlistColumnKey[]>(() => [...MASTERLIST_DEFAULT_ORDER]);
  const [draggingColumn, setDraggingColumn] = useState<MasterlistColumnKey | null>(null);

  const currentUserId = useMemo(() => {
    try {
      const raw = localStorage.getItem('spfit_current_user');
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed?.id ? String(parsed.id) : 'guest';
    } catch {
      return 'guest';
    }
  }, []);

  useEffect(() => {
    const key = `spfit_masterlists_columns_${currentUserId}`;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return;
      setVisibleColumns((prev) => {
        const next = { ...prev };
        MASTERLIST_COLUMN_KEYS.forEach((k) => {
          if (Object.prototype.hasOwnProperty.call(parsed, k)) next[k] = Boolean((parsed as any)[k]);
        });
        return next;
      });
    } catch {}
  }, [currentUserId]);

  useEffect(() => {
    const key = `spfit_masterlists_columns_order_${currentUserId}`;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || !parsed.length) return;
      const allowed = new Set<MasterlistColumnKey>(MASTERLIST_COLUMN_KEYS);
      const next = parsed.filter((k: any) => typeof k === 'string' && allowed.has(k as MasterlistColumnKey)) as MasterlistColumnKey[];
      if (!next.length) return;
      setColumnOrder((prev) => {
        const dedup = Array.from(new Set(next));
        const missing = prev.filter((k) => !dedup.includes(k));
        return [...dedup, ...missing];
      });
    } catch {}
  }, [currentUserId]);

  useEffect(() => {
    const key = `spfit_masterlists_columns_${currentUserId}`;
    try {
      localStorage.setItem(key, JSON.stringify(visibleColumns));
    } catch {}
  }, [currentUserId, visibleColumns]);

  useEffect(() => {
    const key = `spfit_masterlists_columns_order_${currentUserId}`;
    try {
      localStorage.setItem(key, JSON.stringify(columnOrder));
    } catch {}
  }, [currentUserId, columnOrder]);

  const columnLabels: Record<MasterlistColumnKey, string> = {
    code: 'Kod',
    name: 'Nama',
    project: 'Projek',
    status: 'Status',
    asset_count: 'Bil. Aset',
    created_at: 'Dibuat',
    updated_at: 'Dikemaskini',
    description: 'Keterangan'
  };

  const moveColumn = (from: MasterlistColumnKey, to: MasterlistColumnKey) => {
    if (from === to) return;
    setColumnOrder((prev) => {
      const fromIndex = prev.indexOf(from);
      const toIndex = prev.indexOf(to);
      if (fromIndex < 0 || toIndex < 0) return prev;
      const next = [...prev];
      next.splice(fromIndex, 1);
      next.splice(toIndex, 0, from);
      return next;
    });
  };

  const totalPages = useMemo(() => Math.max(Math.ceil(total / limit), 1), [total, limit]);
  const visibleColumnKeys = useMemo(() => columnOrder.filter((k) => visibleColumns[k]), [columnOrder, visibleColumns]);

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

  const fetchMasterlists = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await masterlistsApi.getAll(page, limit, {
        q: query || undefined,
        status: statusFilter || undefined,
        project_id: projectFilter ? Number(projectFilter) : undefined,
        sortBy: 'created_at',
        sort: 'desc'
      });

      if (!response.success || !response.data) {
        setError(response.error || 'Gagal memuatkan data masterlist.');
        return;
      }

      const data = response.data as any;
      const rows = Array.isArray(data.masterlists) ? data.masterlists : [];
      setMasterlists(rows);
      setTotal(Number(data.pagination?.total || rows.length));
    } catch {
      setError('Ralat semasa memuatkan data masterlist.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchMasterlists();
    }, 250);

    return () => clearTimeout(timer);
  }, [page, query, statusFilter, projectFilter]);

  const handleDelete = async (masterlist: Masterlist) => {
    const confirmed = window.confirm(`Padam masterlist ${masterlist.code} - ${masterlist.name}?`);
    if (!confirmed) return;

    setLoading(true);
    setError(null);

    try {
      const response = await masterlistsApi.delete(masterlist.id);
      if (!response.success) {
        setError(response.error || 'Gagal memadam masterlist.');
        return;
      }

      if (masterlists.length === 1 && page > 1) {
        setPage(page - 1);
      } else {
        await fetchMasterlists();
      }
    } catch {
      setError('Ralat semasa memadam masterlist.');
    } finally {
      setLoading(false);
    }
  };

  const handleDuplicate = async (masterlist: Masterlist) => {
    const confirmed = window.confirm(`Duplikasi masterlist ${masterlist.code} - ${masterlist.name} sebagai draf baru?`);
    if (!confirmed) return;

    setDuplicatingId(masterlist.id);
    setError(null);
    setSuccess(null);
    try {
      const response = await masterlistsApi.duplicate(masterlist.id, { include_assets: true });
      if (!response.success || !response.data) {
        setError(response.error || 'Gagal menduplikasi masterlist.');
        return;
      }
      const created = (response.data as any).masterlist || (response.data as any).data?.masterlist;
      await fetchMasterlists();
      setSuccess('Masterlist berjaya diduplikasi.');
      if (created?.id) {
        navigate(`/masterlists/${created.id}`);
      }
    } catch {
      setError('Ralat semasa menduplikasi masterlist.');
    } finally {
      setDuplicatingId(null);
    }
  };

  return (
    <div className="bg-white shadow-md rounded-lg overflow-hidden">
      <div className="p-4 sm:p-6 border-b">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Masterlist Projek</h2>
            <p className="mt-1 text-sm text-gray-600">Masterlist adalah submodul projek untuk kumpulan aset.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setImportOpen(true)}>Import</Button>
            <Button onClick={() => navigate('/masterlists/create')}>Tambah Masterlist</Button>
          </div>
        </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
            <Input
              type="search"
              placeholder="Cari kod / nama"
              value={query}
              onChange={(e) => {
                setPage(1);
                setQuery(e.target.value);
              }}
            />
            <Select
              options={[
                { label: 'Semua Projek', value: '' },
                ...projects.map((project) => ({
                  label: `${project.code} - ${project.name}`,
                  value: project.id
                }))
              ]}
              value={projectFilter}
              onChange={(e) => {
                setPage(1);
                setProjectFilter(e.target.value);
              }}
            />
            <Select
              options={[
                { label: 'Semua Status', value: '' },
                { label: MasterlistStatus.AKTIF, value: MasterlistStatus.AKTIF },
                { label: MasterlistStatus.TIDAK_AKTIF, value: MasterlistStatus.TIDAK_AKTIF }
              ]}
              value={statusFilter}
              onChange={(e) => {
                setPage(1);
                setStatusFilter(e.target.value);
              }}
            />
            <div className="flex items-end justify-end gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setShowColumnSelector(!showColumnSelector)}
                className="text-sm"
              >
                Column
              </Button>
              <div className="text-sm text-gray-600">
                Jumlah: <span className="ml-1 font-semibold">{total}</span>
              </div>
            </div>
          </div>
      </div>

      {error && (
        <div className="mx-4 mt-4 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="mx-4 mt-4 rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-700">
          {success}
        </div>
      )}

      {showColumnSelector && (
        <div className="mx-4 mt-4 mb-4 p-4 bg-white border border-gray-200 rounded-md shadow-sm">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-semibold text-gray-800">Pilih Column</h3>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setShowColumnSelector(false)}
            >
              Tutup
            </Button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {columnOrder.map((key) => (
              <div
                key={key}
                className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', key);
                  e.dataTransfer.effectAllowed = 'move';
                  setDraggingColumn(key);
                }}
                onDragEnd={() => setDraggingColumn(null)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const from = (e.dataTransfer.getData('text/plain') as MasterlistColumnKey) || draggingColumn;
                  if (from) moveColumn(from, key);
                  setDraggingColumn(null);
                }}
              >
                <span className="cursor-move select-none text-gray-400">⋮⋮</span>
                <input
                  type="checkbox"
                  checked={visibleColumns[key]}
                  onChange={(e) => setVisibleColumns((prev) => ({ ...prev, [key]: e.target.checked }))}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700">{columnLabels[key]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="overflow-x-auto relative min-h-[160px]">
        {loading && (
          <div className="absolute inset-0 bg-white/50 flex items-center justify-center z-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        )}

        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {visibleColumnKeys.map((key) => (
                <th key={key} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {columnLabels[key]}
                </th>
              ))}
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Tindakan</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {masterlists.map((masterlist) => (
              <tr
                key={masterlist.id}
                onClick={() => navigate(`/masterlists/${masterlist.id}`)}
                className="hover:bg-gray-50 cursor-pointer"
              >
                {visibleColumnKeys.map((key) => {
                  if (key === 'code') {
                    return (
                      <td key={key} className="px-6 py-4 whitespace-nowrap text-sm font-medium text-indigo-700">
                        {masterlist.code}
                      </td>
                    );
                  }
                  if (key === 'name') return <td key={key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{masterlist.name}</td>;
                  if (key === 'project') return <td key={key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{masterlist.project ? `${masterlist.project.code} - ${masterlist.project.name}` : '-'}</td>;
                  if (key === 'status') return <td key={key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{masterlist.status}</td>;
                  if (key === 'asset_count') return <td key={key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{masterlist.asset_count ?? 0}</td>;
                  if (key === 'description') return <td key={key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{masterlist.description || '-'}</td>;
                  if (key === 'created_at') return <td key={key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{new Date(masterlist.created_at).toLocaleDateString('ms-MY')}</td>;
                  if (key === 'updated_at') return <td key={key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{new Date(masterlist.updated_at).toLocaleDateString('ms-MY')}</td>;
                  return <td key={key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">-</td>;
                })}
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium" onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="secondary" onClick={() => navigate(`/masterlists/${masterlist.id}`)}>Lihat</Button>
                    <Button size="sm" variant="secondary" onClick={() => navigate(`/masterlists/${masterlist.id}/edit`)}>Edit</Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleDuplicate(masterlist)}
                      disabled={duplicatingId === masterlist.id}
                    >
                      {duplicatingId === masterlist.id ? 'Menduplikasi...' : 'Duplicate'}
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => handleDelete(masterlist)}>Padam</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!loading && masterlists.length === 0 && (
          <div className="p-8 text-center text-sm text-gray-500">Tiada data masterlist ditemui.</div>
        )}
      </div>

      <div className="px-4 py-3 border-t bg-gray-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="text-sm text-gray-600">Halaman {page} / {totalPages}</div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setPage((p) => Math.max(p - 1, 1))} disabled={page <= 1}>Sebelumnya</Button>
          <Button variant="secondary" size="sm" onClick={() => setPage((p) => Math.min(p + 1, totalPages))} disabled={page >= totalPages}>Seterusnya</Button>
        </div>
      </div>

      <MasterlistImportModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        onImportSuccess={() => { setImportOpen(false); fetchMasterlists(); }}
      />
    </div>
  );
};
