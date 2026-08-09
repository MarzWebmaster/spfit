import React, { useState, useEffect } from 'react';
import type { SmtpSettings } from '../../types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { auditApi, systemApi } from '../../services/api';

interface MailSettingsPageProps {
  onBack: () => void;
  settings: SmtpSettings;
  onSave: (settings: SmtpSettings) => void;
}

export const MailSettingsPage: React.FC<MailSettingsPageProps> = ({ onBack, settings: initialSettings, onSave }) => {
    const [settings, setSettings] = useState(initialSettings);
    const [testRecipientEmail, setTestRecipientEmail] = useState(initialSettings.fromAddress || '');
    const [isTesting, setIsTesting] = useState(false);
    const [testMessage, setTestMessage] = useState<string | null>(null);
    const [testError, setTestError] = useState<string | null>(null);
    const [recentAuditLogs, setRecentAuditLogs] = useState<any[]>([]);

    const getStatusBadgeClass = (status?: string) => {
        if (status === 'SENT') return 'bg-green-100 text-green-800 border-green-200';
        if (status === 'FAILED') return 'bg-red-100 text-red-800 border-red-200';
        return 'bg-gray-100 text-gray-700 border-gray-200';
    };

    useEffect(() => {
        setSettings(initialSettings);
        setTestRecipientEmail(initialSettings.fromAddress || '');
    }, [initialSettings]);

    const loadRecentSmtpAuditLogs = async () => {
        try {
            const response = await auditApi.getLogs({
                page: 1,
                limit: 10,
                tableName: 'smtp_test_email'
            });

            if (response.success && response.data) {
                setRecentAuditLogs((response.data as any).data || []);
            } else {
                setRecentAuditLogs([]);
            }
        } catch (error) {
            console.error('Gagal memuatkan audit log SMTP:', error);
            setRecentAuditLogs([]);
        }
    };

    useEffect(() => {
        loadRecentSmtpAuditLogs();
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { id, value } = e.target;
        setSettings(prev => ({ 
            ...prev, 
            [id]: id === 'port' ? parseInt(value, 10) || 0 : value 
        }));
    };

    const handleSave = () => {
        onSave(settings);
    };
    
    const handleTest = async () => {
        if (!testRecipientEmail.trim()) {
            setTestError('Sila masukkan e-mel penerima ujian.');
            setTestMessage(null);
            return;
        }

        try {
            setIsTesting(true);
            setTestError(null);
            setTestMessage(null);

            const response = await systemApi.sendTestEmail({
                recipient_email: testRecipientEmail.trim(),
                smtp: settings
            });

            if (!response.success) {
                setTestError((response as any).error || 'Gagal menghantar e-mel ujian.');
            } else {
                setTestMessage((response as any).message || `E-mel ujian berjaya dihantar ke ${testRecipientEmail.trim()}.`);
            }

            await loadRecentSmtpAuditLogs();
        } catch (error: any) {
            console.error('Test SMTP failed:', error);
            setTestError(error?.message || 'Gagal menghantar e-mel ujian.');
            await loadRecentSmtpAuditLogs();
        } finally {
            setIsTesting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Tetapan Mel (SMTP)</h2>
                    <p className="mt-1 text-sm text-gray-600">Konfigurasi tetapan pelayan SMTP untuk penghantaran e-mel notifikasi.</p>
                </div>
                <Button variant="secondary" onClick={onBack}>Kembali ke Tetapan</Button>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
                <div className="space-y-6 max-w-2xl mx-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         <Input label="Pelayan SMTP" id="server" value={settings.server} onChange={handleInputChange} placeholder="smtp.example.com" />
                         <Input label="Port" id="port" type="number" value={settings.port} onChange={handleInputChange} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Input label="Nama Pengguna (E-mel SMTP)" id="username" value={settings.username} onChange={handleInputChange} placeholder="support@domain.com" />
                        <Input label="Kata Laluan" id="password" type="password" value={settings.password} onChange={handleInputChange} />
                    </div>
                     <Input label="Alamat E-mel Penghantar" id="fromAddress" type="email" value={settings.fromAddress} onChange={handleInputChange} placeholder="noreply@spfit.com" />
                     <Input
                        label="E-mel Penerima Ujian"
                        id="testRecipientEmail"
                        type="email"
                        value={testRecipientEmail}
                        onChange={(e) => setTestRecipientEmail(e.target.value)}
                        placeholder="contoh@domain.com"
                     />
                     <Select label="Jenis Keselamatan" id="security" value={settings.security} onChange={handleInputChange}>
                        <option value="TLS">TLS</option>
                        <option value="SSL">SSL</option>
                        <option value="None">Tiada</option>
                    </Select>

                    {testMessage && (
                        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                            {testMessage}
                        </div>
                    )}

                    {testError && (
                        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                            {testError}
                        </div>
                    )}

                     <div className="flex flex-wrap justify-end gap-2 pt-4 border-t">
                        <Button variant="secondary" onClick={handleTest} disabled={isTesting}>
                            {isTesting ? 'Menghantar...' : 'Hantar E-mel Ujian'}
                        </Button>
                        <Button onClick={handleSave}>Simpan Tetapan</Button>
                    </div>

                    <div className="pt-4 border-t space-y-3">
                        <h3 className="text-sm font-semibold text-gray-800">Rekod Ujian E-mel Terkini (Audit)</h3>
                        {recentAuditLogs.length === 0 ? (
                            <p className="text-sm text-gray-500">Tiada rekod ujian e-mel.</p>
                        ) : (
                            <div className="space-y-2">
                                {recentAuditLogs.map((log) => (
                                    <div key={log.id} className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="text-sm font-medium text-gray-800">{log.description}</p>
                                            <div className="flex items-center gap-2">
                                                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${getStatusBadgeClass(log?.new_values?.status)}`}>
                                                    {log?.new_values?.status || 'UNKNOWN'}
                                                </span>
                                                <span className="text-xs text-gray-500">{new Date(log.timestamp).toLocaleString('ms-MY')}</span>
                                            </div>
                                        </div>
                                        <p className="text-xs text-gray-600 mt-1">Tindakan: {log.action_type} • Pengguna: {log.user?.name || 'Sistem'}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};