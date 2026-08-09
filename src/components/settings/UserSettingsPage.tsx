import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { User, Freelancer, UserStatus, Role } from '../../types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { UserStatusBadge } from '../ui/UserStatusBadge';
import { ICONS } from '../ui/icons';
import { UserStatus as UserStatusEnum } from '../../types';


interface UserSettingsPageProps {
  onBack: () => void;
  allUsers: (User | Freelancer)[];
  roles: Role[];
  onUpdateStatus: (userId: number, status: UserStatus) => void;
  onResetPassword: (userId: number) => void;
  onViewDetails: (user: User | Freelancer) => void;
  onAddUser: () => void;
  onEditUser: (user: User | Freelancer) => void;
  onDeleteUser: (userId: number) => void;
  onBanUser: (user: User | Freelancer) => void;
}

const UserActionMenu: React.FC<{ 
    user: User | Freelancer;
    onUpdateStatus: (userId: number, status: UserStatus) => void; 
    onResetPassword: (userId: number) => void; 
    onViewDetails: (user: User | Freelancer) => void;
    onEditUser: (user: User | Freelancer) => void;
    onDeleteUser: (userId: number) => void;
    onBanUser: (user: User | Freelancer) => void;
}> = (props) => {
    const { user, onUpdateStatus, onResetPassword, onViewDetails, onEditUser, onDeleteUser, onBanUser } = props;
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (isOpen && menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen]);

    const handleActionClick = (action: () => void) => {
        action();
        setIsOpen(false);
    };

    return (
        <div className="relative" ref={menuRef}>
            <Button variant="secondary" size="sm" icon={ICONS.dotsVertical} onClick={() => setIsOpen(!isOpen)}>
                Tindakan
            </Button>
            {isOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg z-20 border">
                    <div className="py-1">
                        <button onClick={() => handleActionClick(() => onViewDetails(user))} className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                            {ICONS.eye} Lihat Butiran
                        </button>
                        <button onClick={() => handleActionClick(() => onEditUser(user))} className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                            {ICONS.pencil} Edit Pengguna
                        </button>
                         <div className="border-t my-1"></div>
                        <button onClick={() => handleActionClick(() => onUpdateStatus(user.id, UserStatusEnum.ACTIVE))} className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                            {ICONS.checkCircle} Set Aktif
                        </button>
                        <button onClick={() => handleActionClick(() => onUpdateStatus(user.id, UserStatusEnum.INACTIVE))} className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                            {ICONS.lockOpen} Set Tidak Aktif
                        </button>
                        <button onClick={() => handleActionClick(() => onBanUser(user))} className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-orange-700 hover:bg-orange-50">
                            {ICONS.ban} Sekat Pengguna...
                        </button>
                        <div className="border-t my-1"></div>
                        <button onClick={() => handleActionClick(() => onResetPassword(user.id))} className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                           {ICONS.key} Set Semula Kata Laluan
                        </button>
                        <button onClick={() => handleActionClick(() => onDeleteUser(user.id))} className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-red-700 hover:bg-red-50">
                           {ICONS.trash} Padam Pengguna
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}


export const UserSettingsPage: React.FC<UserSettingsPageProps> = (props) => {
  const { onBack, allUsers, roles, onUpdateStatus, onResetPassword, onViewDetails, onAddUser, onEditUser, onDeleteUser, onBanUser } = props;
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Debug: Log allUsers data
  console.log('🔍 UserSettingsPage - allUsers:', allUsers);
  console.log('🔍 UserSettingsPage - allUsers length:', allUsers?.length);
  console.log('🔍 UserSettingsPage - roles:', roles);

  const filteredUsers = useMemo(() => {
    const filtered = allUsers.filter(user => {
      const searchMatch = !searchTerm ||
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const roleMatch = !filterRole || user.roleId === parseInt(filterRole);
      const statusMatch = !filterStatus || user.status === filterStatus;

      return searchMatch && roleMatch && statusMatch;
    }).sort((a, b) => a.id - b.id);
    
    // Debug: Log filtered results
    console.log('🔍 UserSettingsPage - filteredUsers:', filtered);
    console.log('🔍 UserSettingsPage - filteredUsers length:', filtered.length);
    console.log('🔍 UserSettingsPage - searchTerm:', searchTerm);
    console.log('🔍 UserSettingsPage - filterRole:', filterRole);
    console.log('🔍 UserSettingsPage - filterStatus:', filterStatus);
    
    return filtered;
  }, [allUsers, searchTerm, filterRole, filterStatus]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));

  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterRole, filterStatus, pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);
  
  const getRoleName = (roleId: number) => roles.find(r => r.id === roleId)?.name || 'N/A';

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Pengurusan Pengguna</h2>
          <p className="mt-1 text-sm text-gray-600">Urus pengguna berdaftar, tukar status, dan set semula kata laluan.</p>
        </div>
        <div className="flex items-center gap-2">
            <Button onClick={onAddUser} icon={ICONS.plus}>Tambah Pengguna</Button>
            <Button variant="secondary" onClick={onBack}>Kembali ke Tetapan</Button>
        </div>
      </div>
      
      <div className="bg-white p-4 rounded-lg shadow-md">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="md:col-span-1">
                <Input 
                  label="Cari Pengguna (Nama atau E-mel)" 
                  id="search-user" 
                  placeholder="Taip untuk mencari..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <div className="md:col-span-1">
                <Select label="Tapis Mengikut Peranan" id="filter-role" value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
                    <option value="">Semua Peranan</option>
                    {roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}
                </Select>
            </div>
            <div className="md:col-span-1">
                <Select label="Tapis Mengikut Status" id="filter-status" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                    <option value="">Semua Status</option>
                    {Object.values(UserStatusEnum).map(status => <option key={status} value={status}>{status}</option>)}
                </Select>
            </div>
        </div>
      </div>

      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Peranan</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="relative px-6 py-3"><span className="sr-only">Tindakan</span></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedUsers.map(user => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{user.name}</div>
                    <div className="text-sm text-gray-500">{user.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{getRoleName(user.roleId)}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <UserStatusBadge status={user.status} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <UserActionMenu 
                        user={user} 
                        onUpdateStatus={onUpdateStatus} 
                        onResetPassword={onResetPassword} 
                        onViewDetails={onViewDetails}
                        onEditUser={onEditUser}
                        onDeleteUser={onDeleteUser}
                        onBanUser={onBanUser}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredUsers.length === 0 && <p className="text-center text-gray-500 p-6">Tiada pengguna ditemui.</p>}

        {filteredUsers.length > 0 && (
          <div className="px-6 py-4 border-t bg-gray-50 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="text-sm text-gray-600">
              Papar {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, filteredUsers.length)} daripada {filteredUsers.length} pengguna
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Baris:</span>
                <Select
                  id="page-size"
                  value={String(pageSize)}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="min-w-[110px]"
                >
                  <option value="10">10</option>
                  <option value="20">20</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  Sebelumnya
                </Button>
                <span className="text-sm text-gray-600">Halaman {currentPage} / {totalPages}</span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  Seterusnya
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
