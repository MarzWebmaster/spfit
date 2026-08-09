import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Project } from '../types';
import { ProjectStatus } from '../types';
import { projectsApi } from '../services/api';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';

export const ProjectsPage: React.FC = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);

  const totalPages = useMemo(() => Math.max(Math.ceil(total / limit), 1), [total, limit]);

  const fetchProjects = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await projectsApi.getAll(page, limit, {
        q: query || undefined,
        status: statusFilter || undefined,
        sortBy: 'created_at',
        sort: 'desc'
      });

      if (!response.success || !response.data) {
        setError(response.error || 'Gagal memuatkan data projek.');
        return;
      }

      const data = response.data as any;
      const rows = Array.isArray(data.projects) ? data.projects : [];
      setProjects(rows);
      setTotal(Number(data.pagination?.total || rows.length));
    } catch {
      setError('Ralat semasa memuatkan data projek.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProjects();
    }, 250);

    return () => clearTimeout(timer);
  }, [page, query, statusFilter]);

  const handleDelete = async (project: Project) => {
    const confirmed = window.confirm(`Padam projek ${project.code} - ${project.name}?`);
    if (!confirmed) return;

    setLoading(true);
    setError(null);

    try {
      const response = await projectsApi.delete(project.id);
      if (!response.success) {
        setError(response.error || 'Gagal memadam projek.');
        return;
      }

      if (projects.length === 1 && page > 1) {
        setPage(page - 1);
      } else {
        await fetchProjects();
      }
    } catch {
      setError('Ralat semasa memadam projek.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white shadow-md rounded-lg overflow-hidden">
      <div className="p-4 sm:p-6 border-b">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Senarai Projek</h2>
            <p className="mt-1 text-sm text-gray-600">Urus data projek dan kemaskini status projek semasa.</p>
          </div>
          <Button onClick={() => navigate('/projects/create')}>Tambah Projek</Button>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <Input
            type="search"
            placeholder="Cari kod / nama / klien"
            value={query}
            onChange={(e) => {
              setPage(1);
              setQuery(e.target.value);
            }}
          />
          <Select
            options={[
              { label: 'Semua Status', value: '' },
              { label: ProjectStatus.AKTIF, value: ProjectStatus.AKTIF },
              { label: ProjectStatus.SELESAI, value: ProjectStatus.SELESAI },
              { label: ProjectStatus.DIBATALKAN, value: ProjectStatus.DIBATALKAN }
            ]}
            value={statusFilter}
            onChange={(e) => {
              setPage(1);
              setStatusFilter(e.target.value);
            }}
          />
          <div className="flex items-end justify-end text-sm text-gray-600">
            Jumlah Projek: <span className="ml-1 font-semibold">{total}</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="mx-4 mt-4 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-x-auto relative min-h-[160px]">
        {loading && (
          <div className="absolute inset-0 bg-white/50 flex items-center justify-center z-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        )}

        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kod</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama Projek</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Klien</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mula / Tamat</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bajet</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Tindakan</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {projects.map((project) => (
              <tr key={project.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  <button
                    type="button"
                    onClick={() => navigate(`/projects/${project.id}`)}
                    className="text-indigo-700 hover:text-indigo-900 hover:underline"
                  >
                    {project.code}
                  </button>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => navigate(`/projects/${project.id}`)}
                    className="text-sm font-medium text-indigo-700 hover:text-indigo-900 hover:underline text-left"
                  >
                    {project.name}
                  </button>
                  <div className="text-xs text-gray-500">{project.description || '-'}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{project.client_name || '-'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{project.status}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                  {(project.start_date ? String(project.start_date).slice(0, 10) : '-')}
                  {' / '}
                  {(project.end_date ? String(project.end_date).slice(0, 10) : '-')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                  {project.budget !== undefined && project.budget !== null ? `RM ${Number(project.budget).toFixed(2)}` : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="secondary" onClick={() => navigate(`/projects/${project.id}/edit`)}>Edit</Button>
                    <Button size="sm" variant="danger" onClick={() => handleDelete(project)}>Padam</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!loading && projects.length === 0 && (
          <div className="p-8 text-center text-sm text-gray-500">Tiada data projek ditemui.</div>
        )}
      </div>

      <div className="px-4 py-3 border-t bg-gray-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="text-sm text-gray-600">Halaman {page} / {totalPages}</div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setPage((p) => Math.max(p - 1, 1))} disabled={page <= 1}>Sebelumnya</Button>
          <Button variant="secondary" size="sm" onClick={() => setPage((p) => Math.min(p + 1, totalPages))} disabled={page >= totalPages}>Seterusnya</Button>
        </div>
      </div>
    </div>
  );
};
