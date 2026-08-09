import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { tasksApi } from '../services/api';
import type { Task } from '../types';
import { TaskStatus } from '../types';
import { Button } from './ui/Button';

interface PaymentApprovalsPageProps {
  canApprove: boolean;
  canMarkPaid: boolean;
}

export const PaymentApprovalsPage: React.FC<PaymentApprovalsPageProps> = ({ canApprove, canMarkPaid }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);

  const loadTasks = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await tasksApi.getAll(1, 100, { status: TaskStatus.BORANG_DISEMAK });
      if (!response.success || !response.data) {
        setError((response as any).error || 'Gagal memuatkan senarai tugasan');
        return;
      }

      const wrapped = response.data as any;
      const rows = (wrapped?.tasks || []) as any[];
      const normalized: Task[] = rows.map((task) => ({
        ...task,
        logNumber: task.logNumber || task.log_number,
        supportType: task.supportType || task.support_type,
        clientLocation: task.clientLocation || task.client_location,
        districtAddress: task.districtAddress || task.bandar_daerah || task.district_address,
        offerPrice: Number(task.offerPrice ?? task.offer_price ?? 0),
        status: task.status || task.statusSetting?.name || task.status_setting?.name,
        assignedTo: task.assignedTo || task.assigned_to || task.assignee?.id,
        createdAt: task.createdAt || task.created_at,
        updatedAt: task.updatedAt || task.updated_at,
      }));
      setTasks(normalized);
    } catch (e) {
      console.error(e);
      setError('Gagal memuatkan senarai tugasan');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const totals = useMemo(() => {
    return {
      waiting: tasks.length,
    };
  }, [tasks]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kelulusan Pembayaran</h1>
          <p className="text-sm text-gray-600 mt-1">Senarai tugasan yang statusnya Borang Disemak & Pembayaran Tertunggak.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-lg bg-white p-4 shadow-sm border border-gray-200">
          <p className="text-xs text-gray-500">Pembayaran Tertunggak</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{totals.waiting}</p>
        </div>
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">No Log</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Tajuk</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Freelancer</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Amaun</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">Memuatkan data...</td>
                </tr>
              ) : tasks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">Tiada tugasan pembayarannya tertunggak.</td>
                </tr>
              ) : tasks.map((task) => (
                <tr key={task.id}>
                  <td className="px-4 py-3 text-sm text-gray-900">{task.logNumber || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{task.title || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{(task as any)?.assignee?.name || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">RM {Number(task.offerPrice || 0).toFixed(2)}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{task.status || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="secondary" onClick={() => navigate(`/tasks/${task.id}`)}>
                        Lihat
                      </Button>
                    </div>
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
