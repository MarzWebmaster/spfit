import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Badge } from '../ui/Badge';
import type { AssetUpdater, AssetUpdateLogEntry } from '../../types';
import { assetReportsApi } from '../../services/api';

interface AssetUpdatersReportPageProps {
  onBack: () => void;
}

const periodOptions = [
  { value: '', label: 'Julat Tersuai' },
  { value: 'daily', label: 'Harian' },
  { value: 'weekly', label: 'Mingguan' },
  { value: 'monthly', label: 'Bulanan' },
  { value: 'quarterly', label: 'Suku Tahunan' },
  { value: 'yearly', label: 'Tahunan' },
];

const actionTypeOptions = [
  { value: '', label: 'Semua Tindakan' },
  { value: 'CREATE', label: 'Cipta' },
  { value: 'UPDATE', label: 'Kemaskini' },
  { value: 'STATUS_CHANGE', label: 'Tukar Status' },
  { value: 'DELETE', label: 'Padam' },
];

const statusOptions = [
  { value: '', label: 'Semua Status' },
  { value: 'Aktif', label: 'Aktif' },
  { value: 'Tidak Aktif', label: 'Tidak Aktif' },
  { value: 'Rosak', label: 'Rosak' },
  { value: 'Lupus', label: 'Lupus' },
];

