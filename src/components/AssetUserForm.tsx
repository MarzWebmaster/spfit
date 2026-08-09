import React, { useState, useEffect } from 'react';
import type { AssetUser } from '../types';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Trash2 } from 'lucide-react';
import { storage } from '../utils/storage';

interface AssetUserFormProps {
  assetId: number;
  assetUsers?: AssetUser[];
  onUserAdded: () => void;
}

export const AssetUserForm: React.FC<AssetUserFormProps> = ({ assetId, assetUsers = [], onUserAdded }) => {
  const [formState, setFormState] = useState({
    user_name: '',
    position: '',
    department: '',
    floor: '',
    building: '',
    location: '',
    branch: '',
    state: ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<AssetUser[]>(assetUsers);

  const mapUserToFormState = (user?: AssetUser) => ({
    user_name: user?.user_name || '',
    position: user?.position || '',
    department: user?.department || '',
    floor: user?.floor || '',
    building: user?.building || '',
    location: user?.location || '',
    branch: user?.branch || '',
    state: user?.state || ''
  });

  useEffect(() => {
    setUsers(assetUsers);
    setFormState(mapUserToFormState(assetUsers[0]));
  }, [assetUsers]);

  const handleInputChange = (field: string, value: string) => {
    setFormState(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formState.user_name.trim()) {
      setError('Nama pengguna diperlukan');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const token = storage.getToken();
      const existingUser = users[0];
      const response = await fetch(existingUser ? `/api/asset-users/${existingUser.id}` : '/api/asset-users', {
        method: existingUser ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          ...(existingUser ? {} : { asset_id: assetId }),
          user_name: formState.user_name.trim(),
          position: formState.position.trim() || undefined,
          department: formState.department.trim() || undefined,
          floor: formState.floor.trim() || undefined,
          building: formState.building.trim() || undefined,
          location: formState.location.trim() || undefined,
          branch: formState.branch.trim() || undefined,
          state: formState.state.trim() || undefined
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Gagal menyimpan pengguna aset');
      }

      const payload = await response.json();
      const savedUser = payload.data as AssetUser;
      setUsers(prev => {
        if (existingUser) {
          return prev.map(user => (user.id === savedUser.id ? savedUser : user));
        }
        return [savedUser, ...prev];
      });
      setFormState(mapUserToFormState(savedUser));
      onUserAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ralat semasa menambah pengguna');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (userId: number) => {
    if (!window.confirm('Padam pengguna aset ini?')) return;

    try {
      const token = storage.getToken();
      const response = await fetch(`/api/asset-users/${userId}`, {
        method: 'DELETE',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });

      if (!response.ok) {
        throw new Error('Gagal memadam pengguna aset');
      }

      setUsers(prev => prev.filter(u => u.id !== userId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ralat semasa memadam pengguna');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mt-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Tambah Pengguna Aset</h3>
        
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Nama Pengguna *"
              value={formState.user_name}
              onChange={(e) => handleInputChange('user_name', e.target.value)}
              placeholder="Wajib"
              required
            />
            <Input
              label="Jawatan"
              value={formState.position}
              onChange={(e) => handleInputChange('position', e.target.value)}
              placeholder="Opsyenal"
            />
            <Input
              label="Jabatan"
              value={formState.department}
              onChange={(e) => handleInputChange('department', e.target.value)}
              placeholder="Opsyenal"
            />
            <Input
              label="Tingkat"
              value={formState.floor}
              onChange={(e) => handleInputChange('floor', e.target.value)}
              placeholder="Opsyenal"
            />
            <Input
              label="Bangunan"
              value={formState.building}
              onChange={(e) => handleInputChange('building', e.target.value)}
              placeholder="Opsyenal"
            />
            <Input
              label="Lokasi"
              value={formState.location}
              onChange={(e) => handleInputChange('location', e.target.value)}
              placeholder="Opsyenal"
            />
            <Input
              label="Cawangan"
              value={formState.branch}
              onChange={(e) => handleInputChange('branch', e.target.value)}
              placeholder="Opsyenal"
            />
            <Input
              label="Negeri"
              value={formState.state}
              onChange={(e) => handleInputChange('state', e.target.value)}
              placeholder="Opsyenal"
              className="md:col-span-2"
            />
          </div>

          <Button type="submit" disabled={saving}>
            {saving ? 'Menyimpan...' : users.length > 0 ? 'Kemaskini Pengguna' : 'Tambah Pengguna'}
          </Button>
        </form>
      </div>

      {users.length > 0 && (
        <div>
          <h4 className="text-md font-semibold text-gray-800 mb-3">Senarai Pengguna ({users.length})</h4>
          <div className="space-y-3">
            {users.map(user => (
              <div key={user.id} className="border-l-4 border-blue-500 bg-gray-50 p-4 rounded">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h5 className="font-semibold text-gray-800">{user.user_name}</h5>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm text-gray-600 mt-2">
                      {user.position && <div><span className="font-semibold">Jawatan:</span> {user.position}</div>}
                      {user.department && <div><span className="font-semibold">Jabatan:</span> {user.department}</div>}
                      {user.floor && <div><span className="font-semibold">Tingkat:</span> {user.floor}</div>}
                      {user.building && <div><span className="font-semibold">Bangunan:</span> {user.building}</div>}
                      {user.location && <div><span className="font-semibold">Lokasi:</span> {user.location}</div>}
                      {user.branch && <div><span className="font-semibold">Cawangan:</span> {user.branch}</div>}
                      {user.state && <div><span className="font-semibold">Negeri:</span> {user.state}</div>}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(user.id)}
                    className="text-red-500 hover:text-red-700 ml-4"
                    title="Padam"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
