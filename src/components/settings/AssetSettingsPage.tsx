import React, { useCallback, useEffect, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { assetSettingsApi } from '../../services/api';

interface AssetSettingsPageProps {
  onBack: () => void;
}

interface SettingOption {
  id: number;
  value: string;
}

export const AssetSettingsPage: React.FC<AssetSettingsPageProps> = ({ onBack }) => {
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<SettingOption[]>([]);
  const [brands, setBrands] = useState<SettingOption[]>([]);

  const [newCategory, setNewCategory] = useState('');
  const [newBrand, setNewBrand] = useState('');

  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [editingCategoryValue, setEditingCategoryValue] = useState('');
  const [editingBrandId, setEditingBrandId] = useState<number | null>(null);
  const [editingBrandValue, setEditingBrandValue] = useState('');

  const [workingKey, setWorkingKey] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const response = await assetSettingsApi.getAll(true);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Gagal memuatkan tetapan aset');
      }

      const data: any = response.data;
      setCategories(Array.isArray(data.categoryOptions) ? data.categoryOptions.map((item: any) => ({ id: Number(item.id), value: String(item.value) })) : []);
      setBrands(Array.isArray(data.brandOptions) ? data.brandOptions.map((item: any) => ({ id: Number(item.id), value: String(item.value) })) : []);
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Gagal memuatkan tetapan aset.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleCreateCategory = async () => {
    const value = newCategory.trim();
    if (!value) return;

    setWorkingKey('category-create');
    setMessage(null);
    try {
      const response = await assetSettingsApi.createCategory(value);
      if (!response.success || !response.data) throw new Error(response.error || 'Gagal tambah kategori aset');
      const item: any = response.data;
      setCategories(prev => [...prev, { id: Number(item.id), value: String(item.value) }]);
      setNewCategory('');
      setMessage({ type: 'success', text: 'Kategori aset berjaya ditambah.' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Gagal tambah kategori aset.' });
    } finally {
      setWorkingKey(null);
    }
  };

  const handleCreateBrand = async () => {
    const value = newBrand.trim();
    if (!value) return;

    setWorkingKey('brand-create');
    setMessage(null);
    try {
      const response = await assetSettingsApi.createBrand(value);
      if (!response.success || !response.data) throw new Error(response.error || 'Gagal tambah brand aset');
      const item: any = response.data;
      setBrands(prev => [...prev, { id: Number(item.id), value: String(item.value) }]);
      setNewBrand('');
      setMessage({ type: 'success', text: 'Brand aset berjaya ditambah.' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Gagal tambah brand aset.' });
    } finally {
      setWorkingKey(null);
    }
  };

  const handleUpdateCategory = async () => {
    if (!editingCategoryId) return;
    const value = editingCategoryValue.trim();
    if (!value) return;

    setWorkingKey(`category-edit-${editingCategoryId}`);
    setMessage(null);
    try {
      const response = await assetSettingsApi.updateCategory(editingCategoryId, value);
      if (!response.success || !response.data) throw new Error(response.error || 'Gagal kemaskini kategori aset');

      setCategories(prev => prev.map(item => item.id === editingCategoryId ? { ...item, value } : item));
      setEditingCategoryId(null);
      setEditingCategoryValue('');
      setMessage({ type: 'success', text: 'Kategori aset berjaya dikemaskini.' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Gagal kemaskini kategori aset.' });
    } finally {
      setWorkingKey(null);
    }
  };

  const handleUpdateBrand = async () => {
    if (!editingBrandId) return;
    const value = editingBrandValue.trim();
    if (!value) return;

    setWorkingKey(`brand-edit-${editingBrandId}`);
    setMessage(null);
    try {
      const response = await assetSettingsApi.updateBrand(editingBrandId, value);
      if (!response.success || !response.data) throw new Error(response.error || 'Gagal kemaskini brand aset');

      setBrands(prev => prev.map(item => item.id === editingBrandId ? { ...item, value } : item));
      setEditingBrandId(null);
      setEditingBrandValue('');
      setMessage({ type: 'success', text: 'Brand aset berjaya dikemaskini.' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Gagal kemaskini brand aset.' });
    } finally {
      setWorkingKey(null);
    }
  };

  const handleDeleteBrand = async (id: number) => {
    setWorkingKey(`brand-delete-${id}`);
    setMessage(null);
    try {
      const response = await assetSettingsApi.deleteBrand(id);
      if (!response.success) throw new Error(response.error || 'Gagal padam brand aset');
      setBrands(prev => prev.filter(item => item.id !== id));
      setMessage({ type: 'success', text: 'Brand aset berjaya dipadam.' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Gagal padam brand aset.' });
    } finally {
      setWorkingKey(null);
    }
  };

  if (loading) {
    return <div className="p-6 text-sm text-gray-600">Memuatkan tetapan aset...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full">
          <ChevronLeft className="h-6 w-6 text-gray-600" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Tetapan Aset</h1>
      </div>

      {message && (
        <div className={`p-3 rounded-md text-sm ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
          <h2 className="text-lg font-semibold text-gray-800">Kategori Aset</h2>
          <div className="text-xs text-gray-600">
            Kategori aset tidak boleh dipadam.
          </div>
          <div className="flex gap-2">
            <Input id="new-asset-category" label="" placeholder="Tambah kategori aset" value={newCategory} onChange={e => setNewCategory(e.target.value)} />
            <Button onClick={handleCreateCategory} className="h-10 self-end" disabled={workingKey === 'category-create'}>Tambah</Button>
          </div>
          <div className="space-y-2">
            {categories.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-2 p-2 bg-gray-50 rounded border">
                {editingCategoryId === item.id ? (
                  <div className="flex items-center gap-2 w-full">
                    <input className="w-full px-2 py-1 border rounded" value={editingCategoryValue} onChange={e => setEditingCategoryValue(e.target.value)} />
                    <Button size="sm" onClick={handleUpdateCategory} disabled={workingKey === `category-edit-${item.id}`}>Simpan</Button>
                  </div>
                ) : (
                  <>
                    <span className="text-sm text-gray-800">{item.value}</span>
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => { setEditingCategoryId(item.id); setEditingCategoryValue(item.value); }}>Edit</Button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
          <h2 className="text-lg font-semibold text-gray-800">Brand Aset</h2>
          <div className="flex gap-2">
            <Input id="new-asset-brand" label="" placeholder="Tambah brand aset" value={newBrand} onChange={e => setNewBrand(e.target.value)} />
            <Button onClick={handleCreateBrand} className="h-10 self-end" disabled={workingKey === 'brand-create'}>Tambah</Button>
          </div>
          <div className="space-y-2">
            {brands.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-2 p-2 bg-gray-50 rounded border">
                {editingBrandId === item.id ? (
                  <div className="flex items-center gap-2 w-full">
                    <input className="w-full px-2 py-1 border rounded" value={editingBrandValue} onChange={e => setEditingBrandValue(e.target.value)} />
                    <Button size="sm" onClick={handleUpdateBrand} disabled={workingKey === `brand-edit-${item.id}`}>Simpan</Button>
                  </div>
                ) : (
                  <>
                    <span className="text-sm text-gray-800">{item.value}</span>
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => { setEditingBrandId(item.id); setEditingBrandValue(item.value); }}>Edit</Button>
                      <Button size="sm" variant="danger" onClick={() => handleDeleteBrand(item.id)} disabled={workingKey === `brand-delete-${item.id}`}>Padam</Button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={loadSettings} disabled={loading || workingKey !== null}>Muat Semula Tetapan</Button>
      </div>
    </div>
  );
};
