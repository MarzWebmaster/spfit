import React from 'react';
import type { Task } from '../types';
import { StatCard } from './ui/StatCard';
import { ICONS } from './ui/icons';
import { TaskStatus } from '../types';

interface OperationsDashboardProps {
  tasks: Task[];
  onViewTask: (task: Task) => void;
}

export const OperationsDashboard: React.FC<OperationsDashboardProps> = ({ tasks, onViewTask }) => {
  // Operational Metrics
  const activeTasks = tasks.filter(t => 
    t.status !== TaskStatus.SELESAI_PENUH && 
    t.status !== TaskStatus.DIBATALKAN && 
    t.status !== TaskStatus.BARU
  );
  
  const newTasks = tasks.filter(t => t.status === TaskStatus.BARU);
  const issuesCount = tasks.filter(t => t.status === TaskStatus.DIBATALKAN).length; // Mock metric

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Dashboard Operasi</h1>
        <div className="text-sm text-gray-500">
          Pantauan Harian
        </div>
      </div>

      {/* Operational Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title="Tugasan Aktif"
          value={activeTasks.length}
          icon={ICONS.briefcase}
          color="blue"
        />
        <StatCard
          title="Tugasan Baru"
          value={newTasks.length}
          icon={ICONS.bell}
          color="green"
        />
        <StatCard
          title="Isu / Dibatalkan"
          value={issuesCount}
          icon={ICONS.alertCircle}
          color="red"
        />
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Senarai Tugasan Perlu Tindakan</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tugasan</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tarikh Akhir</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Tindakan</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {activeTasks.slice(0, 10).map(task => (
                <tr key={task.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{task.title}</div>
                    <div className="text-xs text-gray-500">{task.logNumber}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                      ${task.status === TaskStatus.BARU ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                      {task.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {task.deadline}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button 
                      onClick={() => onViewTask(task)}
                      className="text-indigo-600 hover:text-indigo-900"
                    >
                      Lihat
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
