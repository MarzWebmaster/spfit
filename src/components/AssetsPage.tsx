import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Asset, Masterlist } from '../types';
import { AssetStatus } from '../types';
import { assetsApi, masterlistsApi } from '../services/api';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { AssetImportModal } from './AssetImportModal';

export const AssetsPage: React.FC = () => {
  const navigate = useNavigate();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [masterlists, setMasterlists] = useState<Masterlist[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [masterlistFilter, setMasterlistFilter] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const totalPages = useMemo(() => Math.max(Math.ceil(total / limit), 1), [total, limit]);

  const getBrandLabel = (asset: Asset) => asset.brand || asset.brandOption?.name || '-';

  const fetchMasterlists = async () => {
    try {
      const response = await masterlistsApi.getAll(1, 100, { sortBy: 'name', sort: 'asc' });
      if (!response.success || !response.data) return;

      const data = response.data as any;
      setMasterlists(Array.isArray(data.masterlists) ? data.masterlists : []);
    } catch {
      setMasterlists([]);
    }
  };

  const fetchAssets = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await assetsApi.getAll(page, limit, {
        q: query || undefined,
        status: statusFilter || undefined,
        masterlist_id: masterlistFilter ? Number(masterlistFilter) : undefined,
        sortBy: 'created_at',
        sort: 'desc'
      });

      if (!response.success || !response.data) {
        setError(response.error || 'Gagal memuatkan data aset.');
        return;
      }

      const data = response.data as any;
      const rows = Array.isArray(data.assets) ? data.assets : [];
      setAssets(rows);
      setTotal(Number(data.pagination?.total || rows.length));
    } catch {
      setError('Ralat semasa memuatkan data aset.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMasterlists();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchAssets();
    }, 250);

    return () => clearTimeout(timer);
  }, [page, query, statusFilter, masterlistFilter]);

  const handleDelete = async (asset: Asset) => {
    const confirmed = window.confirm(`Padam aset ${asset.asset_tag || asset.name}?`);
    if (!confirmed) return;

    setLoading(true);
    setError(null);

    try {
      const response = await assetsApi.delete(asset.id);
      if (!response.success) {
        setError(response.error || 'Gagal memadam aset.');
        return;
      }

      if (assets.length === 1 && page > 1) {
        setPage(page - 1);
      } else {
        await fetchAssets();
      }
    } catch {
      setError('Ralat semasa memadam aset.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white shadow-md rounded-lg overflow-hidden">
      <div className="p-4 sm:p-6 border-b">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Aset</h2>
            <p className="mt-1 text-sm text-gray-600">Senarai aset keseluruhan merentasi semua masterlist.</p>
          </div>
            <div className="flex gap-2">
              <Button onClick={() => navigate('/assets/create')}>Tambah Aset</Button>
              <Button onClick={() => setIsImportModalOpen(true)} variant="secondary">Import Aset</Button>
            </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <Input
            type="search"
            placeholder="Cari tag / nama / jenama / serial"
            value={query}
            onChange={(e) => {
              setPage(1);
              setQuery(e.target.value);
            }}
          />
          <Select
            options={[
              { label: 'Semua Masterlist', value: '' },
              ...masterlists.map((masterlist) => ({
                label: `${masterlist.code} - ${masterlist.name}`,
                value: masterlist.id
              }))
            ]}
            value={masterlistFilter}
            onChange={(e) => {
              setPage(1);
              setMasterlistFilter(e.target.value);
            }}
          />
          <Select
            options={[
              { label: 'Semua Status', value: '' },
              { label: AssetStatus.AKTIF, value: AssetStatus.AKTIF },
              { label: AssetStatus.TIDAK_AKTIF, value: AssetStatus.TIDAK_AKTIF },
              { label: AssetStatus.ROSAK, value: AssetStatus.ROSAK },
              { label: AssetStatus.LUPUS, value: AssetStatus.LUPUS }
            ]}
            value={statusFilter}
            onChange={(e) => {
              setPage(1);
              setStatusFilter(e.target.value);
            }}
          />
          <div className="flex items-end justify-end text-sm text-gray-600">
            Jumlah Aset: <span className="ml-1 font-semibold">{total}</span>
          </div>
        </div>
      </div>

        <AssetImportModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          masterlistId={masterlistFilter ? Number(masterlistFilter) : undefined}
          onImportSuccess={(mlId) => {
            setMasterlistFilter(mlId.toString());
            setPage(1);
          }}
        />

      {error && (
        <div className="mx-4 mt-4 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
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
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tag</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Masterlist</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Projek</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SN</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lampiran</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Tindakan</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {assets.map((asset) => (
              <tr key={asset.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <button
                    type="button"
                    onClick={() => navigate(`/assets/${asset.id}`)}
                    className="text-indigo-700 hover:text-indigo-900 hover:underline"
                  >
                    {asset.asset_tag || '-'}
                  </button>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800">
                  <button
                    type="button"
                    onClick={() => navigate(`/assets/${asset.id}`)}
                    className="text-left text-indigo-700 hover:text-indigo-900 hover:underline"
                  >
                    {asset.name}
                  </button>
                  <div className="text-xs text-gray-500">{getBrandLabel(asset)} / {asset.model || '-'}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{asset.masterlist ? `${asset.masterlist.code} - ${asset.masterlist.name}` : '-'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{asset.masterlist?.project ? `${asset.masterlist.project.code} - ${asset.masterlist.project.name}` : '-'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{asset.serial_number || '-'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                  {asset.attachments && asset.attachments.length > 0 ? (
                    <span className="inline-flex items-center gap-1 text-indigo-600">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                      {asset.attachments.length}
                    </span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{asset.status}</td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="secondary" onClick={() => navigate(`/assets/${asset.id}/edit`)}>Edit</Button>
                    <Button size="sm" variant="danger" onClick={() => handleDelete(asset)}>Padam</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!loading && assets.length === 0 && (
          <div className="p-8 text-center text-sm text-gray-500">Tiada data aset ditemui.</div>
        )}
      </div>

      <div className="px-4 py-3 border-t bg-gray-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="text-sm text-gray-600">Halaman {page} / {totalPages}</div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setPage((p) => Math.max(p - 1, 1))} disabled={page <= 1}>Sebelumnya</Button>
          <Button variant="secondary" size="sm" onClick={() => setPage((p) => Math.min(p + 1, totalPages))} disabled={page >= totalPages}>Seterusnya</Button>
        </div>
      </div>
    </div>
  );
};
