import React, { useState, useEffect, useCallback } from 'react';
import type { Webhook, ApiKey } from '../../types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { apiKeysApi } from '../../services/api';
import { Copy, Check, Trash2, Ban, Eye, EyeOff } from 'lucide-react';

interface ApiWebhookPageProps {
  onBack: () => void;
  webhooks: Webhook[];
  onAddWebhook: (webhook: Omit<Webhook, 'id'>) => void;
  onDeleteWebhook: (webhookId: number) => void;
}

export const ApiWebhookPage: React.FC<ApiWebhookPageProps> = ({ onBack, webhooks, onAddWebhook, onDeleteWebhook }) => {
    const [newName, setNewName] = useState('');
    const [newUrl, setNewUrl] = useState('');

    const webhooksArray = Array.isArray(webhooks) ? webhooks : [];

    const handleAdd = () => {
        if (newName && newUrl) {
            try {
                new URL(newUrl);
                onAddWebhook({ name: newName, url: newUrl });
                setNewName('');
                setNewUrl('');
            } catch {
                alert('Sila masukkan URL yang sah.');
            }
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">API, Webhook & Integrasi</h2>
                    <p className="mt-1 text-sm text-gray-600">Urus kunci API, tambah URL webhook, dan sambungkan dengan perkhidmatan lain.</p>
                </div>
                <Button variant="secondary" onClick={onBack}>Kembali ke Tetapan</Button>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Pengurusan Webhook</h3>
                <div className="space-y-3 mb-6">
                    {webhooksArray.map(webhook => (
                        <div key={webhook.id} className="flex justify-between items-center p-3 border rounded-md bg-gray-50">
                            <div>
                                <p className="font-semibold">{webhook.name}</p>
                                <p className="text-sm text-gray-500 truncate">{webhook.url}</p>
                            </div>
                            <Button variant="danger" size="sm" onClick={() => onDeleteWebhook(webhook.id)}>Padam</Button>
                        </div>
                    ))}
                </div>
                 <div className="space-y-4 pt-4 border-t">
                    <h4 className="font-semibold">Tambah Webhook Baru</h4>
                    <div className="flex flex-wrap items-end gap-4">
                        <div className="flex-grow min-w-[150px]">
                           <Input label="Nama Cth: Slack #notifikasi" id="newName" value={newName} onChange={e => setNewName(e.target.value)} />
                        </div>
                        <div className="flex-grow-[2] min-w-[200px]">
                            <Input label="URL Webhook" id="newUrl" value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="https://hooks.slack.com/services/..." />
                        </div>
                        <Button onClick={handleAdd}>Tambah</Button>
                    </div>
                </div>
            </div>

            <ApiKeySection />
        </div>
    );
};

const ApiKeySection: React.FC = () => {
    const [keys, setKeys] = useState<ApiKey[]>([]);
    const [loading, setLoading] = useState(true);
    const [newKeyName, setNewKeyName] = useState('');
    const [creating, setCreating] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);
    const [copiedId, setCopiedId] = useState<number | null>(null);
    const [revealedKeyId, setRevealedKeyId] = useState<number | null>(null);
    const [revealedKeys, setRevealedKeys] = useState<Record<number, string>>({});
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const fetchKeys = useCallback(async () => {
        setLoading(true);
        try {
            const res = await apiKeysApi.list();
            if (res.success && res.data) {
                const data = res.data as any;
                setKeys(Array.isArray(data) ? data : (data.data || []));
            }
        } catch {
            // ignore
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchKeys();
    }, [fetchKeys]);

    const handleCreate = async () => {
        if (!newKeyName.trim()) return;
        setCreating(true);
        setError('');
        setSuccess('');
        try {
            const res = await apiKeysApi.create({ name: newKeyName.trim() });
            if (res.success && res.data) {
                const created = res.data as ApiKey;
                if (created.key) {
                    setRevealedKeys(prev => ({ ...prev, [created.id]: created.key! }));
                    setRevealedKeyId(created.id);
                }
                setNewKeyName('');
                setSuccess('Kunci API berjaya dicipta. Salin kunci di bawah — ia tidak akan dipaparkan lagi selepas anda tutup.');
                await fetchKeys();
            } else {
                setError(res.message || 'Gagal mencipta kunci API');
            }
        } catch {
            setError('Ralat semasa mencipta kunci API');
        } finally {
            setCreating(false);
        }
    };

    const handleRevoke = async (id: number) => {
        setError('');
        try {
            const res = await apiKeysApi.revoke(id);
            if (res.success) {
                setRevealedKeys(prev => {
                    const next = { ...prev };
                    delete next[id];
                    return next;
                });
                setRevealedKeyId(null);
                await fetchKeys();
            } else {
                setError(res.message || 'Gagal membatalkan kunci');
            }
        } catch {
            setError('Ralat semasa membatalkan kunci API');
        }
    };

    const handleDelete = async (id: number) => {
        setError('');
        try {
            const res = await apiKeysApi.delete(id);
            if (res.success) {
                setRevealedKeys(prev => {
                    const next = { ...prev };
                    delete next[id];
                    return next;
                });
                setRevealedKeyId(null);
                setShowDeleteConfirm(null);
                await fetchKeys();
            } else {
                setError(res.message || 'Gagal memadam kunci');
            }
        } catch {
            setError('Ralat semasa memadam kunci API');
        }
    };

    const handleCopy = (id: number, rawKey: string) => {
        navigator.clipboard.writeText(rawKey);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const toggleReveal = (id: number) => {
        setRevealedKeyId(prev => prev === id ? null : id);
    };

    const formatDate = (d?: string) => {
        if (!d) return '-';
        return new Date(d).toLocaleString('ms-MY', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Pengurusan Kunci API</h3>
            <p className="text-sm text-gray-600 mb-4">
                Jana kunci API untuk akses programatik ke API SPFIT. Hantar kunci dalam header <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono">x-api-key</code>.
            </p>

            {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
                    {error}
                    <button className="float-right font-bold" onClick={() => setError('')}>&times;</button>
                </div>
            )}
            {success && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-md text-sm">
                    {success}
                    <button className="float-right font-bold" onClick={() => setSuccess('')}>&times;</button>
                </div>
            )}

            <div className="space-y-4 pt-2 border-t">
                <h4 className="font-semibold">Jana Kunci API Baru</h4>
                <div className="flex flex-wrap items-end gap-4">
                    <div className="flex-grow min-w-[200px]">
                        <Input label="Nama Kunci (cth: Integrasi POS, Sistem Laporan)" id="apiKeyName" value={newKeyName} onChange={e => setNewKeyName(e.target.value)} placeholder="Nama deskriptif untuk kunci ini" />
                    </div>
                    <Button onClick={handleCreate} disabled={creating || !newKeyName.trim()}>
                        {creating ? 'Menjana...' : 'Jana Kunci'}
                    </Button>
                </div>
            </div>

            <div className="space-y-3 mt-6">
                <h4 className="font-semibold">Kunci API Sedia Ada</h4>
                {loading ? (
                    <p className="text-gray-500 text-sm">Memuatkan...</p>
                ) : keys.length === 0 ? (
                    <p className="text-gray-500 text-sm">Tiada kunci API.</p>
                ) : (
                    keys.map(key => (
                        <div key={key.id} className={`p-4 border rounded-md ${key.status === 'revoked' ? 'bg-gray-100 border-gray-200 opacity-60' : 'bg-white border-gray-200'}`}>
                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <p className="font-semibold text-gray-800">{key.name}</p>
                                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${key.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {key.status === 'active' ? 'Aktif' : 'Dibatalkan'}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-500 mt-1">
                                        <code className="font-mono bg-gray-100 px-1 rounded">{key.key_prefix}...</code>
                                    </p>
                                    <p className="text-xs text-gray-400 mt-1">
                                        Dicipta: {formatDate(key.created_at)} &middot; {key.creator?.name ? `oleh ${key.creator.name}` : ''}
                                        {key.last_used_at ? ` · Guna terakhir: ${formatDate(key.last_used_at)}` : ' · Belum digunakan'}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    {revealedKeys[key.id] && (
                                        <button
                                            onClick={() => toggleReveal(key.id)}
                                            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                                            title={revealedKeyId === key.id ? 'Sembunyi kunci' : 'Papar kunci'}
                                        >
                                            {revealedKeyId === key.id ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    )}
                                    {revealedKeys[key.id] && revealedKeyId === key.id && (
                                        <button
                                            onClick={() => handleCopy(key.id, revealedKeys[key.id])}
                                            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                                            title="Salin kunci"
                                        >
                                            {copiedId === key.id ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                                        </button>
                                    )}
                                    {key.status === 'active' && (
                                        <Button variant="secondary" size="sm" onClick={() => handleRevoke(key.id)}>
                                            <Ban className="h-4 w-4 mr-1" /> Batalkan
                                        </Button>
                                    )}
                                    <Button variant="danger" size="sm" onClick={() => setShowDeleteConfirm(key.id)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                            {revealedKeys[key.id] && revealedKeyId === key.id && (
                                <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-md">
                                    <p className="text-xs text-amber-700 font-medium mb-1">Simpan kunci ini sekarang. Ia tidak akan dipaparkan lagi selepas ini.</p>
                                    <code className="text-sm font-mono break-all text-amber-900 bg-amber-100 px-2 py-1 rounded block">
                                        {revealedKeys[key.id]}
                                    </code>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {showDeleteConfirm !== null && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full mx-4">
                        <h3 className="text-lg font-bold text-gray-800 mb-2">Pengesahan Pemadaman</h3>
                        <p className="text-sm text-gray-600 mb-4">Adakah anda pasti mahu memadam kunci API ini secara kekal? Tindakan ini tidak boleh dibatalkan.</p>
                        <div className="flex justify-end gap-3">
                            <Button variant="secondary" onClick={() => setShowDeleteConfirm(null)}>Batal</Button>
                            <Button variant="danger" onClick={() => handleDelete(showDeleteConfirm)}>Padam</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
