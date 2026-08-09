import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Project } from '../types';
import { projectsApi } from '../services/api';
import { Button } from './ui/Button';

export const ProjectViewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProject = async () => {
      if (!id) {
        setError('ID projek tidak sah.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await projectsApi.getById(Number(id));
        if (!response.success || !response.data) {
          setError(response.error || 'Gagal memuatkan projek.');
          return;
        }

        setProject(response.data as Project);
      } catch {
        setError('Ralat semasa memuatkan projek.');
      } finally {
        setLoading(false);
      }
    };

    fetchProject();
  }, [id]);

  if (loading) {
    return <div className="bg-white rounded-lg shadow-md p-6">Memuatkan projek...</div>;
  }

  if (error || !project) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <p className="text-red-700">{error || 'Projek tidak ditemui.'}</p>
        <div className="mt-4">
          <Button variant="secondary" onClick={() => navigate('/projects')}>Kembali ke Senarai</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="px-6 py-4 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Paparan Projek</h2>
          <p className="text-sm text-gray-600 mt-1">Butiran lengkap projek.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => navigate('/projects')}>Kembali</Button>
          <Button onClick={() => navigate(`/projects/${project.id}/edit`)}>Edit</Button>
        </div>
      </div>

      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div><span className="font-semibold text-gray-700">Kod:</span> {project.code}</div>
        <div><span className="font-semibold text-gray-700">Status:</span> {project.status}</div>
        <div className="md:col-span-2"><span className="font-semibold text-gray-700">Nama Projek:</span> {project.name}</div>
        <div className="md:col-span-2"><span className="font-semibold text-gray-700">Klien:</span> {project.client_name || '-'}</div>
        <div className="md:col-span-2"><span className="font-semibold text-gray-700">Main-Con:</span> {project.mainCon?.name || '-'}</div>
        <div><span className="font-semibold text-gray-700">Tarikh Mula:</span> {project.start_date ? String(project.start_date).slice(0, 10) : '-'}</div>
        <div><span className="font-semibold text-gray-700">Tarikh Tamat:</span> {project.end_date ? String(project.end_date).slice(0, 10) : '-'}</div>
        <div><span className="font-semibold text-gray-700">Bajet:</span> {project.budget !== undefined && project.budget !== null ? `RM ${Number(project.budget).toFixed(2)}` : '-'}</div>
        <div><span className="font-semibold text-gray-700">Dicipta Oleh:</span> {project.creator?.name || '-'}</div>
        <div className="md:col-span-2"><span className="font-semibold text-gray-700">Penerangan:</span> {project.description || '-'}</div>
      </div>
    </div>
  );
};
