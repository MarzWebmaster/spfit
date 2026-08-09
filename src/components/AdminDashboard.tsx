import React, { useState } from 'react';
import type { Task, User, Freelancer } from '../types';
import { TaskStatus, UserRole, UserStatus } from '../types';
import { StatCard } from './ui/StatCard';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { ICONS } from './ui/icons';

interface AdminDashboardProps {
  currentUser: User;
  tasks: Task[];
  users: User[];
  freelancers: Freelancer[];
  onViewTask: (task: Task) => void;
  onViewUser: (user: User) => void;
  onViewFreelancer: (freelancer: Freelancer) => void;
  dashboardStats?: {
    totalUsers?: number;
    totalTasks?: number;
    totalFreelancers?: number;
    activeTasks?: number;
    completedTasks?: number;
    pendingTasks?: number;
  };
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentUser,
  tasks,
  users,
  freelancers,
  onViewTask,
  onViewUser,
  onViewFreelancer
}) => {
  const [activeTab, setActiveTab] = useState<'tasks' | 'users' | 'freelancers'>('tasks');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(5);
  const isFreelancerRole = currentUser.role === UserRole.FREELANCER || /freelance/i.test(currentUser.role || '');

  // Hardcode freelancer dashboard view: only show tasks assigned to the logged-in freelancer.
  const dashboardTasks = isFreelancerRole
    ? tasks.filter(task => task.assignedTo === currentUser.id)
    : tasks;

  // Calculate statistics - use actual counts from API
  // Note: For accurate counts, the parent component should fetch dashboard stats from system API
  // and pass them as props. For now, we use the length of arrays passed as props.
  console.log('[DASHBOARD DEBUG]', {usersLen: users?.length, freelancersLen: freelancers?.length});
  const stats = {
    totalTasks: dashboardTasks.length,
    activeTasks: dashboardTasks.filter(t => [TaskStatus.BARU, TaskStatus.TAWARAN_DIHANTAR, TaskStatus.TELAH_DIAMBIL].includes(t.status)).length,
    totalUsers: users.length, // DB has 33 total users: users prop already includes freelancers
    activeFreelancers: freelancers.filter(f => f.status === UserStatus.ACTIVE && f.isAvailable).length,
    pendingPayments: dashboardTasks.filter(t => t.status === TaskStatus.BORANG_DISEMAK).length,
    totalRevenue: dashboardTasks.filter(t => t.status === TaskStatus.TELAH_DIBAYAR).reduce((sum, task) => sum + task.offerPrice, 0)
  };

  const currentList = activeTab === 'tasks' ? dashboardTasks : activeTab === 'users' ? users : freelancers;

  const totalPages = Math.ceil(currentList.length / perPage);
  const paginatedList = currentList.slice((page - 1) * perPage, page * perPage);

  // Reset page when tab or perPage changes
  const handleTabChange = (tab: 'tasks' | 'users' | 'freelancers') => {
    setActiveTab(tab);
    setPage(1);
  };

  const handlePerPageChange = (value: number) => {
    setPerPage(value);
    setPage(1);
  };

  // Get recent data for tables - now paginated
  const recentTasks = paginatedList;
  const recentUsers = paginatedList;
  const recentFreelancers = paginatedList;

  const getUserName = (id: number) => {
    const user = users.find(u => u.id === id) || freelancers.find(f => f.id === id);
    return user?.name || 'N/A';
  };

  const PaginationControls = () => (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-3 border-t">
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <span>Papar</span>
        <select
          value={perPage}
          onChange={(e) => handlePerPageChange(Number(e.target.value))}
          className="border border-gray-300 rounded px-2 py-1 text-sm"
        >
          {[5, 10, 20, 50, 100].map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        <span>per halaman</span>
        <span className="ml-4 text-gray-400">
          {currentList.length} jumlah rekod
        </span>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => setPage(1)}
          disabled={page <= 1}
          className="px-2 py-1 text-sm border rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          ««
        </button>
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
          className="px-3 py-1 text-sm border rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          «
        </button>
        <span className="px-3 py-1 text-sm text-gray-600">
          {page} / {totalPages || 1}
        </span>
        <button
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages}
          className="px-3 py-1 text-sm border rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          »
        </button>
        <button
          onClick={() => setPage(totalPages)}
          disabled={page >= totalPages}
          className="px-2 py-1 text-sm border rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          »»
        </button>
      </div>
    </div>
  );

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Panel Pentadbiran</h2>
          <p className="text-gray-600">Selamat kembali, {currentUser.name}. Berikut adalah ringkasan sistem.</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <StatCard 
          icon={ICONS.briefcase} 
          title="Jumlah Tugasan" 
          value={stats.totalTasks} 
          colorClassName="bg-blue-500" 
        />
        <StatCard 
          icon={ICONS.clock} 
          title="Tugasan Aktif" 
          value={stats.activeTasks} 
          colorClassName="bg-orange-500" 
        />
        {!isFreelancerRole && (
          <StatCard 
            icon={ICONS.users} 
            title="Jumlah Pengguna" 
            value={stats.totalUsers} 
            colorClassName="bg-green-500" 
          />
        )}
        {!isFreelancerRole && (
          <StatCard 
            icon={ICONS.userCheck} 
            title="Freelancer Aktif" 
            value={stats.activeFreelancers} 
            colorClassName="bg-purple-500" 
          />
        )}
        <StatCard 
          icon={ICONS.exclamationTriangle} 
          title="Pembayaran Tertunggak" 
          value={stats.pendingPayments} 
          colorClassName="bg-yellow-500" 
        />
        <StatCard 
          icon={ICONS.currencyDollar} 
          title="Jumlah Hasil" 
          value={`RM ${stats.totalRevenue.toFixed(2)}`} 
          colorClassName="bg-emerald-500" 
        />
      </div>

      {/* Data Tables with Tabs */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="border-b">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => handleTabChange('tasks')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'tasks'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Tugasan Terkini
            </button>
            {!isFreelancerRole && (
              <button
                onClick={() => handleTabChange('users')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'users'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Pengguna Staff
              </button>
            )}
            {!isFreelancerRole && (
              <button
                onClick={() => handleTabChange('freelancers')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'freelancers'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Freelancer
              </button>
            )}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'tasks' && (
            <div className="overflow-x-auto">
              {paginatedList.length > 0 ? (
                <>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tugasan
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Dicipta Oleh
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Freelancer
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Harga (RM)
                      </th>
                      <th className="relative px-6 py-3">
                        <span className="sr-only">Tindakan</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paginatedList.map(task => (
                      <tr key={task.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{task.title}</p>
                            <p className="text-sm text-gray-500">{task.clientLocation}, {task.state}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">
                          {getUserName(task.createdBy)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">
                          {task.assignedTo ? getUserName(task.assignedTo) : 'Belum Diagihkan'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge status={task.status} />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-700">
                          {task.offerPrice.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <Button size="sm" variant="secondary" onClick={() => onViewTask(task)}>
                            Lihat
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {PaginationControls()}
                </>
              ) : (
                <p className="text-center text-gray-500 py-8">Tiada tugasan dijumpai.</p>
              )}
            </div>
          )}

          {activeTab === 'users' && (
            <div className="overflow-x-auto">
              {paginatedList.length > 0 ? (
                <>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Nama
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="relative px-6 py-3">
                        <span className="sr-only">Tindakan</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paginatedList.map(user => (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <p className="text-sm font-medium text-gray-900">{user.name}</p>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">
                          {user.email || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            user.status === UserStatus.ACTIVE 
                              ? 'bg-green-100 text-green-800'
                              : user.status === UserStatus.BANNED
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {user.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <Button size="sm" variant="secondary" onClick={() => onViewUser(user)}>
                            Lihat
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {PaginationControls()}
                </>
              ) : (
                <p className="text-center text-gray-500 py-8">Tiada pengguna staff dijumpai.</p>
              )}
            </div>
          )}

          {activeTab === 'freelancers' && (
            <div className="overflow-x-auto">
              {paginatedList.length > 0 ? (
                <>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Nama
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Penarafan
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ketersediaan
                      </th>
                      <th className="relative px-6 py-3">
                        <span className="sr-only">Tindakan</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paginatedList.map(freelancer => (
                      <tr key={freelancer.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <p className="text-sm font-medium text-gray-900">{freelancer.name}</p>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">
                          {freelancer.email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">
                          <div className="flex items-center">
                            <span className="text-yellow-400 mr-1">★</span>
                            {freelancer.rating.toFixed(1)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            freelancer.status === UserStatus.ACTIVE 
                              ? 'bg-green-100 text-green-800'
                              : freelancer.status === UserStatus.BANNED
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {freelancer.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            freelancer.isAvailable 
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {freelancer.isAvailable ? 'Tersedia' : 'Tidak Tersedia'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <Button size="sm" variant="secondary" onClick={() => onViewFreelancer(freelancer)}>
                            Lihat
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {PaginationControls()}
                </>
              ) : (
                <p className="text-center text-gray-500 py-8">Tiada freelancer dijumpai.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
