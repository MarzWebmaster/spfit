import React, { useState } from 'react';
import type { Task, Freelancer } from '../types';
import { TaskStatus } from '../types';
import { StatCard } from './ui/StatCard';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { ICONS } from './ui/icons';

interface FreelancerDashboardProps {
  currentUser: Freelancer;
  tasks: Task[]; // all tasks
  onViewTask: (task: Task) => void;
    onAcceptTask: (task: Task) => Promise<void>;
    onRejectTask: (task: Task) => Promise<void>;
}

export const FreelancerDashboard: React.FC<FreelancerDashboardProps> = ({ currentUser, tasks, onViewTask, onAcceptTask, onRejectTask }) => {
    const freelancerRating = typeof currentUser.rating === 'number' ? currentUser.rating : 0;
    const [acceptingTaskId, setAcceptingTaskId] = useState<number | null>(null);
    const [rejectingTaskId, setRejectingTaskId] = useState<number | null>(null);
  const myTasks = tasks.filter(task => task.assignedTo === currentUser.id);

    const handleAcceptTask = async (task: Task) => {
        try {
            setAcceptingTaskId(task.id);
            await onAcceptTask(task);
        } finally {
            setAcceptingTaskId(null);
        }
    };

    const handleRejectTask = async (task: Task) => {
        try {
            setRejectingTaskId(task.id);
            await onRejectTask(task);
        } finally {
            setRejectingTaskId(null);
        }
    };


  const stats = {
    activeTasks: myTasks.filter(t => t.status === TaskStatus.TELAH_DIAMBIL).length,
    totalEarnings: myTasks
      .filter(t => t.status === TaskStatus.TELAH_DIBAYAR)
      .reduce((sum, task) => sum + task.offerPrice, 0),
        rating: freelancerRating,
  };
  
    const pendingAssignedTasks = tasks
        .filter(task => task.assignedTo === currentUser.id && task.status === TaskStatus.TAWARAN_DIHANTAR)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5);

  const recentMyTasks = myTasks.slice(0, 5);

  const paymentHistory = myTasks
    .filter(t => [TaskStatus.BORANG_DISEMAK, TaskStatus.TELAH_DIBAYAR].includes(t.status))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  return (
    <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Selamat Kembali, {(currentUser.name || 'Freelancer').split(' ')[0]}!</h2>
      <p className="text-gray-600 mb-6">Berikut adalah ringkasan aktiviti anda.</p>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard icon={ICONS.briefcase} title="Tugasan Aktif" value={stats.activeTasks} colorClassName="bg-blue-500" />
        <StatCard icon={ICONS.currencyDollar} title="Jumlah Pendapatan" value={`RM ${stats.totalEarnings.toFixed(2)}`} colorClassName="bg-green-500" />
        <StatCard icon={ICONS.star} title="Penarafan Anda" value={stats.rating.toFixed(1)} colorClassName="bg-yellow-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Assigned Tasks Waiting For Acceptance */}
        <div className="bg-white rounded-lg shadow-md">
            <div className="p-4 border-b">
                <h3 className="text-lg font-semibold text-gray-800">Tugasan Diagihkan Menunggu Penerimaan</h3>
            </div>
            <div className="p-4 space-y-3">
                {pendingAssignedTasks.length > 0 ? (
                    pendingAssignedTasks.map(task => (
                        <div key={task.id} className="p-3 rounded-md border hover:bg-gray-50">
                           <div className="flex justify-between items-start">
                                <div>
                                    <p className="font-semibold text-indigo-700">{task.title}</p>
                                    <p className="text-sm text-gray-500">{task.clientLocation}, {task.state}</p>
                                </div>
                                <p className="font-bold text-gray-800">RM {task.offerPrice.toFixed(2)}</p>
                           </div>
                                                     <div className="mt-3 flex justify-end gap-2">
                                                            <Button
                                                                size="sm"
                                                                variant="secondary"
                                                                onClick={() => onViewTask(task)}
                                                            >
                                                                Lihat
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="danger"
                                                                onClick={() => handleRejectTask(task)}
                                                                disabled={rejectingTaskId === task.id || acceptingTaskId === task.id}
                                                            >
                                                                {rejectingTaskId === task.id ? 'Memproses...' : 'Tolak'}
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                onClick={() => handleAcceptTask(task)}
                                                                disabled={acceptingTaskId === task.id || rejectingTaskId === task.id}
                                                            >
                                                                {acceptingTaskId === task.id ? 'Memproses...' : 'Terima'}
                                                            </Button>
                                                     </div>
                        </div>
                    ))
                ) : (
                    <p className="text-center text-gray-500 py-4">Tiada tugasan diagihkan yang menunggu penerimaan anda pada masa ini.</p>
                )}
            </div>
        </div>

        {/* My Recent Tasks */}
        <div className="bg-white rounded-lg shadow-md">
            <div className="p-4 border-b">
                <h3 className="text-lg font-semibold text-gray-800">Aktiviti Tugasan Terkini Anda</h3>
            </div>
             <div className="overflow-x-auto">
                {recentMyTasks.length > 0 ? (
                    <table className="min-w-full">
                        <tbody className="divide-y divide-gray-200">
                            {recentMyTasks.map(task => (
                                <tr key={task.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <p className="text-sm font-medium text-gray-900">{task.title}</p>
                                        <p className="text-sm text-gray-500">{task.clientLocation}</p>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap"><Badge status={task.status} /></td>
                                    <td className="px-4 py-3 whitespace-nowrap text-right">
                                        <Button size="sm" variant="secondary" onClick={() => onViewTask(task)}>Lihat</Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <p className="text-center text-gray-500 p-6">Anda belum mempunyai sebarang tugasan.</p>
                )}
            </div>
        </div>
      </div>

      {/* Payment Schedule / History */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="p-4 border-b">
            <h3 className="text-lg font-semibold text-gray-800">Jadual Pembayaran & Sejarah</h3>
        </div>
        <div className="overflow-x-auto">
            {paymentHistory.length > 0 ? (
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tugasan</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tarikh</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Jumlah</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {paymentHistory.map(task => (
                            <tr key={task.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{task.title}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {task.paymentDate ? new Date(task.paymentDate).toLocaleDateString() : 'Pending'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <Badge status={task.status} />
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                                    RM {task.offerPrice.toFixed(2)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            ) : (
                <p className="text-center text-gray-500 py-6">Tiada rekod pembayaran terkini.</p>
            )}
        </div>
      </div>
    </div>
  );
};
