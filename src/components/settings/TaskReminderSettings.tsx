import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { taskRemindersApi } from '../../services/api';
import type { GlobalTaskReminderConfig, NotificationTemplate, ReminderOffsetConfig, ReminderUnit } from '../../types';

export enum ReminderType {
  ATTENDANCE = 'attendance',
  DOCUMENT_SUBMISSION = 'document_submission'
}

interface TaskReminderSettingsProps {
  templates: NotificationTemplate[];
}

const REMINDER_TYPE_LABELS: Record<ReminderType, string> = {
  [ReminderType.ATTENDANCE]: 'Hadir Ke Lokasi',
  [ReminderType.DOCUMENT_SUBMISSION]: 'Hantar Dokumen'
};

const UNIT_OPTIONS: Array<{ label: string; value: ReminderUnit }> = [
  { label: 'Minit', value: 'minutes' },
  { label: 'Jam', value: 'hours' },
  { label: 'Hari', value: 'days' },
];

const createDefaultConfig = (type: ReminderType): GlobalTaskReminderConfig => ({
  reminderType: type,
  offsets: type === ReminderType.ATTENDANCE ? [] : [{ value: 1, unit: 'days' }],
  autoSendAtScheduledTime: type === ReminderType.ATTENDANCE,
  channels: ['email'],
  customMessage: '',
  isActive: true,
});

