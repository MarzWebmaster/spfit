
import React from 'react';
import type { TaskStatus } from '../../types';
import { TaskStatus as TaskStatusEnum } from '../../types';

interface BadgeProps {
  status: TaskStatus;
}

export const Badge: React.FC<BadgeProps> = ({ status }) => {
  const statusColors: Record<TaskStatus, string> = {
    [TaskStatusEnum.BARU]: 'bg-blue-100 text-blue-800',
    [TaskStatusEnum.TAWARAN_DIHANTAR]: 'bg-yellow-100 text-yellow-800',
    [TaskStatusEnum.TELAH_DIAMBIL]: 'bg-indigo-100 text-indigo-800',
    [TaskStatusEnum.SELESAI]: 'bg-purple-100 text-purple-800',
    [TaskStatusEnum.BORANG_DISEMAK]: 'bg-pink-100 text-pink-800',
    [TaskStatusEnum.TELAH_DIBAYAR]: 'bg-green-100 text-green-800',
    [TaskStatusEnum.DIBATALKAN]: 'bg-red-100 text-red-800',
    [TaskStatusEnum.SELESAI_PENUH]: 'bg-gray-100 text-gray-800',
  };

  const statusLabels: Partial<Record<TaskStatus, string>> = {
    [TaskStatusEnum.TELAH_DIAMBIL]: 'Tawaran Diterima',
    [TaskStatusEnum.SELESAI]: 'Tugasan Siap',
  };

  return (
    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColors[status]}`}>
      {statusLabels[status] || status}
    </span>
  );
};