import React, { useState, useMemo } from 'react';
import type { Freelancer, Task } from '../../types';
import { MalaysianState, Skill } from '../../types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { StatCard } from '../ui/StatCard';
import { ICONS } from '../ui/icons';

interface FreelancerReportPageProps {
  freelancers: Freelancer[];
  tasks: Task[];
  onBack: () => void;
}

export const FreelancerReportPage: React.FC<FreelancerReportPageProps> = ({ freelancers, tasks, onBack }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterState, setFilterState] = useState('');
  const [filterSkill, setFilterSkill] = useState('');

  const freelancerStats = useMemo(() => {
    return freelancers.map(f => {
      const assignedTasks = tasks.filter(t => t.assignedTo === f.id);
      const completedTasks = assignedTasks.filter(t => t.status === 'Telah Dibayar' || t.status === 'Selesai' || t.status === 'Borang Disemak & Pembayaran Tertunggak');
      const totalEarnings = assignedTasks.filter(t => t.status === 'Telah Dibayar').reduce((sum, task) => sum + task.offerPrice, 0);
      return {
        ...f,
        tasksAssigned: assignedTasks.length,
        tasksCompleted: completedTasks.length,
        totalEarnings,
      };
    });
  }, [freelancers, tasks]);

  const filteredFreelancers = useMemo(() => {
    return freelancerStats.filter(f => {
      const searchMatch = f.name.toLowerCase().includes(searchTerm.toLowerCase());
      const stateMatch = filterState ? f.locations.some(l => l.state === filterState) : true;
      const skillMatch = filterSkill ? f.skills.includes(filterSkill as Skill) : true;
      return searchMatch && stateMatch && skillMatch;
    });
  }, [freelancerStats, searchTerm, filterState, filterSkill]);

  const totalFreelancers = freelancers.length;
  const totalEarningsAll = freelancerStats.reduce((sum, f) => sum + f.totalEarnings, 0);
  const avgRating = freelancers.reduce((sum, f) => sum + f.rating, 0) / (totalFreelancers || 1);


  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Laporan Prestasi Freelancer</h2>
          <p className="mt-1 text-sm text-gray-600">Analisis metrik prestasi untuk semua juruteknik.</p>
        </div>
        <Button variant="secondary" onClick={onBack}>Kembali ke Hab Laporan</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard icon={ICONS.users} title="Jumlah Freelancer" value={totalFreelancers} colorClassName="bg-blue-500" />
        <StatCard icon={ICONS.currencyDollar} title="Jumlah Pendapatan (Dibayar)" value={`RM ${totalEarningsAll.toFixed(2)}`} colorClassName="bg-green-500" />
        <StatCard icon={ICONS.star} title="Purata Rating" value={avgRating.toFixed(2)} colorClassName="bg-yellow-500" />
      </div>

      <div className="bg-white p-4 rounded-lg shadow-md">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Input label="Cari Nama Freelancer" id="search" placeholder="Taip nama..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          <Select label="Tapis Mengikut Negeri" id="filterState" value={filterState} onChange={e => setFilterState(e.target.value)}>
            <option value="">Semua Negeri</option>
            {Object.values(MalaysianState).map(s => <option key={s} value={s}>{s}</option>)}
          </Select>
          <Select label="Tapis Mengikut Kemahiran" id="filterSkill" value={filterSkill} onChange={e => setFilterSkill(e.target.value)}>
            <option value="">Semua Kemahiran</option>
            {Object.values(Skill).map(s => <option key={s} value={s}>{s}</option>)}
          </Select>
        </div>
      </div>
      
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rating</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tugasan Diambil</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tugasan Selesai</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Jumlah Pendapatan (RM)</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredFreelancers.map(f => (
                <tr key={f.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{f.name}</div>
                    <div className="text-sm text-gray-500">{f.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{f.rating.toFixed(1)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{f.tasksAssigned}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{f.tasksCompleted}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-700">{f.totalEarnings.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredFreelancers.length === 0 && <p className="text-center text-gray-500 p-6">Tiada data ditemui untuk tapisan semasa.</p>}
      </div>
    </div>
  );
};