export const AssetUpdatersReportPage: React.FC<AssetUpdatersReportPageProps> = ({ onBack }) => {
  const [topUpdaters, setTopUpdaters] = useState<AssetUpdater[]>([]);
  const [updateLogs, setUpdateLogs] = useState<AssetUpdateLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'ranking' | 'logs'>('ranking');
  const [logsPagination, setLogsPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });

  const [filters, setFilters] = useState({
    period: '',
    start_date: '',
    end_date: '',
    action_type: '',
    status: '',
  });

  const fetchTopUpdaters = useCallback(async () => {
    setLoading(true);
    try {
      const response = await assetReportsApi.getTopUpdaters({
        period: filters.period || undefined,
        start_date: filters.start_date || undefined,
        end_date: filters.end_date || undefined,
        action_type: filters.action_type || undefined,
        status: filters.status || undefined,
        limit: 50,
      });
      if (response.success && response.data) {
        setTopUpdaters((response.data as any).topUpdaters || []);
      }
    } catch (error) {
      console.error('Error fetching top updaters:', error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const fetchUpdateLogs = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const response = await assetReportsApi.getUpdateLogs({
        page,
        limit: logsPagination.limit,
        period: filters.period || undefined,
        start_date: filters.start_date || undefined,
        end_date: filters.end_date || undefined,
        action_type: filters.action_type || undefined,
        status: filters.status || undefined,
      });
      if (response.success && response.data) {
        setUpdateLogs((response.data as any).logs || []);
        setLogsPagination(prev => ({
          ...prev,
          ...(response.data as any).pagination,
        }));
      }
    } catch (error) {
      console.error('Error fetching update logs:', error);
    } finally {
      setLoading(false);
    }
  }, [filters, logsPagination.limit]);

  useEffect(() => {
    if (viewMode === 'ranking') {
      fetchTopUpdaters();
    } else {
      fetchUpdateLogs(1);
    }
  }, [viewMode, fetchTopUpdaters, fetchUpdateLogs]);

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFilters(prev => ({ ...prev, [e.target.id]: e.target.value }));
  };

  const handleApplyFilters = () => {
    if (viewMode === 'ranking') {
      fetchTopUpdaters();
    } else {
      fetchUpdateLogs(1);
    }
  };

  const getActionBadgeColor = (action: string) => {
    switch (action) {
      case 'CREATE': return 'bg-green-100 text-green-800 border-green-300';
      case 'UPDATE': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'STATUS_CHANGE': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'DELETE': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('ms-MY', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const getMedalIcon = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return '';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Laporan Pengemaskini Aset Teratas</h2>
          <p className="mt-1 text-sm text-gray-600">
            Jejaki pengguna yang paling banyak membuat kemaskini aset dengan pelbagai penapis.
          </p>
        </div>
        <Button variant="secondary" onClick={onBack}>Kembali ke Hab Laporan</Button>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-md space-y-4">
        <div className="flex items-center gap-4">
          <Button
            variant={viewMode === 'ranking' ? 'primary' : 'secondary'}
            onClick={() => setViewMode('ranking')}
            style={{ minWidth: '160px' }}
          >
            Kedudukan Pengemaskini
          </Button>
          <Button
            variant={viewMode === 'logs' ? 'primary' : 'secondary'}
            onClick={() => setViewMode('logs')}
            style={{ minWidth: '160px' }}
          >
            Log Kemaskini
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Select label="Tempoh Masa" id="period" value={filters.period} onChange={handleFilterChange}>
            {periodOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
          <Input label="Tarikh Mula" id="start_date" type="date" value={filters.start_date} onChange={handleFilterChange} />
          <Input label="Tarikh Akhir" id="end_date" type="date" value={filters.end_date} onChange={handleFilterChange} />
          <Select label="Jenis Tindakan" id="action_type" value={filters.action_type} onChange={handleFilterChange}>
            {actionTypeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
          <Select label="Status Aset" id="status" value={filters.status} onChange={handleFilterChange}>
            {statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </div>

        <div className="flex justify-end">
          <Button variant="primary" onClick={handleApplyFilters} disabled={loading}>
            {loading ? 'Memuatkan...' : 'Guna Penapis'}
          </Button>
        </div>
      </div>

      {loading && (
        <div className="text-center py-8 text-gray-500">Memuatkan data...</div>
      )}

      {!loading && viewMode === 'ranking' && (
        <>
          <div className="bg-white p-4 rounded-lg shadow-md">
            <h3 className="font-semibold mb-4">Kedudukan Pengguna Mengikut Jumlah Kemaskini</h3>
            {topUpdaters.length === 0 ? (
              <p className="text-center text-gray-500 py-6">Tiada data ditemui untuk penapis semasa.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pengguna</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Jumlah Kemaskini</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kemaskini Terakhir</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {topUpdaters.map((updater, index) => (
                      <tr key={updater.user_id} className={`hover:bg-gray-50 ${index < 3 ? 'bg-indigo-50' : ''}`}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-lg">{getMedalIcon(index + 1)}</span>
                          <span className="text-sm font-bold text-gray-700 ml-1">{index + 1}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-semibold text-gray-900">{updater.user_name}</span>
                          <span className="text-xs text-gray-500 ml-2">ID: {updater.user_id}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <span className={`text-sm font-bold px-3 py-1 rounded-full ${index === 0 ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-100 text-gray-800'}`}>
                            {updater.update_count}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(updater.last_update)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {topUpdaters.length > 0 && (
            <div className="bg-white p-4 rounded-lg shadow-md">
              <h3 className="font-semibold mb-4">Carta Bar - Kemaskini Aset Teratas</h3>
              <div className="flex justify-around items-end h-48 p-4 bg-gray-50 rounded-lg">
                {topUpdaters.slice(0, 10).map((updater, idx) => {
                  const maxCount = topUpdaters[0]?.update_count || 1;
                  const heightPct = (updater.update_count / maxCount) * 100;
                  const colors = ['#818cf8', '#60a5fa', '#4ade80', '#facc15', '#f97316', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#a855f7'];
                  return (
                    <div key={updater.user_id} className="flex flex-col items-center w-[10%] min-w-[40px]">
                      <div
                        className="w-full rounded-t-md transition-all"
                        style={{ height: `${heightPct}%`, backgroundColor: colors[idx % colors.length] }}
                        title={`${updater.user_name}: ${updater.update_count}`}
                      />
                      <div className="text-xs text-center mt-2 text-gray-600 font-medium truncate max-w-full">
                        {updater.user_name.length > 10 ? updater.user_name.substring(0, 10) + '...' : updater.user_name}
                      </div>
                      <div className="text-xs text-gray-500">{updater.update_count}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {!loading && viewMode === 'logs' && (
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <h3 className="font-semibold p-4 border-b">Log Kemaskini Aset</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tarikh</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pengguna</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aset</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Masterlist / Projek</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tindakan</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {updateLogs.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(log.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {log.user?.name || `ID: ${log.user?.id}` || 'Sistem'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900">{log.asset?.name}</span>
                      {log.asset?.asset_tag && (
                        <span className="text-xs text-gray-500 ml-1">[{log.asset.asset_tag}]</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {log.asset?.masterlist ? (
                        <>
                          <span>{log.asset.masterlist.code || log.asset.masterlist.name}</span>
                          {log.asset.masterlist.project && (
                            <span className="text-xs text-gray-400 ml-1">
                              ({log.asset.masterlist.project.code || log.asset.masterlist.project.name})
                            </span>
                          )}
                        </>
                      ) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-xs font-medium px-2 py-1 rounded border ${getActionBadgeColor(log.action_type)}`}>
                        {log.action_type}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {updateLogs.length === 0 && (
            <p className="text-center text-gray-500 p-6">Tiada log ditemui untuk penapis semasa.</p>
          )}
          {logsPagination.totalPages > 1 && (
            <div className="flex justify-between items-center p-4 border-t">
              <span className="text-sm text-gray-500">
                Jumlah: {logsPagination.total} rekod
              </span>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => fetchUpdateLogs(logsPagination.page - 1)}
                  disabled={logsPagination.page <= 1}
                >
                  Sebelum
                </Button>
                <span className="text-sm text-gray-600 self-center">
                  {logsPagination.page} / {logsPagination.totalPages}
                </span>
                <Button
                  variant="secondary"
                  onClick={() => fetchUpdateLogs(logsPagination.page + 1)}
                  disabled={logsPagination.page >= logsPagination.totalPages}
                >
                  Seterusnya
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
