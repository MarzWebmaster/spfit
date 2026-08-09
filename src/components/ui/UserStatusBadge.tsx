import React from 'react';
import type { UserStatus } from '../../types';
import { UserStatus as UserStatusEnum } from '../../types';

interface UserStatusBadgeProps {
  status: UserStatus;
}

export const UserStatusBadge: React.FC<UserStatusBadgeProps> = ({ status }) => {
  const statusColors: Record<UserStatus, string> = {
    [UserStatusEnum.ACTIVE]: 'bg-green-100 text-green-800',
    [UserStatusEnum.INACTIVE]: 'bg-gray-100 text-gray-800',
    [UserStatusEnum.BANNED]: 'bg-red-100 text-red-800',
  };

  return (
    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColors[status]}`}>
      {status}
    </span>
  );
};
