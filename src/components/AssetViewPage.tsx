import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Asset, AssetUpdateLogEntry } from '../types';
import { assetsApi } from '../services/api';
import { Button } from './ui/Button';
import { AssetUserForm } from './AssetUserForm';

export const AssetViewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [asset, setAsset] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAsset = async () => {
      if (!id) {
        setError('ID aset tidak sah.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await assetsApi.getById(Number(id));
        if (!response.success || !response.data) {
          setError(response.error || 'Gagal memuatkan aset.');
          return;
        }

        setAsset(response.data as Asset);
      } catch {
        setError('Ralat semasa memuatkan aset.');
      } finally {
        setLoading(false);
      }
    };

    fetchAsset();
  }, [id]);

  const handleUserAdded = async () => {
    // Reload asset to refresh user list
    if (id) {
      try {
        const response = await assetsApi.getById(Number(id));
        if (response.success && response.data) {
          setAsset(response.data as Asset);
        }
      } catch {
        // Silent fail, user can refresh if needed
      }
    }
  };

  if (loading) {
    return <div className="bg-white rounded-lg shadow-md p-6">Memuatkan paparan aset...</div>;
  }

  if (error || !asset) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <p className="text-red-700">{error || 'Aset tidak ditemui.'}</p>
        <div className="mt-4">
          <Button variant="secondary" onClick={() => navigate('/assets')}>Kembali ke Senarai</Button>
        </div>
      </div>
    );
  }

  const categoryLabel = asset.category || asset.categoryOption?.name || '-';
  const brandLabel = asset.brand || asset.brandOption?.name || '-';

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="px-6 py-4 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Paparan Aset</h2>
          <p className="text-sm text-gray-600 mt-1">Butiran lengkap aset.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => navigate('/assets')}>Kembali</Button>
          <Button onClick={() => navigate(`/assets/${asset.id}/edit`)}>Edit</Button>
        </div>
      </div>

      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div><span className="font-semibold text-gray-700">Tag Aset:</span> {asset.asset_tag || '-'}</div>
        <div><span className="font-semibold text-gray-700">Status:</span> {asset.status}</div>
        <div className="md:col-span-2"><span className="font-semibold text-gray-700">Nama:</span> {asset.name}</div>
        <div><span className="font-semibold text-gray-700">Kategori:</span> {categoryLabel}</div>
        <div><span className="font-semibold text-gray-700">Jenama:</span> {brandLabel}</div>
        <div><span className="font-semibold text-gray-700">Model:</span> {asset.model || '-'}</div>
        <div><span className="font-semibold text-gray-700">Serial Number:</span> {asset.serial_number || '-'}</div>
        <div className="md:col-span-2"><span className="font-semibold text-gray-700">Kumpulan:</span> {asset.group || '-'}</div>
        <div className="md:col-span-2"><span className="font-semibold text-gray-700">Masterlist:</span> {asset.masterlist ? `${asset.masterlist.code} - ${asset.masterlist.name}` : '-'}</div>
        <div className="md:col-span-2"><span className="font-semibold text-gray-700">Projek:</span> {asset.masterlist?.project ? `${asset.masterlist.project.code} - ${asset.masterlist.project.name}` : '-'}</div>
        <div className="md:col-span-2"><span className="font-semibold text-gray-700">Catatan:</span> {asset.notes || '-'}</div>
      </div>

      <div className="px-6 pb-6">
        <div className="rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-gray-800">Perikatan Aset</h3>
          </div>

          {asset.parentAsset && (
            <div className="mt-3 text-sm text-gray-700 bg-blue-50 p-3 rounded-md">
              <p className="font-semibold mb-1 text-blue-800">Aset Induk (Parent):</p>
              <div className="flex items-center gap-2">
                <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded capitalize">{asset.parentAsset.type}</span>
                <button 
                  onClick={() => navigate(`/assets/${asset.parentAsset?.parent_asset_id}`)}
                  className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                >
                  {asset.parentAsset.parent_asset_tag || asset.parentAsset.parent_name} ({asset.parentAsset.parent_category || 'Tiada Kategori'})
                </button>
              </div>
            </div>
          )}

          {Array.isArray(asset.accessories) && asset.accessories.length > 0 ? (
            <div className="mt-4">
              <p className="font-semibold mb-2 text-gray-700 text-sm">Aset Tambahan (Aksesori):</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-700">
                {asset.accessories.map((acc, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 border border-gray-100 rounded-md bg-gray-50">
                    <span className="bg-gray-200 text-gray-700 text-xs px-2 py-1 rounded capitalize min-w-[60px] text-center">{acc.type}</span>
                    <button 
                      onClick={() => navigate(`/assets/${acc.asset_id}`)}
                      className="text-blue-600 hover:text-blue-800 hover:underline flex-1 text-left truncate"
                    >
                      {acc.asset_tag || acc.name}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            !asset.parentAsset && <p className="mt-2 text-sm text-gray-500">Tiada perikatan aset direkodkan.</p>
          )}
        </div>
      </div>

      <div className="px-6 pb-6">
        <div className="rounded-lg border border-gray-200 p-4 space-y-3">
          <h3 className="text-base font-semibold text-gray-800">Lampiran</h3>
          {asset.attachments && asset.attachments.length > 0 ? (
            <div className="space-y-2">
              {asset.attachments.map((att) => (
                <div key={att.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-gray-50 rounded-md">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <svg className="w-5 h-5 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {att.display_name || att.file_name}
                      </p>
                      {att.display_name && (
                        <p className="text-xs text-gray-400 truncate">{att.file_name}</p>
                      )}
                      <p className="text-xs text-gray-500">
                        {att.file_type || 'Unknown'} {att.file_size ? `· ${(att.file_size / 1024).toFixed(1)} KB` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <a
                      href={att.file_path}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-md transition"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      Lihat
                    </a>
                    <a
                      href={att.file_path}
                      download={att.display_name || att.file_name}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-md transition"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                      Muat Turun
                    </a>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">Tiada lampiran direkodkan.</p>
          )}
        </div>
      </div>

      <AssetUserForm assetId={asset.id} assetUsers={asset.assetUsers} onUserAdded={handleUserAdded} />

      {/* Audit Trail - Sejarah Perubahan Aset */}
      <div className="px-6 pb-6">
        <AuditTrailSection assetId={asset.id} />
      </div>
    </div>
  );
  };

const AuditTrailSection: React.FC<{ assetId: number }> = ({ assetId }) => {
  const [logs, setLogs] = useState<AssetUpdateLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!expanded) return;
    const fetchLogs = async () => {
      setLoading(true);
      try {
        const response = await assetsApi.getUpdateLogs(assetId);
        if (response.success && response.data) {
          const data = response.data as AssetUpdateLogEntry[];
          setLogs(Array.isArray(data) ? data : []);
        }
      } catch {}
      finally { setLoading(false); }
    };
    fetchLogs();
  }, [assetId, expanded]);

  const toggleLogExpand = (logId: number) => {
    setExpandedLogs((prev) => {
      const next = new Set(prev);
      if (next.has(logId)) next.delete(logId);
      else next.add(logId);
      return next;
    });
  };

  const badge = (type: string) => {
    const m: Record<string, string> = {
      AI_UPDATE: 'bg-purple-100 text-purple-800',
      AI_CREATE: 'bg-indigo-100 text-indigo-800',
      UPDATE: 'bg-blue-100 text-blue-800',
      STATUS_CHANGE: 'bg-yellow-100 text-yellow-800',
      CREATE: 'bg-green-100 text-green-800',
      DELETE: 'bg-red-100 text-red-800',
    };
    const cls = m[type] || 'bg-gray-100 text-gray-800';
    return <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>{type.replace(/_/g, ' ')}</span>;
  };

  const fmtDate = (s: string) => new Date(s).toLocaleDateString('ms-MY', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  const renderChanges = (fc: Record<string, { old: any; new: any }>, logId: number) => {
    const entries = Object.entries(fc);
    const isExp = expandedLogs.has(logId);
    const maxV = 3;
    const shown = isExp ? entries : entries.slice(0, maxV);
    const more = entries.length > maxV;
    return (
      <div className="mt-2 space-y-1">
        {shown.map(([field, ch]) => (
          <div key={field} className="flex items-start gap-2 text-xs">
            <span className="font-medium text-gray-600 min-w-[120px] capitalize">{field.replace(/_/g, ' ')}:</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {ch.old != null && ch.old !== '' ? (
                <span className="line-through text-red-500">{String(ch.old)}</span>
              ) : (
                <span className="text-gray-400 italic">(kosong)</span>
              )}
              <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
              <span className="text-green-600">{String(ch.new)}</span>
            </div>
          </div>
        ))}
        {more && (
          <button onClick={() => toggleLogExpand(logId)} className="text-xs text-indigo-600 hover:text-indigo-800 mt-1">
            {isExp ? ('Tutup (' + entries.length + ' perubahan)') : ('... ' + (entries.length - maxV) + ' lagi')}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition text-left"
      >
        <div className="flex items-center gap-2">
          <svg className={`w-4 h-4 text-gray-500 transition-transform ${expanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <h3 className="text-sm font-semibold text-gray-800">Sejarah Perubahan Aset</h3>
          {logs.length > 0 && (
            <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">{logs.length}</span>
          )}
        </div>
      </button>
      {expanded && (
        <div className="border-t border-gray-200">
          {loading ? (
            <div className="p-4 text-center text-sm text-gray-500">Memuatkan sejarah...</div>
          ) : logs.length === 0 ? (
            <div className="p-4 text-center text-sm text-gray-500">Tiada sejarah perubahan direkodkan.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {logs.map((log) => (
                <div key={log.id} className="px-4 py-3 hover:bg-gray-50 transition">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {badge(log.action_type)}
                      <span className="text-xs text-gray-500">{fmtDate(log.created_at)}</span>
                    </div>
                    <span className="text-xs text-gray-600 font-medium">
                      {log.user?.name || 'AI Masterlist Assistant'}
                    </span>
                  </div>
                  {log.field_changes && Object.keys(log.field_changes).length > 0 && (
                    <div className="ml-1 mt-1">
                      <button onClick={() => toggleLogExpand(log.id)} className="text-xs text-indigo-600 hover:text-indigo-800">
                        {expandedLogs.has(log.id) ? 'Sembunikan perubahan' : 'Lihat perubahan'}
                      </button>
                      {expandedLogs.has(log.id) && renderChanges(log.field_changes, log.id)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

