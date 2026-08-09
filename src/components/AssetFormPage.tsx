import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { Asset, Masterlist } from '../types';
import { AssetStatus } from '../types';
import { assetSettingsApi, assetsApi, masterlistsApi } from '../services/api';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Textarea } from './ui/Textarea';
import { AssetUserForm } from './AssetUserForm';

interface FormState {
  masterlist_id: number | '';
  asset_tag: string;
  name: string;
  category_id: number | '';
  brand_id: number | '';
  model: string;
  serial_number: string;
  group: string;
  status: AssetStatus;
  notes: string;
  custom_fields_values: Record<string, any>;
  attachments?: Array<{
    id: number;
    file_name: string;
    display_name?: string;
    file_path: string;
    file_type?: string;
    file_size?: number;
    created_at: string;
  }>;
  accessories: Array<{
    type: 'monitor' | 'keyboard' | 'mouse' | 'other';
    asset_id: number | '';
  }>;
}

interface AssetSettingOption {
  id: number;
  value: string;
}

const defaultFormState: FormState = {
  masterlist_id: '',
  asset_tag: '',
  name: '',
  category_id: '',
  brand_id: '',
  model: '',
  serial_number: '',
  group: '',
  status: AssetStatus.AKTIF,
  notes: '',
  custom_fields_values: {},
  accessories: []
};

