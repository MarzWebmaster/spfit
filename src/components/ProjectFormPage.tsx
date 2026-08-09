import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { MainCon, Project } from '../types';
import { ProjectStatus } from '../types';
import { mainConsApi, projectsApi } from '../services/api';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Textarea } from './ui/Textarea';

interface ProjectFormState {
  code: string;
  name: string;
  client_name: string;
  description: string;
  status: ProjectStatus;
  main_con_id: number | '';
  start_date: string;
  end_date: string;
  budget: string;
}

const defaultFormState: ProjectFormState = {
  code: '',
  name: '',
  client_name: '',
  description: '',
  status: ProjectStatus.AKTIF,
  main_con_id: '',
  start_date: '',
  end_date: '',
  budget: ''
};

export const ProjectFormPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditMode = Boolean(id);

  const [formState, setFormState] = useState<ProjectFormState>(defaultFormState);
  const [mainCons, setMainCons] = useState<MainCon[]>([]);
  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadMainCons = async () => {
      try {
        const response = await mainConsApi.getAll();
        if (!response.success || !response.data) return;

        const rows = response.data as any[];
        const normalized = rows.map((item: any) => ({
          id: item.id,
          name: item.name,
          contactPerson: item.contactPerson ?? item.contact_person ?? '',
          contactNumber: item.contactNumber ?? item.contact_number ?? '',
          email: item.email ?? '',
          address: item.address ?? '',
          isActive: item.isActive ?? item.is_active ?? true
        }));
        setMainCons(normalized);
      } catch {
        setMainCons([]);
      }
    };

    loadMainCons();
  }, []);

  useEffect(() => {
    const loadProject = async () => {
      if (!id) return;

      setLoading(true);
      setError(null);

      try {
        const response = await projectsApi.getById(Number(id));
        if (!response.success || !response.data) {
          setError(response.error || 'Gagal memuatkan projek.');
          return;
        }

        const project = response.data as Project;
        setFormState({
          code: project.code || '',
          name: project.name || '',
          client_name: project.client_name || '',
          description: project.description || '',
          status: project.status || ProjectStatus.AKTIF,
          main_con_id: project.main_con_id ?? project.mainCon?.id ?? '',
          start_date: project.start_date ? String(project.start_date).slice(0, 10) : '',
          end_date: project.end_date ? String(project.end_date).slice(0, 10) : '',
          budget: project.budget !== undefined && project.budget !== null ? String(project.budget) : ''
        });
      } catch {
        setError('Ralat semasa memuatkan projek.');
      } finally {
        setLoading(false);
      }
    };

    loadProject();
  }, [id]);

  const handleSave = async () => {
    if (!formState.code.trim() || !formState.name.trim()) {
      setError('Kod projek dan nama projek wajib diisi.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = {
        code: formState.code.trim(),
        name: formState.name.trim(),
        client_name: formState.client_name.trim() || undefined,
        description: formState.description.trim() || undefined,
        status: formState.status,
        main_con_id: formState.main_con_id || undefined,
        start_date: formState.start_date || undefined,
        end_date: formState.end_date || undefined,
        budget: formState.budget ? Number(formState.budget) : undefined
      };

      const response = isEditMode
        ? await projectsApi.update(Number(id), payload)
        : await projectsApi.create(payload);

      if (!response.success) {
        setError(response.error || 'Gagal menyimpan projek.');
        return;
      }

      navigate('/projects');
    } catch {
      setError('Ralat semasa menyimpan projek.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="bg-white rounded-lg shadow-md p-6">Memuatkan borang projek...</div>;
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="px-6 py-4 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">{isEditMode ? 'Kemaskini Projek' : 'Tambah Projek'}</h2>
          <p className="text-sm text-gray-600 mt-1">Isi maklumat projek dan simpan.</p>
        </div>
        <Button variant="secondary" onClick={() => navigate('/projects')}>Kembali</Button>
      </div>

      <div className="p-6 space-y-4">
        {error && (
          <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Kod Projek"
            value={formState.code}
            onChange={(e) => setFormState((prev) => ({ ...prev, code: e.target.value }))}
            placeholder="Contoh: PRJ-006"
          />
          <Select
            label="Status"
            options={[
              { label: ProjectStatus.AKTIF, value: ProjectStatus.AKTIF },
              { label: ProjectStatus.SELESAI, value: ProjectStatus.SELESAI },
              { label: ProjectStatus.DIBATALKAN, value: ProjectStatus.DIBATALKAN }
            ]}
            value={formState.status}
            onChange={(e) => setFormState((prev) => ({ ...prev, status: e.target.value as ProjectStatus }))}
          />
        </div>

        <Select
          label="Main-Con (Opsyenal)"
          value={formState.main_con_id}
          onChange={(e) => setFormState((prev) => ({ ...prev, main_con_id: e.target.value ? Number(e.target.value) : '' }))}
        >
          <option value="">Pilih Main-Con</option>
          {mainCons.map((mainCon) => (
            <option key={mainCon.id} value={mainCon.id}>{mainCon.name}</option>
          ))}
        </Select>

        <Input
          label="Nama Projek"
          value={formState.name}
          onChange={(e) => setFormState((prev) => ({ ...prev, name: e.target.value }))}
          placeholder="Nama projek"
        />

        <Input
          label="Nama Klien"
          value={formState.client_name}
          onChange={(e) => setFormState((prev) => ({ ...prev, client_name: e.target.value }))}
          placeholder="Opsyenal"
        />

        <Textarea
          label="Penerangan"
          value={formState.description}
          onChange={(e) => setFormState((prev) => ({ ...prev, description: e.target.value }))}
          placeholder="Ringkasan projek"
          rows={4}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Tarikh Mula"
            type="date"
            value={formState.start_date}
            onChange={(e) => setFormState((prev) => ({ ...prev, start_date: e.target.value }))}
          />
          <Input
            label="Tarikh Tamat"
            type="date"
            value={formState.end_date}
            onChange={(e) => setFormState((prev) => ({ ...prev, end_date: e.target.value }))}
          />
        </div>

        <Input
          label="Bajet (RM)"
          type="number"
          min="0"
          step="0.01"
          value={formState.budget}
          onChange={(e) => setFormState((prev) => ({ ...prev, budget: e.target.value }))}
          placeholder="Contoh: 2500.00"
        />
      </div>

      <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-2">
        <Button variant="secondary" onClick={() => navigate('/projects')}>Batal</Button>
        <Button onClick={handleSave} disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan'}</Button>
      </div>
    </div>
  );
};
