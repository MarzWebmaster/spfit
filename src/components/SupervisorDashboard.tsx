import React from 'react';
import type { Task, User, Freelancer } from '../types';
import { TaskStatus } from '../types';
import { StatCard } from './ui/StatCard';
import { Button } from './ui/Button';
import { ICONS } from './ui/icons';

interface SupervisorDashboardProps {
  tasks: Task[];
  allUsers: (User | Freelancer)[];
  onViewTask: (task: Task) => void;
}

export const SupervisorDashboard: React.FC<SupervisorDashboardProps> = ({ tasks, allUsers, onViewTask }) => {
  const pendingPaymentTasks = tasks.filter(task => [TaskStatus.SELESAI, TaskStatus.BORANG_DISEMAK].includes(task.status));
  
  const stats = {
    pendingApproval: pendingPaymentTasks.length,
    totalPaid: tasks
      .filter(t => t.status === TaskStatus.TELAH_DIBAYAR)
      .reduce((sum, task) => sum + task.offerPrice, 0),
    tasksCompleted: tasks.filter(t => [TaskStatus.SELESAI, TaskStatus.BORANG_DISEMAK, TaskStatus.TELAH_DIBAYAR].includes(t.status)).length,
  };

  const getFreelancerName = (task: Task) => {
    const directName = (task as any)?.assignee?.name;
    if (directName) return directName;
    const assignedId = (task as any)?.assignedTo ?? (task as any)?.assigned_to;
    return allUsers.find(u => u.id === assignedId)?.name || 'N/A';
  };

  const formatDate = (value?: string) => {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('en-GB');
  };

  const getPaymentQueueDate = (task: Task) => {
    const reportSubmittedAt = task.report?.submittedAt;
    const completedAt = (task as any)?.updatedAt || (task as any)?.updated_at;
    const onsiteDate = (task as any)?.serviceStartDate || (task as any)?.service_start_date;
    return formatDate(reportSubmittedAt || onsiteDate || completedAt);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Kelulusan Bayaran</h2>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard icon={ICONS.checkCircle} title="Menunggu Kelulusan Bayaran" value={stats.pendingApproval} colorClassName="bg-yellow-500" />
        <StatCard icon={ICONS.currencyDollar} title="Jumlah Telah Dibayar" value={`RM ${stats.totalPaid.toFixed(2)}`} colorClassName="bg-green-500" />
        <StatCard icon={ICONS.briefcase} title="Tugasan Selesai (Keseluruhan)" value={stats.tasksCompleted} colorClassName="bg-blue-500" />
      </div>
      
      {/* Pending Approval List */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="p-4 border-b">
            <h3 className="text-lg font-semibold text-gray-800">Senarai Tugasan Untuk Kelulusan Bayaran</h3>
        </div>
        <div className="overflow-x-auto">
          {pendingPaymentTasks.length > 0 ? (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                  <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tajuk Tugasan</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Freelancer</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tarikh Rujukan</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Jumlah (RM)</th>
                      <th scope="col" className="relative px-6 py-3"><span className="sr-only">Tindakan</span></th>
                  </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {pendingPaymentTasks.map(task => (
                  <tr key={task.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="text-sm font-medium text-gray-900">{task.title}</p>
                      <p className="text-sm text-gray-500">ID: {task.id}</p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{getFreelancerName(task)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{getPaymentQueueDate(task)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-700">{task.offerPrice.toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Button size="sm" variant="secondary" onClick={() => onViewTask(task)}>Lihat & Luluskan</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-center text-gray-500 p-6">Tiada tugasan yang menunggu kelulusan bayaran.</p>
          )}
        </div>
      </div>
    </div>
  );
};