export const AssetFormPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isEditMode = Boolean(id);

  const [formState, setFormState] = useState<FormState>({
    ...defaultFormState,
    masterlist_id: searchParams.get('masterlistId') ? Number(searchParams.get('masterlistId')) : ''
  });
  const [masterlists, setMasterlists] = useState<Masterlist[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<AssetSettingOption[]>([]);
  const [brandOptions, setBrandOptions] = useState<AssetSettingOption[]>([]);
  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [assetUsers, setAssetUsers] = useState<Asset['assetUsers']>([]);
  const [showAssetUsers, setShowAssetUsers] = useState(false);
  const [accessoryAssets, setAccessoryAssets] = useState<Array<Pick<Asset, 'id' | 'asset_tag' | 'name' | 'category' | 'parentAsset'>>>([]);

  const handleSuggestIntel = async () => {
    try {
      setInfo(null);
      setError(null);
      const modelText = formState.model.trim() || formState.name.trim();
      const serialText = formState.serial_number.trim();
      if (!modelText) {
        setError('Sila isi Model atau Nama Aset untuk cadangan AI.');
        return;
      }
      const res = await assetsApi.suggestIntel(modelText, serialText);
      const payload = (res as any)?.data;
      if (!res.success || !payload?.found) {
        setInfo('Tiada cadangan dijumpai untuk model ini.');
        return;
      }
      const intel = payload.intel;
      const nextCategoryId = intel?.category?.id ? Number(intel.category.id) : null;
      const nextBrandId = intel?.brand?.id ? Number(intel.brand.id) : null;
      setFormState((prev) => ({
        ...prev,
        category_id: prev.category_id || (nextCategoryId || ''),
        brand_id: prev.brand_id || (nextBrandId || '')
      }));
      setInfo(
        `Cadangan AI: ${intel?.category?.name || '-'} (${Number(intel?.category?.confidence || 0).toFixed(2)}), ` +
          `${intel?.brand?.name || '-'} (${Number(intel?.brand?.confidence || 0).toFixed(2)})`
      );
    } catch (e: any) {
      setError(e?.message || 'Gagal dapatkan cadangan AI.');
    }
  };

  const selectedMasterlist = useMemo(() => {
    if (!formState.masterlist_id) return null;
    return masterlists.find((masterlist) => masterlist.id === Number(formState.masterlist_id)) || null;
  }, [formState.masterlist_id, masterlists]);

  const selectedProjectLabel = selectedMasterlist?.project
    ? `${selectedMasterlist.project.code} - ${selectedMasterlist.project.name}`
    : '-';
  const selectedMainConLabel = selectedMasterlist?.project?.mainCon?.name || '-';
  const selectedClientLabel = selectedMasterlist?.project?.client_name || '-';
  const selectedCategoryValue = useMemo(() => {
    const id = formState.category_id ? Number(formState.category_id) : null;
    const found = id ? categoryOptions.find((c) => c.id === id) : null;
    return String(found?.value || '').trim().toLowerCase();
  }, [formState.category_id, categoryOptions]);

  const showAccessories = selectedCategoryValue === 'laptop' || selectedCategoryValue === 'desktop' || selectedCategoryValue === 'pc';

  useEffect(() => {
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

    const fetchAssetSettings = async () => {
      try {
        const response = await assetSettingsApi.getAll(true);
        if (!response.success || !response.data) return;

        const data = response.data as any;
        const categories = Array.isArray(data.categoryOptions)
          ? data.categoryOptions
              .map((item: any) => ({ id: Number(item.id), value: String(item.value || '').trim() }))
              .filter((item: AssetSettingOption) => Number.isFinite(item.id) && item.id > 0 && item.value)
          : [];
        const brands = Array.isArray(data.brandOptions)
          ? data.brandOptions
              .map((item: any) => ({ id: Number(item.id), value: String(item.value || '').trim() }))
              .filter((item: AssetSettingOption) => Number.isFinite(item.id) && item.id > 0 && item.value)
          : [];

        setCategoryOptions(categories);
        setBrandOptions(brands);
      } catch {
        setCategoryOptions([]);
        setBrandOptions([]);
      }
    };

    fetchMasterlists();
    fetchAssetSettings();
  }, []);

  useEffect(() => {
    const fetchAccessoryAssets = async () => {
      if (!formState.masterlist_id) {
        setAccessoryAssets([]);
        return;
      }

      try {
        const res = await assetsApi.getAll(1, 100, { masterlist_id: Number(formState.masterlist_id), sortBy: 'name', sort: 'asc' });
        if (!res.success || !res.data) {
          setAccessoryAssets([]);
          return;
        }
        const data = res.data as any;
        const rows = Array.isArray(data.assets) ? data.assets : Array.isArray(data) ? data : [];
        setAccessoryAssets(rows);
      } catch {
        setAccessoryAssets([]);
      }
    };

    fetchAccessoryAssets();
  }, [formState.masterlist_id]);

  useEffect(() => {
    const loadAsset = async () => {
      if (!id) return;

      setLoading(true);
      setError(null);

      try {
        const response = await assetsApi.getById(Number(id));
        if (!response.success || !response.data) {
          setError(response.error || 'Gagal memuatkan aset.');
          return;
        }

        const asset = response.data as Asset;
        setFormState({
          masterlist_id: asset.masterlist_id,
          asset_tag: asset.asset_tag || '',
          name: asset.name || '',
          category_id: asset.category_id ?? asset.categoryOption?.id ?? '',
          brand_id: asset.brand_id ?? asset.brandOption?.id ?? '',
          model: asset.model || '',
          serial_number: asset.serial_number || '',
          group: asset.group || '',
          status: asset.status || AssetStatus.AKTIF,
          notes: asset.notes || '',
          custom_fields_values: asset.custom_fields_values || {},
          accessories: Array.isArray(asset.accessories)
            ? asset.accessories
                .map((row) => ({
                  type: row.type,
                  asset_id: Number(row.asset_id) > 0 ? Number(row.asset_id) : ('' as const)
                }))
                .filter((row) => row.asset_id)
            : []
        });
        setAssetUsers(asset.assetUsers || []);
      } catch {
        setError('Ralat semasa memuatkan aset.');
      } finally {
        setLoading(false);
      }
    };

    loadAsset();
  }, [id]);

  const handleSave = async () => {
    if (!formState.masterlist_id || !formState.name.trim()) {
      setError('Masterlist dan nama aset wajib diisi.');
      return;
    }

    setInfo(null);

    if (!formState.serial_number.trim()) {
      setError('Sila masukkan nombor siri (Serial Number).');
      return;
    }

    const normalizeAccessories = () => {
      const rows = formState.accessories
        .map((row) => ({
          type: row.type,
          asset_id: row.asset_id ? Number(row.asset_id) : 0
        }))
        .filter((row) => Number.isFinite(row.asset_id) && row.asset_id > 0);
      return rows;
    };

    const validateAccessories = (): string | null => {
      if (!showAccessories) return null;
      const normalized = normalizeAccessories();
      const hasIncomplete = formState.accessories.some((r) => r.asset_id === '');
      if (hasIncomplete) return 'Sila pilih aset untuk setiap pilihan aset tambahan.';
      const ids = normalized.map((r) => r.asset_id);
      const unique = new Set(ids);
      if (unique.size !== ids.length) return 'Aset tambahan tidak boleh dipilih berulang.';
      const currentId = isEditMode ? Number(id) : null;
      if (currentId && ids.includes(currentId)) return 'Aset tambahan tidak boleh sama dengan aset semasa.';
      return null;
    };

    const accessoriesError = validateAccessories();
    if (accessoriesError) {
      setError(accessoriesError);
      return;
    }

    setSaving(true);
    setError(null);

      try {
        const payload = {
          masterlist_id: Number(formState.masterlist_id),
          asset_tag: formState.asset_tag.trim() || undefined,
          name: formState.name.trim(),
          category_id: formState.category_id ? Number(formState.category_id) : null,
          brand_id: formState.brand_id ? Number(formState.brand_id) : null,
          model: formState.model.trim() || undefined,
          serial_number: formState.serial_number.trim() || undefined,
          group: formState.group.trim() || undefined,
          status: formState.status,
          notes: formState.notes.trim() || undefined,
          custom_fields_values: Object.keys(formState.custom_fields_values).length > 0 ? formState.custom_fields_values : undefined,
          accessories: showAccessories ? normalizeAccessories().map((r) => ({ type: r.type, asset_id: r.asset_id })) : undefined
        };

      const response = isEditMode
        ? await assetsApi.update(Number(id), payload)
        : await assetsApi.create(payload);

      if (!response.success) {
        setError(response.error || 'Gagal menyimpan aset.');
        return;
      }

      navigate('/assets');
    } catch {
      setError('Ralat semasa menyimpan aset.');
    } finally {
      setSaving(false);
    }
  };

  const handleUserAdded = async () => {
    if (!id) return;

    try {
      const response = await assetsApi.getById(Number(id));
      if (response.success && response.data) {
        const asset = response.data as Asset;
        setAssetUsers(asset.assetUsers || []);
      }
    } catch {
      // Keep the existing list if refresh fails.
    }
  };

  if (loading) {
    return <div className="bg-white rounded-lg shadow-md p-6">Memuatkan borang aset...</div>;
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="px-6 py-4 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">{isEditMode ? 'Kemaskini Aset' : 'Tambah Aset'}</h2>
          <p className="text-sm text-gray-600 mt-1">Aset terikat kepada masterlist.</p>
        </div>
        <Button variant="secondary" onClick={() => navigate('/assets')}>Kembali</Button>
      </div>

      <div className="p-6 space-y-4">
        {error && (
          <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {info && (
          <div className="rounded-md bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800">
            {info}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Select
            label="Masterlist"
            value={formState.masterlist_id}
            onChange={(e) => setFormState((prev) => ({ ...prev, masterlist_id: e.target.value ? Number(e.target.value) : '' }))}
          >
            <option value="">Pilih Masterlist</option>
            {masterlists.map((masterlist) => (
              <option key={masterlist.id} value={masterlist.id}>
                {masterlist.code} - {masterlist.name}
              </option>
            ))}
          </Select>

          <Input
            label="Projek"
            value={selectedProjectLabel}
            readOnly
            disabled
          />

          <Input
            label="Main-Con"
            value={selectedMainConLabel}
            readOnly
            disabled
          />

          <Input
            label="Client"
            value={selectedClientLabel}
            readOnly
            disabled
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Tag Aset"
            value={formState.asset_tag}
            onChange={(e) => setFormState((prev) => ({ ...prev, asset_tag: e.target.value }))}
            placeholder="Contoh: AST-0001"
          />
          <Select
            label="Status"
            options={[
              { label: AssetStatus.AKTIF, value: AssetStatus.AKTIF },
              { label: AssetStatus.TIDAK_AKTIF, value: AssetStatus.TIDAK_AKTIF },
              { label: AssetStatus.ROSAK, value: AssetStatus.ROSAK },
              { label: AssetStatus.LUPUS, value: AssetStatus.LUPUS }
            ]}
            value={formState.status}
            onChange={(e) => setFormState((prev) => ({ ...prev, status: e.target.value as AssetStatus }))}
          />
        </div>

        <Input
          label="Nama Aset"
          value={formState.name}
          onChange={(e) => setFormState((prev) => ({ ...prev, name: e.target.value }))}
          placeholder="Nama aset"
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Select
            label="Kategori"
            value={formState.category_id}
            onChange={(e) => setFormState((prev) => ({ ...prev, category_id: e.target.value ? Number(e.target.value) : '' }))}
          >
            <option value="">Pilih kategori</option>
            {categoryOptions.map((category) => (
              <option key={category.id} value={category.id}>{category.value}</option>
            ))}
          </Select>
          <Select
            label="Jenama"
            value={formState.brand_id}
            onChange={(e) => setFormState((prev) => ({ ...prev, brand_id: e.target.value ? Number(e.target.value) : '' }))}
          >
            <option value="">Pilih brand</option>
            {brandOptions.map((brand) => (
              <option key={brand.id} value={brand.id}>{brand.value}</option>
            ))}
          </Select>
          <Input
            label="Model"
            value={formState.model}
            onChange={(e) => setFormState((prev) => ({ ...prev, model: e.target.value }))}
            placeholder="Opsyenal"
          />
        </div>

        <div className="flex justify-end">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleSuggestIntel}
            disabled={saving || loading}
          >
            Auto isi Jenama/Kategori
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Serial Number *"
            value={formState.serial_number}
            onChange={(e) => setFormState((prev) => ({ ...prev, serial_number: e.target.value }))}
            placeholder="Wajib"
            required
          />
          <Input
            label="Kumpulan"
            value={formState.group}
            onChange={(e) => setFormState((prev) => ({ ...prev, group: e.target.value }))}
            placeholder="Opsyenal"
          />
        </div>

        {showAccessories && (
          <div className="rounded-lg border border-gray-200 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-gray-800">Pilihan Aset Tambahan</h3>
                <p className="text-sm text-gray-600">Pair aset ini dengan satu atau lebih aset lain (monitor, keyboard, mouse, lain-lain).</p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() =>
                  setFormState((prev) => ({
                    ...prev,
                    accessories: [...prev.accessories, { type: 'monitor', asset_id: '' }]
                  }))
                }
                disabled={!formState.masterlist_id}
              >
                +
              </Button>
            </div>

            {formState.accessories.length > 0 && (
              <div className="space-y-2">
                {formState.accessories.map((row, idx) => {
                  const currentId = isEditMode ? Number(id) : null;
                  const usedIds = new Set(
                    formState.accessories
                      .map((r, i) => (i === idx ? null : r.asset_id ? Number(r.asset_id) : null))
                      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0)
                  );
                  const options = accessoryAssets
                    .filter((a) => (currentId ? a.id !== currentId : true))
                    .filter((a) => !a.parentAsset || a.parentAsset.parent_asset_id === currentId) // Tapis: hanya ambil aset yang belum dipair dengan orang lain, ATAU yang sedang dipair dengan aset ini
                    .filter((a) => !usedIds.has(a.id));

                  return (
                    <div key={`${row.type}-${idx}`} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
                      <div className="md:col-span-4">
                        <Select
                          label="Jenis"
                          value={row.type}
                          options={[
                            { label: 'Monitor', value: 'monitor' },
                            { label: 'Keyboard', value: 'keyboard' },
                            { label: 'Mouse', value: 'mouse' },
                            { label: 'Lain-lain', value: 'other' }
                          ]}
                          onChange={(e) =>
                            setFormState((prev) => ({
                              ...prev,
                              accessories: prev.accessories.map((r, i) => (i === idx ? { ...r, type: e.target.value as any } : r))
                            }))
                          }
                        />
                      </div>
                      <div className="md:col-span-7">
                        <Select
                          label="Aset"
                          value={row.asset_id}
                          onChange={(e) =>
                            setFormState((prev) => ({
                              ...prev,
                              accessories: prev.accessories.map((r, i) => (i === idx ? { ...r, asset_id: e.target.value ? Number(e.target.value) : '' } : r))
                            }))
                          }
                        >
                          <option value="">Pilih aset</option>
                          {options.map((a) => (
                            <option key={a.id} value={a.id}>
                              {(a.asset_tag ? `${a.asset_tag} - ` : '') + (a.name || `Aset #${a.id}`)}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div className="md:col-span-1 flex justify-end">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            setFormState((prev) => ({
                              ...prev,
                              accessories: prev.accessories.filter((_, i) => i !== idx)
                            }))
                          }
                        >
                          &times;
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <Textarea
          label="Catatan"
          value={formState.notes}
          onChange={(e) => setFormState((prev) => ({ ...prev, notes: e.target.value }))}
          placeholder="Catatan aset"
          rows={4}
        />

        <div className="rounded-lg border border-gray-200 p-4 space-y-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-base font-semibold text-gray-800">Pengguna Aset</h3>
              <p className="text-sm text-gray-600">
                {isEditMode
                  ? 'Tambah pengguna yang sedang menggunakan aset ini.'
                  : 'Simpan aset dahulu sebelum tambah pengguna aset.'}
              </p>
            </div>
            <Button
              variant="secondary"
              onClick={() => setShowAssetUsers((prev) => !prev)}
              disabled={!isEditMode}
            >
              {showAssetUsers ? 'Sembunyi Pengguna' : 'Tambah Pengguna'}
            </Button>
          </div>

          {isEditMode && showAssetUsers && id && (
            <AssetUserForm
              assetId={Number(id)}
              assetUsers={assetUsers}
              onUserAdded={handleUserAdded}
            />
          )}
        </div>
        </div>

        <div className="rounded-lg border border-gray-200 p-4 space-y-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-base font-semibold text-gray-800">Lampiran Aset</h3>
              <p className="text-sm text-gray-600">
                Muat naik dokumen berkaitan dengan aset ini (PDF, imej, dll.)
              </p>
            </div>
            <input
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif,.webp,.csv,.xls,.xlsx"
              onChange={async (e) => {
                const files = e.target.files;
                if (!files || files.length === 0) return;

                try {
                  const formData = new FormData();
                  for (let i = 0; i < files.length; i++) {
                    formData.append('attachments', files[i]);
                  }

                  const response = await assetsApi.uploadAttachments(Number(id), formData);
                  if (response.success) {
                    // Refresh asset data to show new attachments
                    const updatedResponse = await assetsApi.getById(Number(id));
                    if (updatedResponse.success && updatedResponse.data) {
                      const asset = updatedResponse.data as Asset;
                      setFormState(prev => ({
                        ...prev,
                        ...asset
                      }));
                    }
                    setInfo(`${files.length} lampiran berjaya dimuat naik`);
                  } else {
                    setError(response.error || 'Gagal memuat naik lampiran');
                  }
                } catch (error: any) {
                  setError(error?.message || 'Ralat semasa memuat naik lampiran');
                }
              }}
              className="hidden"
              id="attachment-upload"
            />
            <label
              htmlFor="attachment-upload"
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 cursor-pointer"
            >
              Muat Naik Lampiran
            </label>
          </div>

          {formState.attachments && formState.attachments.length > 0 && (
            <div className="space-y-2">
              {formState.attachments.map((attachment) => (
                <div key={attachment.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-gray-50 rounded-md">
                  <div className="flex items-start gap-2 min-w-0 flex-1">
                    <svg className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <div className="min-w-0 flex-1">
                      <input
                        type="text"
                        defaultValue={attachment.display_name || ''}
                        placeholder={attachment.file_name}
                        onBlur={async (e) => {
                          const val = e.target.value.trim();
                          const displayName = val || undefined;
                          // Update local state
                          const updated = formState.attachments?.map(a =>
                            a.id === attachment.id ? { ...a, display_name: displayName } : a
                          );
                          setFormState(prev => ({ ...prev, attachments: updated }));
                          // Save to backend
                          if (displayName !== attachment.display_name) {
                            try {
                              await assetsApi.updateAttachment(Number(id), attachment.id, val);
                            } catch {
                              // Silent fail - value kept in local state
                            }
                          }
                        }}
                        onChange={(e) => {
                          const val = e.target.value.trim();
                          const updated = formState.attachments?.map(a =>
                            a.id === attachment.id ? { ...a, display_name: val || undefined } : a
                          );
                          setFormState(prev => ({ ...prev, attachments: updated }));
                        }}
                        className="w-full text-sm font-medium text-gray-800 bg-transparent border-0 border-b border-gray-300 focus:border-indigo-500 focus:outline-none px-0 py-1"
                      />
                      {!attachment.display_name && (
                        <p className="text-xs text-gray-400 truncate mt-0.5">{attachment.file_name}</p>
                      )}
                      <p className="text-xs text-gray-500 mt-0.5">
                        {attachment.file_type || 'Unknown'} {attachment.file_size ? `· ${(attachment.file_size / 1024).toFixed(1)} KB` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => window.open(attachment.file_path, '_blank')}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-md"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      Lihat
                    </button>
                    <a
                      href={attachment.file_path}
                      download={attachment.display_name || attachment.file_name}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-md"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                      Muat Turun
                    </a>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!confirm('Adakah anda pasti mahu memadam lampiran ini?')) return;

                        try {
                          const response = await assetsApi.deleteAttachment(Number(id), attachment.id);
                          if (response.success) {
                            // Refresh asset data to remove attachment
                            const updatedResponse = await assetsApi.getById(Number(id));
                            if (updatedResponse.success && updatedResponse.data) {
                              const asset = updatedResponse.data as Asset;
                              setFormState(prev => ({
                                ...prev,
                                ...asset
                              }));
                            }
                            setInfo('Lampiran berjaya dipadam');
                          } else {
                            setError(response.error || 'Gagal memadam lampiran');
                          }
                        } catch (error: any) {
                          setError(error?.message || 'Ralat semasa memadam lampiran');
                        }
                      }}
                      className="text-red-600 hover:text-red-900 text-sm"
                    >
                      Padam
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-2">
        <Button variant="secondary" onClick={() => navigate('/assets')}>Batal</Button>
        <Button onClick={handleSave} disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan'}</Button>
      </div>
    </div>
  );
};
