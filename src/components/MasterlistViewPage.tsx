import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { Asset, Masterlist } from '../types';
import { AssetStatus } from '../types';
import { assetsApi, masterlistsApi } from '../services/api';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { AssetImportModal } from './AssetImportModal';
import { AssetScanModal } from './AssetScanModal';

type MasterlistViewPageProps = {
  showToast: (message: string, type?: 'success' | 'error') => void;
  hasPermission: (permission: string) => boolean;
};

type AssetColumnKey =
  | 'asset_tag'
  | 'name'
  | 'category'
  | 'brand_model'
  | 'serial_number'
  | 'status'
  | 'attachments'
  | 'updated_at'
  | 'updated_by';

export const MasterlistViewPage: React.FC<MasterlistViewPageProps> = ({ showToast, hasPermission }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [masterlist, setMasterlist] = useState<Masterlist | null>(null);
  const [masterlistLoading, setMasterlistLoading] = useState(true);
  const [masterlistError, setMasterlistError] = useState<string | null>(null);

  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(true);
  const [assetsError, setAssetsError] = useState<string | null>(null);
  const [assetsReloadKey, setAssetsReloadKey] = useState(0);

  const [assetSearch, setAssetSearch] = useState('');
  const [debouncedAssetSearch, setDebouncedAssetSearch] = useState('');
  const [assetStatusFilter, setAssetStatusFilter] = useState('ALL');
  const [assetSortBy, setAssetSortBy] = useState<string | null>(null);

  const [page, setPage] = useState(() => {
    const raw = Number(searchParams.get('page') || 1);
    return Number.isFinite(raw) && raw > 0 ? raw : 1;
  });
  const [limit, setLimit] = useState(() => {
    const raw = Number(searchParams.get('limit') || 10);
    return [10, 20, 50, 100].includes(raw) ? raw : 10;
  });
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);

  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportOptions, setExportOptions] = useState({
    masterlist: true,
    project: true,
    asset: true,
    users: true,
    accessories: true
  });
  const [exportFormat, setExportFormat] = useState<'csv' | 'xlsx'>('csv');
  const [exportLoading, setExportLoading] = useState(false);

  const canDeleteWorkItems = useMemo(() => hasPermission('tasks:edit:all'), [hasPermission]);

  const [pendingDelete, setPendingDelete] = useState<{ kind: 'link' | 'document'; index: number } | null>(null);
  const [deletingWorkItem, setDeletingWorkItem] = useState(false);

  const [columnsOpen, setColumnsOpen] = useState(false);
  const [assetColumns, setAssetColumns] = useState<Record<AssetColumnKey, boolean>>({
    asset_tag: true,
    name: true,
    category: true,
    brand_model: true,
    serial_number: true,
    status: true,
    attachments: true,
    updated_at: true,
    updated_by: true
  });
  const [assetColumnOrder, setAssetColumnOrder] = useState<AssetColumnKey[]>([
    'asset_tag',
    'name',
    'category',
    'brand_model',
    'serial_number',
    'status',
    'attachments',
    'updated_at',
    'updated_by'
  ]);
  const [draggingColumn, setDraggingColumn] = useState<AssetColumnKey | null>(null);

  const assetsTopRef = useRef<HTMLDivElement | null>(null);

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
    const handle = window.setTimeout(() => setDebouncedAssetSearch(assetSearch.trim()), 350);
    return () => window.clearTimeout(handle);
  }, [assetSearch]);

  useEffect(() => {
    const nextPageRaw = Number(searchParams.get('page') || 1);
    const nextLimitRaw = Number(searchParams.get('limit') || 10);
    const nextPage = Number.isFinite(nextPageRaw) && nextPageRaw > 0 ? nextPageRaw : 1;
    const nextLimit = [10, 20, 50, 100].includes(nextLimitRaw) ? nextLimitRaw : 10;
    if (nextPage !== page) setPage(nextPage);
    if (nextLimit !== limit) setLimit(nextLimit);
  }, [searchParams]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    const pageString = String(page);
    const limitString = String(limit);
    const currentPage = next.get('page');
    const currentLimit = next.get('limit');
    if (currentPage !== pageString) next.set('page', pageString);
    if (currentLimit !== limitString) next.set('limit', limitString);
    if (currentPage !== pageString || currentLimit !== limitString) setSearchParams(next, { replace: true });
  }, [page, limit]);

  useEffect(() => {
    if (!id) return;
    const key = `spfit_masterlist_asset_columns_${currentUserId}_${id}`;
    const lastKey = `spfit_masterlist_asset_columns_last_${currentUserId}`;
    try {
      const raw = localStorage.getItem(key) ?? localStorage.getItem(lastKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') setAssetColumns((prev) => ({ ...prev, ...parsed }));
      }
    } catch {}
  }, [id, currentUserId]);

  useEffect(() => {
    if (!id) return;
    const key = `spfit_masterlist_asset_columns_order_${currentUserId}_${id}`;
    const lastKey = `spfit_masterlist_asset_columns_order_last_${currentUserId}`;
    try {
      const raw = localStorage.getItem(key) ?? localStorage.getItem(lastKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) {
          const next = parsed.filter((k) => typeof k === 'string') as AssetColumnKey[];
          if (next.length) setAssetColumnOrder((prev) => {
            const all = new Set<AssetColumnKey>(prev);
            const dedup = next.filter((k) => all.has(k));
            const missing = prev.filter((k) => !dedup.includes(k));
            return [...dedup, ...missing];
          });
        }
      }
    } catch {}
  }, [id, currentUserId]);

  useEffect(() => {
    if (!id) return;
    const key = `spfit_masterlist_asset_columns_${currentUserId}_${id}`;
    const lastKey = `spfit_masterlist_asset_columns_last_${currentUserId}`;
    try {
      localStorage.setItem(key, JSON.stringify(assetColumns));
      localStorage.setItem(lastKey, JSON.stringify(assetColumns));
    } catch {}
  }, [id, currentUserId, assetColumns]);

  useEffect(() => {
    if (!id) return;
    const key = `spfit_masterlist_asset_columns_order_${currentUserId}_${id}`;
    const lastKey = `spfit_masterlist_asset_columns_order_last_${currentUserId}`;
    try {
      localStorage.setItem(key, JSON.stringify(assetColumnOrder));
      localStorage.setItem(lastKey, JSON.stringify(assetColumnOrder));
    } catch {}
  }, [id, currentUserId, assetColumnOrder]);

  const statusOptions = useMemo(() => ['ALL', ...Object.values(AssetStatus)], []);

  const getColumnSortKey = (key: AssetColumnKey): string => {
    const map: Partial<Record<AssetColumnKey, string>> = {
      name: 'name',
      asset_tag: 'tag',
      serial_number: 'serial',
      status: 'status',
      brand_model: 'brand',
      category: 'category',
      updated_at: 'updated',
    };
    return map[key] || key;
  };

  const handleHeaderClick = (key: AssetColumnKey) => {
    const sortKey = getColumnSortKey(key);
    const asc = sortKey + '_asc';
    const desc = sortKey + '_desc';
    if (assetSortBy === asc) {
      setAssetSortBy(desc);
    } else if (assetSortBy === desc) {
      setAssetSortBy(null);
    } else {
      setAssetSortBy(asc);
    }
  };

  const filteredAssets = useMemo(() => {
    const search = debouncedAssetSearch.toLowerCase();
    const statusFilter = assetStatusFilter;
    let rows = assets;

    if (search) {
      rows = rows.filter((asset) => {
        const haystack = [
          asset.asset_tag,
          asset.name,
          asset.brand,
          asset.model,
          asset.serial_number,
          asset.status,
          asset.category
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(search);
      });
    }

    if (statusFilter !== 'ALL') {
      rows = rows.filter((asset) => asset.status === statusFilter);
    }

    const sorted = [...rows];
    const compare = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' });

    sorted.sort((a, b) => {
      if (assetSortBy === 'name_asc') return compare(a.name || '', b.name || '');
      if (assetSortBy === 'name_desc') return compare(b.name || '', a.name || '');
      if (assetSortBy === 'tag_asc') return compare(a.asset_tag || '', b.asset_tag || '');
      if (assetSortBy === 'tag_desc') return compare(b.asset_tag || '', a.asset_tag || '');
      if (assetSortBy === 'serial_asc') return compare(a.serial_number || '', b.serial_number || '');
      if (assetSortBy === 'serial_desc') return compare(b.serial_number || '', a.serial_number || '');
      if (assetSortBy === 'status_asc') return compare(a.status || '', b.status || '');
      if (assetSortBy === 'status_desc') return compare(b.status || '', a.status || '');
      if (assetSortBy === 'brand_asc') return compare(a.brand || '', b.brand || '');
      if (assetSortBy === 'brand_desc') return compare(b.brand || '', a.brand || '');
      if (assetSortBy === 'category_asc') return compare(a.category || '', b.category || '');
      if (assetSortBy === 'category_desc') return compare(b.category || '', a.category || '');
      if (assetSortBy === 'updated_asc') return compare(a.updated_at || '', b.updated_at || '');
      if (assetSortBy === 'updated_desc') return compare(b.updated_at || '', a.updated_at || '');
      return 0;
    });
    return sorted;
  }, [assets, debouncedAssetSearch, assetStatusFilter, assetSortBy]);

  useEffect(() => {
    const fetchMasterlist = async () => {
      if (!id) return;
      setMasterlistLoading(true);
      setMasterlistError(null);
      try {
        const response = await masterlistsApi.getById(Number(id), { include_assets: false });
        if (!response?.success || !response?.data) {
          setMasterlistError(response?.error || 'Gagal memuatkan masterlist.');
          setMasterlist(null);
          return;
        }
        setMasterlist(response.data as Masterlist);
      } catch {
        setMasterlistError('Ralat semasa memuatkan masterlist.');
        setMasterlist(null);
      } finally {
        setMasterlistLoading(false);
      }
    };

    fetchMasterlist();
  }, [id]);

  useEffect(() => {
    const fetchAssets = async () => {
      if (!id) return;
      setAssetsLoading(true);
      setAssetsError(null);
      try {
        const response = await assetsApi.getAll(page, limit, {
          masterlist_id: Number(id),
          sortBy: 'created_at',
          sort: 'desc'
        });
        if (!response?.success || !response?.data) {
          setAssetsError(response?.error || 'Gagal memuatkan aset.');
          setAssets([]);
          setTotal(0);
          setTotalPages(1);
          return;
        }
        const data = response.data as any;
        const rows = Array.isArray(data.assets) ? (data.assets as Asset[]) : [];
        const pagination = data.pagination || {};
        const nextTotal = Number(pagination.total || 0);
        const nextPages = Number(pagination.totalPages || 1);
        setAssets(rows);
        setTotal(nextTotal);
        setTotalPages(nextPages);
        if (page > nextPages) setPage(Math.max(nextPages, 1));
      } catch {
        setAssetsError('Ralat semasa memuatkan aset.');
        setAssets([]);
        setTotal(0);
        setTotalPages(1);
      } finally {
        setAssetsLoading(false);
      }
    };

    fetchAssets();
  }, [id, page, limit, assetsReloadKey]);

  const confirmDeleteWorkItem = async () => {
    if (!masterlist || !pendingDelete || deletingWorkItem) return;
    setDeletingWorkItem(true);
    try {
      const response =
        pendingDelete.kind === 'link'
          ? await masterlistsApi.deleteWorkLink(masterlist.id, pendingDelete.index)
          : await masterlistsApi.deleteWorkDocument(masterlist.id, pendingDelete.index);

      if (!response?.success || !response?.data) {
        showToast((response as any)?.error || response?.message || 'Gagal memadam item.', 'error');
        return;
      }
      setMasterlist(response.data as Masterlist);
      showToast(response.message || 'Berjaya dipadam.', 'success');
      setPendingDelete(null);
    } catch (error: any) {
      showToast(error?.response?.data?.message || 'Gagal memadam item.', 'error');
    } finally {
      setDeletingWorkItem(false);
    }
  };

  const visibleColumnKeys = assetColumnOrder.filter((k) => assetColumns[k]);
  const colCount = visibleColumnKeys.length;

  const columnLabels: Record<AssetColumnKey, string> = {
    asset_tag: 'Tag',
    name: 'Nama',
    category: 'Kategori',
    brand_model: 'Jenama / Model',
    serial_number: 'Serial Number',
    status: 'Status',
    attachments: 'Lihat Fail',
    updated_at: 'Dikemaskini',
    updated_by: 'Pengemaskini'
  };

  const moveColumn = (from: AssetColumnKey, to: AssetColumnKey) => {
    if (from === to) return;
    setAssetColumnOrder((prev) => {
      const fromIndex = prev.indexOf(from);
      const toIndex = prev.indexOf(to);
      if (fromIndex < 0 || toIndex < 0) return prev;
      const next = [...prev];
      next.splice(fromIndex, 1);
      next.splice(toIndex, 0, from);
      return next;
    });
  };

  const escapeCsv = (value: string): string => {
    if (!value) return '';
    const v = String(value).replace(/"/g, '""');
    return /[,"\n\r]/.test(v) ? `"${v}"` : v;
  };

  const handleExport = async () => {
    if (!id || !masterlist) return;
    setExportLoading(true);
    try {
      const response = await masterlistsApi.exportData(Number(id));
      if (!response?.success || !response?.data) {
        showToast(response?.error || 'Gagal mengeksport data.', 'error');
        return;
      }

      const data = response.data as any;
      const assets = Array.isArray(data.assets) ? data.assets : [];
      const ml = data.masterlist || {};

      const headers: string[] = [];
      let hasUserCols = false;
      let hasAccCols = false;

      if (exportOptions.masterlist) {
        headers.push('Kod Masterlist', 'Nama Masterlist', 'Status Masterlist');
      }
      if (exportOptions.project) {
        headers.push('Kod Projek', 'Nama Projek');
      }
      if (exportOptions.asset) {
        headers.push('Asset Tag', 'Nama Aset', 'Serial Number', 'Jenama', 'Model', 'Kategori', 'Status Aset');
      }
      if (exportOptions.users) {
        headers.push('Nama Pengguna', 'Jawatan', 'Bahagian/Jabatan', 'Tingkat', 'Bangunan', 'Lokasi/Bilik', 'Cawangan', 'Negeri');
        hasUserCols = true;
      }
      if (exportOptions.accessories) {
        headers.push('Monitor (SN)', 'Monitor (Nama)', 'Papan Kekunci (SN)', 'Papan Kekunci (Nama)', 'Tetikus (SN)', 'Tetikus (Nama)');
        hasAccCols = true;
      }

      const rows: string[][] = [];

      if (assets.length === 0) {
        const emptyRow = headers.map(() => '');
        if (exportOptions.masterlist) {
          rows.push([
            escapeCsv(ml.code || ''),
            escapeCsv(ml.name || ''),
            escapeCsv(ml.status || '')
          ]);
        }
      } else {
        assets.forEach((row: any) => {
          const users: any[] = Array.isArray(row.users) && row.users.length > 0 ? row.users : [{}];
          const accs: any[] = Array.isArray(row.accessories) && row.accessories.length > 0 ? row.accessories : [{}];

          const maxLen = Math.max(1, users.length, accs.length);
          for (let i = 0; i < maxLen; i++) {
            const user = users[i] || {};
            const acc = accs[i] || {};

            const cells: string[] = [];
            if (exportOptions.masterlist) {
              cells.push(escapeCsv(row.masterlist_code || ml.code || ''));
              cells.push(escapeCsv(row.masterlist_name || ml.name || ''));
              cells.push(escapeCsv(row.masterlist_status || ml.status || ''));
            }
            if (exportOptions.project) {
              cells.push(escapeCsv(row.project_code || ''));
              cells.push(escapeCsv(row.project_name || ''));
            }
            if (exportOptions.asset) {
              cells.push(escapeCsv(row.asset_tag || ''));
              cells.push(escapeCsv(row.asset_name || ''));
              cells.push(escapeCsv(row.serial_number || ''));
              cells.push(escapeCsv(row.brand || ''));
              cells.push(escapeCsv(row.model || ''));
              cells.push(escapeCsv(row.category || ''));
              cells.push(escapeCsv(row.status || ''));
            }
            if (exportOptions.users) {
              cells.push(escapeCsv(user.user_name || ''));
              cells.push(escapeCsv(user.position || ''));
              cells.push(escapeCsv(user.department || ''));
              cells.push(escapeCsv(user.floor || ''));
              cells.push(escapeCsv(user.building || ''));
              cells.push(escapeCsv(user.location || ''));
              cells.push(escapeCsv(user.branch || ''));
              cells.push(escapeCsv(user.state || ''));
            }
            if (exportOptions.accessories) {
              const monitor = (row.accessories || []).find((a: any) => a.accessory_type === 'monitor');
              const keyboard = (row.accessories || []).find((a: any) => a.accessory_type === 'keyboard');
              const mouse = (row.accessories || []).find((a: any) => a.accessory_type === 'mouse');
              cells.push(escapeCsv(monitor?.serial_number || ''));
              cells.push(escapeCsv(monitor?.name || ''));
              cells.push(escapeCsv(keyboard?.serial_number || ''));
              cells.push(escapeCsv(keyboard?.name || ''));
              cells.push(escapeCsv(mouse?.serial_number || ''));
              cells.push(escapeCsv(mouse?.name || ''));
            }
            rows.push(cells);
          }
        });
      }

      if (exportFormat === 'csv') {
        const bom = '\uFEFF';
        const headerRow = headers.map((h) => escapeCsv(h)).join(',');
        const dataRows = rows.map((r) => r.join(','));
        const csvContent = bom + [headerRow, ...dataRows].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${escapeCsv(ml.code || 'masterlist')}_eksport.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        const XLSX = await import('xlsx');
        const sheetData: string[][] = [headers, ...rows];
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Masterlist');
        const xlsxContent = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
        const blob = new Blob([xlsxContent], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${escapeCsv(ml.code || 'masterlist')}_eksport.xlsx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }

      setShowExportDialog(false);
      showToast('Data masterlist berjaya dieksport.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Ralat semasa mengeksport data.', 'error');
    } finally {
      setExportLoading(false);
    }
  };

  if (!id) return null;
  if (masterlistLoading) return <div className="bg-white rounded-lg shadow-md p-6">Memuatkan masterlist...</div>;
  if (masterlistError || !masterlist) return <div className="bg-white rounded-lg shadow-md p-6 text-red-700">{masterlistError || 'Masterlist tidak dijumpai.'}</div>;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">{masterlist.code} - {masterlist.name}</h2>
            <p className="text-sm text-gray-600 mt-1">{masterlist.project ? `${masterlist.project.code} - ${masterlist.project.name}` : ''}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => navigate(`/masterlists/${masterlist.id}/edit`)}>Edit</Button>
            <Button variant="secondary" onClick={() => setShowExportDialog(true)}>Eksport</Button>
            <Button variant="secondary" onClick={() => navigate('/masterlists')}>Kembali</Button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-lg border border-gray-200 p-4">
              <div className="text-base font-semibold text-gray-800">Link Kerja</div>
              <div className="mt-3 space-y-2">
                {(masterlist.work_links || []).length === 0 ? (
                  <div className="text-sm text-gray-600">Tiada link.</div>
                ) : (
                  (masterlist.work_links || []).map((link, idx) => (
                    <div key={`${idx}-${link.url}`} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-md border border-gray-200 px-3 py-2">
                      <a className="text-sm text-indigo-700 hover:underline truncate" href={link.url} target="_blank" rel="noreferrer">
                        {link.title || link.url}
                      </a>
                      {canDeleteWorkItems && (
                        <Button size="sm" variant="danger" onClick={() => setPendingDelete({ kind: 'link', index: idx })}>
                          Padam
                        </Button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 p-4">
              <div className="text-base font-semibold text-gray-800">Dokumen Kerja</div>
              <div className="mt-3 space-y-2">
                {(masterlist.work_documents || []).length === 0 ? (
                  <div className="text-sm text-gray-600">Tiada dokumen.</div>
                ) : (
                  (masterlist.work_documents || []).map((doc, idx) => (
                    <div key={`${idx}-${doc.file_path}`} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-md border border-gray-200 px-3 py-2">
                      <a className="text-sm text-indigo-700 hover:underline truncate" href={`/${doc.file_path}`} target="_blank" rel="noreferrer">
                        {doc.title || doc.file_name}
                      </a>
                      <div className="flex gap-2">
                        <Button size="sm" variant="secondary" onClick={() => window.open(`/${doc.file_path}`, '_blank')}>Buka</Button>
                        {canDeleteWorkItems && (
                          <Button size="sm" variant="danger" onClick={() => setPendingDelete({ kind: 'document', index: idx })}>
                            Padam
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-gray-800">Aset</h3>
            <Button variant="secondary" onClick={() => setColumnsOpen((v) => !v)}>Kolum</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => navigate(`/assets/create?masterlistId=${masterlist.id}`)}>Tambah Aset</Button>
            <Button variant="secondary" onClick={() => setIsImportModalOpen(true)}>Import Aset</Button>
            <Button variant="secondary" onClick={() => setIsScanModalOpen(true)}>Scan Aset</Button>
          </div>
        </div>

        {columnsOpen && (
          <div className="px-6 py-4 border-b bg-gray-50">
            <div className="text-xs text-gray-600 mb-3">Seret untuk susun semula urutan kolum.</div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
              {assetColumnOrder.map((key) => (
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
                    const from = (e.dataTransfer.getData('text/plain') as AssetColumnKey) || draggingColumn;
                    if (from) moveColumn(from, key);
                    setDraggingColumn(null);
                  }}
                >
                  <span className="cursor-move select-none text-gray-400">⋮⋮</span>
                  <input
                    type="checkbox"
                    checked={assetColumns[key]}
                    onChange={(e) => setAssetColumns((prev) => ({ ...prev, [key]: e.target.checked }))}
                  />
                  <span className="text-gray-700">{columnLabels[key]}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div ref={assetsTopRef} />
        <div className="px-6 py-4 border-b bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <Input
              type="search"
              label="Cari Aset"
              value={assetSearch}
              onChange={(e) => {
                setAssetSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Cari tag, nama, kategori, jenama, model, serial, perkakasan"
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Filter Status</label>
              <select
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                value={assetStatusFilter}
                onChange={(e) => {
                  setAssetStatusFilter(e.target.value);
                  setPage(1);
                }}
              >
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status === 'ALL' ? 'Semua Status' : status}
                  </option>
                ))}
              </select>
            </div>

            <div className="text-sm text-gray-600 md:text-right">
              {total > 0
                ? `Menunjukkan ${((page - 1) * limit) + 1} hingga ${Math.min(page * limit, total)} daripada ${total} aset`
                : 'Tiada aset ditemui'}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          {assetsError && (
            <div className="px-6 py-3 bg-red-50 border-b border-red-200 text-sm text-red-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <span>{assetsError}</span>
              <Button size="sm" variant="secondary" onClick={() => setAssetsReloadKey((v) => v + 1)}>
                Cuba Lagi
              </Button>
            </div>
          )}

          <div className={`transition-opacity duration-200 ${assetsLoading ? 'opacity-60' : 'opacity-100'}`}>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {visibleColumnKeys.map((key) => {
                    const sortKey = getColumnSortKey(key);
                    const isAsc = assetSortBy === `${sortKey}_asc`;
                    const isDesc = assetSortBy === `${sortKey}_desc`;
                    const isActive = isAsc || isDesc;
                    return (
                      <th
                        key={key}
                        className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer select-none ${
                          isActive ? 'text-blue-700' : 'text-gray-500'
                        }`}
                        onClick={() => handleHeaderClick(key)}
                      >
                        <span className="inline-flex items-center gap-1">
                          {columnLabels[key]}
                          {isAsc && <span className="text-xs">&#9650;</span>}
                          {isDesc && <span className="text-xs">&#9660;</span>}
                        </span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {assetsLoading && assets.length === 0 ? (
                  <tr>
                    <td colSpan={Math.max(colCount, 1)} className="px-6 py-10 text-center text-sm text-gray-500">
                      Memuatkan aset...
                    </td>
                  </tr>
                ) : filteredAssets.length === 0 ? (
                  <tr>
                    <td colSpan={Math.max(colCount, 1)} className="px-6 py-10 text-center text-sm text-gray-500">
                      Tiada aset.
                    </td>
                  </tr>
                ) : (
                  filteredAssets.map((asset) => (
                    <tr
                      key={asset.id}
                      className="hover:bg-blue-50 cursor-pointer"
                      onClick={() => navigate(`/assets/${asset.id}`)}
                      tabIndex={0}
                      role="button"
                      aria-label={`Lihat aset ${asset.name}`}
                    >
                      {visibleColumnKeys.map((key) => {
                        if (key === 'asset_tag') return <td key={key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{asset.asset_tag || '-'}</td>;
                        if (key === 'name') return <td key={key} className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800">{asset.name}</td>;
                        if (key === 'category') return <td key={key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{asset.category || asset.categoryOption?.name || '-'}</td>;
                        if (key === 'brand_model') return <td key={key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{asset.brand || asset.brandOption?.name || '-'} / {asset.model || '-'}</td>;
                        if (key === 'serial_number') return <td key={key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{asset.serial_number || '-'}</td>;
                        if (key === 'status') return <td key={key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{asset.status}</td>;
                        if (key === 'attachments') return (
                          <td key={key} className="px-6 py-4 text-sm text-gray-700" onClick={(e) => e.stopPropagation()}>
                            {asset.attachments && asset.attachments.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {asset.attachments.map((att) => (
                                  <a
                                    key={att.id}
                                    href={att.file_path}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-900 text-xs bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded"
                                    title={`${att.display_name || att.file_name}${att.file_size ? ` (${(att.file_size / 1024).toFixed(1)} KB)` : ''}`}
                                  >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                    {att.display_name || att.file_name}
                                  </a>
                                ))}
                              </div>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                        );
                        if (key === 'updated_at') return (
                          <td key={key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                            {asset.updated_at ? new Date(asset.updated_at).toLocaleString('ms-MY', { dateStyle: 'medium', timeStyle: 'short' }) : '-'}
                          </td>
                        );
                        if (key === 'updated_by') return (
                          <td key={key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                            {asset.updater?.name || (asset.updated_by ? `ID ${asset.updated_by}` : '-')}
                          </td>
                        );
                        return <td key={key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">-</td>;
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {total > 0 && (
          <div className="px-6 py-4 border-t flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="text-sm text-gray-600">
                Menunjukkan {((page - 1) * limit) + 1} hingga {Math.min(page * limit, total)} daripada {total} aset
              </div>
              <select
                value={limit}
                onChange={(e) => {
                  const nextLimit = Number(e.target.value);
                  const currentIndex = (page - 1) * limit;
                  const nextPage = Math.floor(currentIndex / nextLimit) + 1;
                  setLimit(nextLimit);
                  setPage(nextPage);
                }}
                className="text-sm border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value={10}>10 / halaman</option>
                <option value={20}>20 / halaman</option>
                <option value={50}>50 / halaman</option>
                <option value={100}>100 / halaman</option>
              </select>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={page === 1 || assetsLoading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Sebelumnya
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={page >= totalPages || assetsLoading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Seterusnya
              </Button>
            </div>
          </div>
        )}
      </div>

      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white shadow-lg">
            <div className="px-5 py-4 border-b">
              <div className="text-base font-semibold text-gray-900">Sahkan Penghapusan</div>
              <div className="mt-1 text-sm text-gray-600">Anda pasti mahu memadam item ini? Tindakan ini tidak boleh dipulihkan.</div>
            </div>
            <div className="px-5 py-4 flex justify-end gap-2">
              <Button variant="secondary" disabled={deletingWorkItem} onClick={() => setPendingDelete(null)}>Batal</Button>
              <Button variant="danger" disabled={deletingWorkItem || !canDeleteWorkItems} onClick={confirmDeleteWorkItem}>
                {deletingWorkItem ? 'Memadam...' : 'Padam'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <AssetImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        masterlistId={masterlist.id}
        onImportSuccess={() => {
          setIsImportModalOpen(false);
          setAssetsReloadKey((v) => v + 1);
        }}
      />

      <AssetScanModal
        isOpen={isScanModalOpen}
        onClose={() => setIsScanModalOpen(false)}
        masterlistId={masterlist.id}
        onScanSuccess={() => {
          setIsScanModalOpen(false);
          setAssetsReloadKey((v) => v + 1);
        }}
      />

      {showExportDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white shadow-lg">
            <div className="px-5 py-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Eksport Masterlist</h3>
              <p className="text-sm text-gray-600 mt-1">
                Pilih butiran yang ingin disertakan dalam fail eksport. Setiap rekod aset akan disusun dalam baris berasingan.
              </p>
            </div>
            <div className="px-5 py-4 space-y-3">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={exportOptions.masterlist}
                  onChange={(e) => setExportOptions((prev) => ({ ...prev, masterlist: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <span className="text-sm font-medium text-gray-800">Maklumat Masterlist</span>
                  <span className="ml-2 text-xs text-gray-500">Kod, Nama, Status</span>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={exportOptions.project}
                  onChange={(e) => setExportOptions((prev) => ({ ...prev, project: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <span className="text-sm font-medium text-gray-800">Maklumat Projek</span>
                  <span className="ml-2 text-xs text-gray-500">Kod Projek, Nama Projek</span>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={exportOptions.asset}
                  onChange={(e) => setExportOptions((prev) => ({ ...prev, asset: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <span className="text-sm font-medium text-gray-800">Maklumat Aset</span>
                  <span className="ml-2 text-xs text-gray-500">Tag, Nama, Serial, Jenama, Model, Kategori, Status</span>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={exportOptions.users}
                  onChange={(e) => setExportOptions((prev) => ({ ...prev, users: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <span className="text-sm font-medium text-gray-800">Butiran Pengguna</span>
                  <span className="ml-2 text-xs text-gray-500">Nama, Jawatan, Jabatan, Tingkat, Bangunan, Lokasi, Cawangan, Negeri</span>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={exportOptions.accessories}
                  onChange={(e) => setExportOptions((prev) => ({ ...prev, accessories: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <span className="text-sm font-medium text-gray-800">Item Berpasangan (Aksesori)</span>
                  <span className="ml-2 text-xs text-gray-500">Monitor, Papan Kekunci, Tetikus (Serial & Nama)</span>
                </div>
              </label>
            </div>
            <div className="px-5 py-3 border-t">
              <label className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-700 whitespace-nowrap">Jenis Fail:</span>
                <select
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value as 'csv' | 'xlsx')}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                >
                  <option value="csv">CSV (.csv)</option>
                  <option value="xlsx">Excel (.xlsx)</option>
                </select>
              </label>
            </div>
            <div className="px-5 py-4 border-t flex justify-end gap-2">
              <Button variant="secondary" disabled={exportLoading} onClick={() => setShowExportDialog(false)}>Batal</Button>
              <Button onClick={handleExport} disabled={exportLoading}>
                {exportLoading ? 'Mengeksport...' : `Eksport ${exportFormat === 'csv' ? 'CSV' : 'Excel'}`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
