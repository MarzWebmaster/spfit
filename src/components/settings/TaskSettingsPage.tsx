import React, { useCallback, useEffect, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { taskSettingsApi } from '../../services/api';
import { TaskReminderSettings } from './TaskReminderSettings';
import type { NotificationTemplate } from '../../types';

interface TaskSettingsPageProps {
  onBack: () => void;
  isAdmin: boolean;
  notificationTemplates?: NotificationTemplate[];
}

interface SettingOption {
  id: number;
  value: string;
}

export const TaskSettingsPage: React.FC<TaskSettingsPageProps> = ({ onBack, isAdmin, notificationTemplates = [] }) => {
  const protectedStatusNames = new Set([
    'baru',
    'tawaran dihantar',
    'telah diambil',
    'selesai',
    'borang disemak & pembayaran tertunggak',
    'telah dibayar',
    'dibatalkan',
    'selesai penuh'
  ]);

  const isProtectedStatus = (value: string) => protectedStatusNames.has(String(value || '').trim().toLowerCase());

  const [loading, setLoading] = useState(true);
  const [taskStatuses, setTaskStatuses] = useState<SettingOption[]>([]);
  const [supportTypes, setSupportTypes] = useState<SettingOption[]>([]);
  const [equipmentCodes, setEquipmentCodes] = useState<SettingOption[]>([]);

  const [newStatus, setNewStatus] = useState('');
  const [newSupportType, setNewSupportType] = useState('');
  const [newEquipmentCode, setNewEquipmentCode] = useState('');

  const [editingStatusId, setEditingStatusId] = useState<number | null>(null);
  const [editingStatusValue, setEditingStatusValue] = useState('');
  const [editingSupportId, setEditingSupportId] = useState<number | null>(null);
  const [editingSupportValue, setEditingSupportValue] = useState('');
  const [editingEquipmentId, setEditingEquipmentId] = useState<number | null>(null);
  const [editingEquipmentValue, setEditingEquipmentValue] = useState('');

  const [workingKey, setWorkingKey] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const response = await taskSettingsApi.getAll(true);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Gagal memuatkan tetapan tugasan');
      }

      const data: any = response.data;
      setTaskStatuses(Array.isArray(data.statusOptions) ? data.statusOptions.map((item: any) => ({ id: Number(item.id), value: String(item.value) })) : []);
      setSupportTypes(Array.isArray(data.supportTypeOptions) ? data.supportTypeOptions.map((item: any) => ({ id: Number(item.id), value: String(item.value) })) : []);
      setEquipmentCodes(Array.isArray(data.equipmentCodeOptions) ? data.equipmentCodeOptions.map((item: any) => ({ id: Number(item.id), value: String(item.value) })) : []);
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Gagal memuatkan tetapan tugasan.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleCreateStatus = async () => {
    const value = newStatus.trim();
    if (!value) return;

    setWorkingKey('status-create');
    setMessage(null);
    try {
      const response = await taskSettingsApi.createStatus(value);
      if (!response.success || !response.data) throw new Error(response.error || 'Gagal tambah status tugasan');
      const item: any = response.data;
      setTaskStatuses(prev => [...prev, { id: Number(item.id), value: String(item.value) }]);
      setNewStatus('');
      setMessage({ type: 'success', text: 'Status tugasan berjaya ditambah.' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Gagal tambah status tugasan.' });
    } finally {
      setWorkingKey(null);
    }
  };

  const handleCreateSupportType = async () => {
    const value = newSupportType.trim();
    if (!value) return;

    setWorkingKey('support-create');
    setMessage(null);
    try {
      const response = await taskSettingsApi.createSupportType(value);
      if (!response.success || !response.data) throw new Error(response.error || 'Gagal tambah jenis sokongan');
      const item: any = response.data;
      setSupportTypes(prev => [...prev, { id: Number(item.id), value: String(item.value) }]);
      setNewSupportType('');
      setMessage({ type: 'success', text: 'Jenis sokongan berjaya ditambah.' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Gagal tambah jenis sokongan.' });
    } finally {
      setWorkingKey(null);
    }
  };

  const handleCreateEquipmentCode = async () => {
    const value = newEquipmentCode.trim();
    if (!value) return;

    setWorkingKey('equipment-create');
    setMessage(null);
    try {
      const response = await taskSettingsApi.createEquipmentCode(value);
      if (!response.success || !response.data) throw new Error(response.error || 'Gagal tambah equipment code');
      const item: any = response.data;
      setEquipmentCodes(prev => [...prev, { id: Number(item.id), value: String(item.value) }]);
      setNewEquipmentCode('');
      setMessage({ type: 'success', text: 'Equipment code berjaya ditambah.' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Gagal tambah equipment code.' });
    } finally {
      setWorkingKey(null);
    }
  };

  const handleUpdateStatus = async () => {
    if (!editingStatusId) return;
    const value = editingStatusValue.trim();
    if (!value) return;

    setWorkingKey(`status-edit-${editingStatusId}`);
    setMessage(null);
    try {
      const response = await taskSettingsApi.updateStatus(editingStatusId, value);
      if (!response.success || !response.data) throw new Error(response.error || 'Gagal kemaskini status tugasan');

      setTaskStatuses(prev => prev.map(item => item.id === editingStatusId ? { ...item, value } : item));
      setEditingStatusId(null);
      setEditingStatusValue('');
      setMessage({ type: 'success', text: 'Status tugasan berjaya dikemaskini.' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Gagal kemaskini status tugasan.' });
    } finally {
      setWorkingKey(null);
    }
  };

  const handleUpdateSupportType = async () => {
    if (!editingSupportId) return;
    const value = editingSupportValue.trim();
    if (!value) return;

    setWorkingKey(`support-edit-${editingSupportId}`);
    setMessage(null);
    try {
      const response = await taskSettingsApi.updateSupportType(editingSupportId, value);
      if (!response.success || !response.data) throw new Error(response.error || 'Gagal kemaskini jenis sokongan');

      setSupportTypes(prev => prev.map(item => item.id === editingSupportId ? { ...item, value } : item));
      setEditingSupportId(null);
      setEditingSupportValue('');
      setMessage({ type: 'success', text: 'Jenis sokongan berjaya dikemaskini.' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Gagal kemaskini jenis sokongan.' });
    } finally {
      setWorkingKey(null);
    }
  };

  const handleUpdateEquipmentCode = async () => {
    if (!editingEquipmentId) return;
    const value = editingEquipmentValue.trim();
    if (!value) return;

    setWorkingKey(`equipment-edit-${editingEquipmentId}`);
    setMessage(null);
    try {
      const response = await taskSettingsApi.updateEquipmentCode(editingEquipmentId, value);
      if (!response.success || !response.data) throw new Error(response.error || 'Gagal kemaskini equipment code');

      setEquipmentCodes(prev => prev.map(item => item.id === editingEquipmentId ? { ...item, value: value.toUpperCase() } : item));
      setEditingEquipmentId(null);
      setEditingEquipmentValue('');
      setMessage({ type: 'success', text: 'Equipment code berjaya dikemaskini.' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Gagal kemaskini equipment code.' });
    } finally {
      setWorkingKey(null);
    }
  };

  const handleDeleteStatus = async (id: number) => {
    if (!isAdmin) {
      setMessage({ type: 'error', text: 'Hanya Admin boleh memadam status tugasan tambahan.' });
      return;
    }

    setWorkingKey(`status-delete-${id}`);
    setMessage(null);
    try {
      const response = await taskSettingsApi.deleteStatus(id);
      if (!response.success) throw new Error(response.error || 'Gagal padam status tugasan');
      setTaskStatuses(prev => prev.filter(item => item.id !== id));
      setMessage({ type: 'success', text: 'Status tugasan berjaya dipadam.' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Gagal padam status tugasan.' });
    } finally {
      setWorkingKey(null);
    }
  };

  const handleDeleteSupportType = async (id: number) => {
    setWorkingKey(`support-delete-${id}`);
    setMessage(null);
    try {
      const response = await taskSettingsApi.deleteSupportType(id);
      if (!response.success) throw new Error(response.error || 'Gagal padam jenis sokongan');
      setSupportTypes(prev => prev.filter(item => item.id !== id));
      setMessage({ type: 'success', text: 'Jenis sokongan berjaya dipadam.' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Gagal padam jenis sokongan.' });
    } finally {
      setWorkingKey(null);
    }
  };

  const handleDeleteEquipmentCode = async (id: number) => {
    setWorkingKey(`equipment-delete-${id}`);
    setMessage(null);
    try {
      const response = await taskSettingsApi.deleteEquipmentCode(id);
      if (!response.success) throw new Error(response.error || 'Gagal padam equipment code');
      setEquipmentCodes(prev => prev.filter(item => item.id !== id));
      setMessage({ type: 'success', text: 'Equipment code berjaya dipadam.' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Gagal padam equipment code.' });
    } finally {
      setWorkingKey(null);
    }
  };

  if (loading) {
    return <div className="p-6 text-sm text-gray-600">Memuatkan tetapan tugasan...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full">
          <ChevronLeft className="h-6 w-6 text-gray-600" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Tetapan Tugasan</h1>
      </div>

      {message && (
        <div className={`p-3 rounded-md text-sm ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
          <h2 className="text-lg font-semibold text-gray-800">Status Tugasan</h2>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input id="new-task-status" label="" placeholder="Tambah status baru" value={newStatus} onChange={e => setNewStatus(e.target.value)} />
            <Button onClick={handleCreateStatus} className="h-10 self-end" disabled={workingKey === 'status-create'}>Tambah</Button>
          </div>
          <div className="space-y-2">
            {taskStatuses.map((status) => (
              <div key={status.id} className="flex items-center justify-between gap-2 p-2 bg-gray-50 rounded border">
                {editingStatusId === status.id ? (
                  <div className="flex items-center gap-2 w-full">
                    <input className="w-full px-2 py-1 border rounded" value={editingStatusValue} onChange={e => setEditingStatusValue(e.target.value)} />
                    <Button size="sm" onClick={handleUpdateStatus} disabled={workingKey === `status-edit-${status.id}`}>Simpan</Button>
                  </div>
                ) : (
                  <>
                    <span className="text-sm text-gray-800">{status.value}</span>
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => { setEditingStatusId(status.id); setEditingStatusValue(status.value); }}>Edit</Button>
                      {isProtectedStatus(status.value) ? (
                        <Button size="sm" variant="danger" disabled title="Status lalai tidak boleh dipadam">Tidak boleh dipadam</Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => handleDeleteStatus(status.id)}
                          disabled={!isAdmin || workingKey === `status-delete-${status.id}`}
                          title={!isAdmin ? 'Hanya Admin boleh memadam status tambahan' : 'Padam'}
                        >
                          Padam
                        </Button>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
          <h2 className="text-lg font-semibold text-gray-800">Jenis Sokongan</h2>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input id="new-support-type" label="" placeholder="Tambah jenis sokongan" value={newSupportType} onChange={e => setNewSupportType(e.target.value)} />
            <Button onClick={handleCreateSupportType} className="h-10 self-end" disabled={workingKey === 'support-create'}>Tambah</Button>
          </div>
          <div className="space-y-2">
            {supportTypes.map((type) => (
              <div key={type.id} className="flex items-center justify-between gap-2 p-2 bg-gray-50 rounded border">
                {editingSupportId === type.id ? (
                  <div className="flex items-center gap-2 w-full">
                    <input className="w-full px-2 py-1 border rounded" value={editingSupportValue} onChange={e => setEditingSupportValue(e.target.value)} />
                    <Button size="sm" onClick={handleUpdateSupportType} disabled={workingKey === `support-edit-${type.id}`}>Simpan</Button>
                  </div>
                ) : (
                  <>
                    <span className="text-sm text-gray-800">{type.value}</span>
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => { setEditingSupportId(type.id); setEditingSupportValue(type.value); }}>Edit</Button>
                      <Button size="sm" variant="danger" onClick={() => handleDeleteSupportType(type.id)} disabled={workingKey === `support-delete-${type.id}`}>Padam</Button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3 md:col-span-2">
          <h2 className="text-lg font-semibold text-gray-800">Equipment Code</h2>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input id="new-equipment-code" label="" placeholder="Tambah equipment code" value={newEquipmentCode} onChange={e => setNewEquipmentCode(e.target.value)} />
            <Button onClick={handleCreateEquipmentCode} className="h-10 self-end" disabled={workingKey === 'equipment-create'}>Tambah</Button>
          </div>
          <div className="space-y-2">
            {equipmentCodes.map((code) => (
              <div key={code.id} className="flex items-center justify-between gap-2 p-2 bg-gray-50 rounded border">
                {editingEquipmentId === code.id ? (
                  <div className="flex items-center gap-2 w-full">
                    <input className="w-full px-2 py-1 border rounded" value={editingEquipmentValue} onChange={e => setEditingEquipmentValue(e.target.value)} />
                    <Button size="sm" onClick={handleUpdateEquipmentCode} disabled={workingKey === `equipment-edit-${code.id}`}>Simpan</Button>
                  </div>
                ) : (
                  <>
                    <span className="text-sm text-gray-800">{code.value}</span>
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => { setEditingEquipmentId(code.id); setEditingEquipmentValue(code.value); }}>Edit</Button>
                      <Button size="sm" variant="danger" onClick={() => handleDeleteEquipmentCode(code.id)} disabled={workingKey === `equipment-delete-${code.id}`}>Padam</Button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <TaskReminderSettings templates={notificationTemplates} />
      </div>

      <div className="flex justify-end">
        <Button onClick={loadSettings} disabled={loading || workingKey !== null}>Muat Semula Tetapan</Button>
      </div>
    </div>
  );
};
