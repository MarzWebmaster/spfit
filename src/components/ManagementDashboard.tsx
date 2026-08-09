import React from 'react';
import type { Task, User } from '../types';
import { StatCard } from './ui/StatCard';
import { ICONS } from './ui/icons';
import { TaskStatus } from '../types';

interface ManagementDashboardProps {
  tasks: Task[];
  onViewTask: (task: Task) => void;
  allUsers: any[];
}

export const ManagementDashboard: React.FC<ManagementDashboardProps> = ({ tasks, onViewTask, allUsers }) => {
  // KPI Calculations
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === TaskStatus.SELESAI_PENUH).length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  
  // Budget (Mock data based on tasks)
  const totalSpent = tasks
    .filter(t => t.status === TaskStatus.TELAH_DIBAYAR || t.status === TaskStatus.SELESAI_PENUH)
    .reduce((acc, t) => acc + (t.offerPrice || 0), 0);
    
  const pendingApprovals = tasks.filter(t => t.status === TaskStatus.BORANG_DISEMAK);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Dashboard Pengurusan</h1>
        <div className="text-sm text-gray-500">
          Ringkasan KPI & Kewangan
        </div>
      </div>

      {/* KPI Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title="Kadar Penyelesaian"
          value={`${completionRate}%`}
          icon={ICONS.chartBar}
          color="blue"
          trend="+5%"
          trendUp={true}
        />
        <StatCard
          title="Jumlah Perbelanjaan"
          value={`RM ${totalSpent.toLocaleString()}`}
          icon={ICONS.money}
          color="green"
        />
        <StatCard
          title="Menunggu Kelulusan"
          value={pendingApprovals.length}
          icon={ICONS.clock}
          color="yellow"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Approvals List */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Projek Memerlukan Kelulusan</h3>
          <div className="space-y-4">
            {pendingApprovals.length === 0 ? (
              <p className="text-gray-500">Tiada tugasan memerlukan kelulusan.</p>
            ) : (
              pendingApprovals.slice(0, 5).map(task => (
                <div key={task.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 cursor-pointer" onClick={() => onViewTask(task)}>
                  <div>
                    <h4 className="font-medium text-gray-900">{task.title}</h4>
                    <p className="text-sm text-gray-500">{task.logNumber}</p>
                  </div>
                  <span className="px-3 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                    Perlu Semakan
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Chart Placeholder (Simulated) */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Analisis Bajet vs Perbelanjaan</h3>
          <div className="h-64 flex items-center justify-center bg-gray-50 rounded border border-dashed border-gray-300">
            <div className="text-center text-gray-500">
              <p>Carta Perbelanjaan Bulanan</p>
              <span className="text-xs">(Integrasi Chart.js akan datang)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
