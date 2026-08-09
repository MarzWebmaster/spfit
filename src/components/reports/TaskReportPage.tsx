import React, { useState, useMemo } from 'react';
import type { Task } from '../../types';
import { TaskStatus, MalaysianState } from '../../types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Badge } from '../ui/Badge';

interface TaskReportPageProps {
  tasks: Task[];
  onBack: () => void;
}

const BarChart: React.FC<{ data: { label: string, value: number, color: string }[] }> = ({ data }) => {
  const maxValue = Math.max(...data.map(d => d.value), 0);
  return (
    <div className="flex justify-around items-end h-48 p-4 bg-gray-50 rounded-lg">
      {data.map(item => (
        <div key={item.label} className="flex flex-col items-center w-1/5">
          <div 
            className="w-full rounded-t-md" 
            style={{ height: `${maxValue > 0 ? (item.value / maxValue) * 100 : 0}%`, backgroundColor: item.color }}
            title={`${item.label}: ${item.value}`}
          ></div>
          <div className="text-xs text-center mt-2 text-gray-600 font-medium">{item.label} ({item.value})</div>
        </div>
      ))}
    </div>
  );
};

export const TaskReportPage: React.FC<TaskReportPageProps> = ({ tasks, onBack }) => {
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    status: '',
    state: '',
    searchTerm: ''
  });

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFilters({ ...filters, [e.target.id]: e.target.value });
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const taskDate = new Date(task.deadline);
      const startDate = filters.startDate ? new Date(filters.startDate) : null;
      const endDate = filters.endDate ? new Date(filters.endDate) : null;
      
      if (startDate && taskDate < startDate) return false;
      if (endDate && taskDate > endDate) return false;
      if (filters.status && task.status !== filters.status) return false;
      if (filters.state && task.state !== filters.state) return false;
      if (filters.searchTerm && !task.title.toLowerCase().includes(filters.searchTerm.toLowerCase())) return false;
      
      return true;
    });
  }, [tasks, filters]);

  const statusCounts = useMemo(() => {
    const counts = {} as Record<TaskStatus, number>;
    Object.values(TaskStatus).forEach(s => counts[s] = 0);
    filteredTasks.forEach(task => {
        counts[task.status]++;
    });
    return counts;
  }, [filteredTasks]);

  const chartData = [
    { label: 'Baru', value: statusCounts.Baru, color: '#60a5fa' },
    { label: 'Dihantar', value: statusCounts['Tawaran Dihantar'], color: '#facc15' },
    { label: 'Diambil', value: statusCounts['Telah Diambil'], color: '#818cf8' },
    { label: 'Selesai', value: statusCounts.Selesai, color: '#c084fc' },
    { label: 'Dibayar', value: statusCounts['Telah Dibayar'], color: '#4ade80' },
  ];

  return (
    <div className="space-y-6">
       <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Laporan Analisis Tugasan</h2>
          <p className="mt-1 text-sm text-gray-600">Analisis metrik dan status untuk semua tugasan.</p>
        </div>
        <Button variant="secondary" onClick={onBack}>Kembali ke Hab Laporan</Button>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-md space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Input label="Tarikh Mula" id="startDate" type="date" value={filters.startDate} onChange={handleFilterChange} />
          <Input label="Tarikh Akhir" id="endDate" type="date" value={filters.endDate} onChange={handleFilterChange} />
          <Select label="Status" id="status" value={filters.status} onChange={handleFilterChange}>
            <option value="">Semua Status</option>
            {Object.values(TaskStatus).map(s => <option key={s} value={s}>{s}</option>)}
          </Select>
          <Select label="Negeri" id="state" value={filters.state} onChange={handleFilterChange}>
            <option value="">Semua Negeri</option>
            {Object.values(MalaysianState).map(s => <option key={s} value={s}>{s}</option>)}
          </Select>
          <Input label="Cari Tajuk Tugasan" id="searchTerm" placeholder="Cari..." value={filters.searchTerm} onChange={handleFilterChange} />
        </div>
      </div>
      
      <div className="bg-white p-4 rounded-lg shadow-md">
        <h3 className="font-semibold mb-4">Pecahan Tugasan Mengikut Status</h3>
        <BarChart data={chartData} />
      </div>

       <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tajuk</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Negeri</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tarikh Keperluan</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Harga (RM)</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredTasks.map(t => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{t.id}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{t.title}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{t.state}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{t.deadline}</td>
                  <td className="px-6 py-4 whitespace-nowrap"><Badge status={t.status} /></td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-800">{t.offerPrice.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredTasks.length === 0 && <p className="text-center text-gray-500 p-6">Tiada data ditemui untuk tapisan semasa.</p>}
      </div>
    </div>
  );
};