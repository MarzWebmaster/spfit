import React, { useEffect, useState } from 'react';
import { systemApi } from '../../services/api';
import { ChevronLeft, Search, RefreshCw } from 'lucide-react';

const WhatsAppDeliveryTab: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [to, setTo] = useState('');
  const [status, setStatus] = useState('');
  const [correlationId, setCorrelationId] = useState('');
  const [search, setSearch] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: 50 };
      if (to) params.to = to;
      if (status) params.status = status;
      if (correlationId) params.correlationId = correlationId;
      if (search) params.search = search;
      const res = await fetch(`/api/delivery?` + new URLSearchParams(params));
      const json = await res.json();
      if (json.success) {
        setLogs(json.data.logs);
        setTotalPages(json.data.pagination.totalPages);
        setTotal(json.data.pagination.total);
      }
    } catch (e) {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLogs(); }, [page, to, status, correlationId]);

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <h2 className="text-2xl font-bold text-gray-800">Pemantauan Penghantaran WhatsApp</h2>
      </div>
      <div className="bg-white p-4 rounded-lg shadow border border-gray-200 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">No. Telefon</label>
            <input className="w-full border rounded p-2" value={to} onChange={e => setTo(e.target.value)} placeholder="+60123456789" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select className="w-full border rounded p-2" value={status} onChange={e => setStatus(e.target.value)}>
              <option value="">Semua</option>
              <option value="queued">Queued</option>
              <option value="sending">Sending</option>
              <option value="sent">Sent</option>
              <option value="delivered">Delivered</option>
              <option value="failed">Failed</option>
              <option value="expired">Expired</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Correlation ID</label>
            <input className="w-full border rounded p-2" value={correlationId} onChange={e => setCorrelationId(e.target.value)} placeholder="TX-..." />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Carian</label>
            <div className="flex">
              <input className="w-full border rounded-l p-2" value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari mesej / ralat" />
              <button className="px-4 bg-purple-600 text-white rounded-r" onClick={fetchLogs}><Search className="h-4 w-4" /></button>
            </div>
          </div>
        </div>
      </div>
      <div className="bg-white shadow rounded border">
        {loading ? (
          <div className="p-8 text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-purple-500 mb-2" />
            <p className="text-gray-500">Memuatkan data...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tarikh</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">To</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Attempts</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Message</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Error</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {logs.map((r) => (
                  <tr key={r.id}>
                    <td className="px-6 py-4 text-sm text-gray-500">{new Date(r.queued_at).toLocaleString('ms-MY')}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{r.to}</td>
                    <td className="px-6 py-4 text-sm">{r.status}</td>
                    <td className="px-6 py-4 text-sm">{r.attempts}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 truncate max-w-xs">{r.message}</td>
                    <td className="px-6 py-4 text-sm text-red-600 truncate max-w-xs">{r.last_error || '-'}</td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr><td className="px-6 py-10 text-center text-gray-500" colSpan={6}>Tiada rekod.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex flex-wrap justify-between items-center gap-2 p-4">
          <div className="text-sm text-gray-600">Jumlah: {total}</div>
          <div className="flex flex-wrap items-center gap-2">
            <button className="px-3 py-1 border rounded" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>Sebelumnya</button>
            <span className="text-sm">Hal {page}/{totalPages}</span>
            <button className="px-3 py-1 border rounded" onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}>Seterusnya</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WhatsAppDeliveryTab;
