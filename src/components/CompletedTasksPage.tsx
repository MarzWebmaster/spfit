import React, { useEffect, useState } from 'react';
import type { TaskStatus } from '../types';
import { TaskStatus as TaskStatusValue } from '../types';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { tasksApi } from '../services/api';
import { ICONS } from './ui/icons';
import { useNavigate } from 'react-router-dom';

interface CompletedTasksPageProps {
  onViewTask?: (taskId: number) => void;
}

type CompletedTaskItem = {
  id: number;
  title?: string;
  logNumber?: string;
  offerPrice?: number;
  status?: TaskStatus | string;
  assignee?: { name?: string; email?: string };
  updatedAt?: string;
  updated_at?: string;
  createdAt?: string;
  created_at?: string;
};

export const CompletedTasksPage: React.FC<CompletedTasksPageProps> = ({ onViewTask }) => {
  const navigate = useNavigate();
  const [completedTasks, setCompletedTasks] = useState<CompletedTaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    loadCompletedTasks();
  }, [page]);

  const loadCompletedTasks = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await tasksApi.getAll(page, 10, { status: TaskStatusValue.SELESAI });
      
      if (response.success && response.data) {
        const data = response.data as any;
        const rawTasks = Array.isArray(data.tasks) ? data.tasks : [];
        const normalizedTasks: CompletedTaskItem[] = rawTasks.map((task: any) => ({
          id: Number(task.id),
          title: task.title,
          logNumber: task.logNumber || task.log_number,
          offerPrice: Number(task.offerPrice ?? task.offer_price ?? 0),
          status: task.status || task.statusSetting?.name || task.status_setting?.name,
          assignee: task.assignee
            ? { name: task.assignee?.name, email: task.assignee?.email }
            : undefined,
          updatedAt: task.updatedAt,
          updated_at: task.updated_at,
          createdAt: task.createdAt,
          created_at: task.created_at,
        }));

        setCompletedTasks(normalizedTasks);
        setTotalPages(data.pagination?.pages || 1);
        setTotal(data.pagination?.total || 0);
      } else {
        setError((response as any).error || 'Gagal memuatkan tugasan siap');
      }
    } catch (err) {
      console.error('Error loading completed tasks:', err);
      setError('Gagal memuatkan tugasan siap. Sila cuba lagi.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('en-GB');
  };

  const getAssignedFreelancer = (task: CompletedTaskItem) => {
    return {
      name: task.assignee?.name || 'N/A',
      email: task.assignee?.email || '-'
    };
  };

  const getTaskStatus = (task: CompletedTaskItem): TaskStatus | string => {
    return task.status || '-';
  };

  const handleView = (task: CompletedTaskItem) => {
    if (onViewTask) {
      onViewTask(task.id);
      return;
    }
    navigate(`/tasks/${task.id}`);
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Tugasan Siap</h1>
        <p className="text-gray-600 mt-2">Senarai tugasan yang statusnya Tugasan Siap</p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-red-700">{error}</p>
            <Button size="sm" variant="secondary" onClick={loadCompletedTasks}>
              Cuba Lagi
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="text-gray-600">Memuatkan tugasan siap...</div>
        </div>
      ) : completedTasks.length > 0 ? (
        <>
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tugasan</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">No Log</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Freelancer</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nilai (RM)</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tarikh Kemaskini</th>
                    <th scope="col" className="relative px-6 py-3"><span className="sr-only">Tindakan</span></th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {completedTasks.map((task) => (
                    (() => {
                      const assignedFreelancer = getAssignedFreelancer(task);
                      const displayDate = task.updated_at || task.updatedAt || task.created_at || task.createdAt;

                      return (
                    <tr key={task.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{task.title || 'N/A'}</p>
                          <p className="text-sm text-gray-500">ID: {task.id}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{task.logNumber || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="text-sm font-medium text-gray-900">{assignedFreelancer.name}</p>
                        <p className="text-sm text-gray-500">{assignedFreelancer.email}</p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-700">
                        RM {Number(task.offerPrice || 0).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {getTaskStatus(task) !== '-' ? (
                          <Badge status={getTaskStatus(task) as TaskStatus} />
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{formatDate(displayDate)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Button size="sm" variant="secondary" onClick={() => handleView(task)}>
                          Lihat
                        </Button>
                      </td>
                    </tr>
                      );
                    })()
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-gray-50 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-gray-200">
              <div className="text-sm text-gray-600">
                Menunjukkan {(page - 1) * 10 + 1} hingga {Math.min(page * 10, total)} daripada {total} hasil
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 border border-gray-300 rounded text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Sebelumnya
                </button>
                <div className="flex items-center px-3 py-1 text-sm text-gray-700">
                  Halaman {page} daripada {totalPages}
                </div>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1 border border-gray-300 rounded text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Seterusnya
                </button>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <div className="flex justify-center mb-4">
            <span className="opacity-50">{ICONS.inbox}</span>
          </div>
          <p className="text-gray-500 text-lg">Tiada tugasan siap ditemui</p>
          <p className="text-gray-400 text-sm mt-2">Tugasan yang telah diselesaikan akan muncul di sini</p>
        </div>
      )}
    </div>
  );
};