export const TaskReminderSettings: React.FC<TaskReminderSettingsProps> = ({ templates }) => {
  const reminderTypes = Object.values(ReminderType);
  const [configs, setConfigs] = useState<Map<ReminderType, GlobalTaskReminderConfig>>(new Map());
  const [expandedType, setExpandedType] = useState<ReminderType | null>(ReminderType.ATTENDANCE);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      setLoading(true);
      setMessage(null);
      try {
        const response = await taskRemindersApi.getSettings();
        const settings = Array.isArray((response as any)?.data?.settings) ? (response as any).data.settings : [];
        const nextConfigs = new Map<ReminderType, GlobalTaskReminderConfig>();
        reminderTypes.forEach(type => {
          const found = settings.find((item: GlobalTaskReminderConfig) => item.reminderType === type);
          nextConfigs.set(type, found || createDefaultConfig(type));
        });
        setConfigs(nextConfigs);
      } catch (error: any) {
        setMessage({ type: 'error', text: error?.message || 'Gagal memuatkan tetapan reminder.' });
        const fallback = new Map<ReminderType, GlobalTaskReminderConfig>();
        reminderTypes.forEach(type => fallback.set(type, createDefaultConfig(type)));
        setConfigs(fallback);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  const getConfig = (type: ReminderType): GlobalTaskReminderConfig => {
    const config = configs.get(type);
    return config || createDefaultConfig(type);
  };

  const updateConfig = (type: ReminderType, updates: Partial<GlobalTaskReminderConfig>) => {
    setConfigs(prev => {
      const updated = new Map(prev);
      updated.set(type, { ...getConfig(type), ...updates });
      return updated;
    });
  };

  const addOffset = (type: ReminderType) => {
    const config = getConfig(type);
    updateConfig(type, { offsets: [...config.offsets, { value: 15, unit: 'minutes' }] });
  };

  const updateOffset = (type: ReminderType, index: number, updates: Partial<ReminderOffsetConfig>) => {
    const config = getConfig(type);
    const offsets = config.offsets.map((offset, offsetIndex) => offsetIndex === index ? { ...offset, ...updates } : offset);
    updateConfig(type, { offsets });
  };

  const removeOffset = (type: ReminderType, index: number) => {
    const config = getConfig(type);
    updateConfig(type, { offsets: config.offsets.filter((_, offsetIndex) => offsetIndex !== index) });
  };

  const toggleChannel = (type: ReminderType, channel: string) => {
    const config = getConfig(type);
    const channels = config.channels.includes(channel)
      ? config.channels.filter(ch => ch !== channel)
      : [...config.channels, channel];
    updateConfig(type, { channels });
  };

  const getRelevantTemplates = () => {
    return templates.filter(t => t.type === 'Peringatan Tugasan' || t.type?.includes('Reminder'));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const configArray = reminderTypes.map(type => getConfig(type));
      const response = await taskRemindersApi.saveSettings(configArray);
      if (!(response as any)?.success) {
        throw new Error((response as any)?.error || 'Gagal menyimpan tetapan reminder');
      }
      setMessage({ type: 'success', text: 'Tetapan reminder berjaya disimpan.' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Gagal menyimpan tetapan reminder.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-4 text-sm text-gray-600">Memuatkan tetapan reminder...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="text-lg font-semibold text-gray-800">Task Reminder Settings</h3>
      </div>

      {message && (
        <div className={`p-3 rounded-md text-sm ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {message.text}
        </div>
      )}

      <div className="space-y-3">
        {reminderTypes.map(type => {
          const config = getConfig(type);
          const isExpanded = expandedType === type;

          return (
            <div key={type} className="border border-gray-200 rounded-lg overflow-hidden bg-white">
              {/* Header */}
              <button
                onClick={() => setExpandedType(isExpanded ? null : type)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="flex-1 text-left">
                    <p className="font-semibold text-gray-800">{REMINDER_TYPE_LABELS[type]}</p>
                    <p className="text-sm text-gray-600">
                      {config.isActive ? '✓ Aktif' : '✕ Tidak Aktif'} • {config.channels.join(', ') || 'No channels'}
                    </p>
                  </div>
                </div>
                {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </button>

              {/* Content */}
              {isExpanded && (
                <div className="px-4 py-4 border-t border-gray-200 bg-gray-50 space-y-4">
                  {/* Active toggle */}
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id={`active-${type}`}
                      checked={config.isActive}
                      onChange={(e) => updateConfig(type, { isActive: e.target.checked })}
                      className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    />
                    <label htmlFor={`active-${type}`} className="ml-2 text-sm font-medium text-gray-700">
                      Aktifkan Reminder untuk {REMINDER_TYPE_LABELS[type]}
                    </label>
                  </div>

                  {config.isActive && (
                    <>
                      {type === ReminderType.ATTENDANCE && (
                        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                          Pada masa yang ditetapkan, sistem akan auto hantar reminder hadir ke lokasi. Bila freelancer tekan pautan Telah Tiba Di Lokasi, reminder hadir akan berhenti.
                        </div>
                      )}

                      <div>
                        <Select
                          label="Pilih Templat Notifikasi"
                          id={`template-${type}`}
                          value={config.templateId ? String(config.templateId) : ''}
                          onChange={(e) => updateConfig(type, { templateId: e.target.value ? Number(e.target.value) : undefined })}
                        >
                          <option value="">-- Gunakan Pesan Custom --</option>
                          {getRelevantTemplates().map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </Select>
                      </div>

                      {!config.templateId && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Pesan Custom
                          </label>
                          <textarea
                            value={config.customMessage || ''}
                            onChange={(e) => updateConfig(type, { customMessage: e.target.value })}
                            placeholder="Tuliskan pesan untuk reminder ini..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-indigo-500"
                            rows={3}
                          />
                        </div>
                      )}

                      <div className="space-y-3 rounded-md border border-gray-200 bg-white p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-800">Hantar Peringatan Sebelum</p>
                            <p className="text-xs text-gray-500">Tambah satu atau lebih masa sebelum reminder dihantar.</p>
                          </div>
                          <Button type="button" size="sm" variant="secondary" onClick={() => addOffset(type)}>
                            <Plus className="h-4 w-4 mr-1" /> Tambah
                          </Button>
                        </div>

                        <div className="space-y-2">
                          {config.offsets.length === 0 && (
                            <p className="text-sm text-gray-500">Tiada reminder sebelum masa ditetapkan.</p>
                          )}

                          {config.offsets.map((offset, index) => (
                            <div key={`${type}-${index}`} className="flex items-end gap-2">
                              <div className="w-28">
                                <Input
                                  id={`${type}-offset-${index}`}
                                  label={index === 0 ? 'Nilai' : ''}
                                  type="number"
                                  min="1"
                                  value={offset.value}
                                  onChange={(e) => updateOffset(type, index, { value: Number(e.target.value || 1) })}
                                />
                              </div>
                              <div className="flex-1">
                                <Select
                                  id={`${type}-offset-unit-${index}`}
                                  label={index === 0 ? 'Unit' : ''}
                                  value={offset.unit}
                                  onChange={(e) => updateOffset(type, index, { unit: e.target.value as ReminderUnit })}
                                  options={UNIT_OPTIONS}
                                />
                              </div>
                              <Button type="button" size="sm" variant="danger" onClick={() => removeOffset(type, index)} className="h-10">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {type === ReminderType.ATTENDANCE && (
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            id={`auto-send-${type}`}
                            checked={config.autoSendAtScheduledTime}
                            onChange={(e) => updateConfig(type, { autoSendAtScheduledTime: e.target.checked })}
                            className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                          />
                          <label htmlFor={`auto-send-${type}`} className="ml-2 text-sm font-medium text-gray-700">
                            Auto hantar pada masa yang ditetapkan
                          </label>
                        </div>
                      )}

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Saluran Pengiriman
                        </label>
                        <div className="space-y-2">
                          {['email', 'whatsapp', 'web_notification'].map(ch => (
                            <label key={ch} className="flex items-center">
                              <input
                                type="checkbox"
                                checked={config.channels.includes(ch)}
                                onChange={() => toggleChannel(type, ch)}
                                className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                              />
                              <span className="ml-2 text-sm text-gray-700">
                                {ch === 'email' ? 'E-mel' : ch === 'whatsapp' ? 'WhatsApp' : 'Web Notification'}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Menyimpan...' : 'Simpan Konfigurasi'}
        </Button>
      </div>
    </div>
  );
};
