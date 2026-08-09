import React from 'react';
import type { User, DashboardView, Permission, Role } from '../types';
import { ICONS } from './ui/icons';

interface SidebarProps {
  currentUser: User;
  onLogout: () => void;
  onNavigate: (view: DashboardView) => void;
  activeView: DashboardView;
  hasPermission: (permission: Permission) => boolean;
  roles: Role[];
}

// FIX: Define a type for menu items to ensure requiredPermission is typed correctly.
interface MenuItem {
    icon: React.ReactNode;
    label: string;
    view: DashboardView;
  requiredPermission?: Permission | null;
  requiredAnyPermissions?: Permission[];
  isSubmenu?: boolean;
}

const NavLink: React.FC<{ icon: React.ReactNode; label: string; active?: boolean; onClick: () => void; isSubmenu?: boolean; }> = ({ icon, label, active, onClick, isSubmenu }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center ${isSubmenu ? 'px-8' : 'px-4'} py-2.5 text-sm font-medium rounded-lg transition-colors text-left ${
      active
        ? 'bg-indigo-600 text-white'
        : 'text-gray-300 hover:bg-gray-700 hover:text-white'
    }`}
  >
    {icon}
    <span className="ml-3">{label}</span>
  </button>
);

export const Sidebar: React.FC<SidebarProps> = ({ currentUser, onLogout, onNavigate, activeView, hasPermission, roles }) => {
  console.debug('Sidebar rendered with user:', currentUser);

  // FIX: Explicitly type menuItems array to prevent type inference issues.
  const menuItems: MenuItem[] = [
    // 1. Papan Pemuka
    { icon: ICONS.dashboard, label: 'Papan Pemuka', view: 'dashboard' as DashboardView, requiredPermission: null },
    
    // 2. Freelancer (show if user has key freelancer permission or common own-profile/task access)
    {
      icon: ICONS.users,
      label: 'Freelancer',
      view: 'freelancers' as DashboardView,
      requiredAnyPermissions: [
        'freelancers:view:all',
        'freelancers:view:own',
        'freelancers:manage',
        'settings:manage:profile',
        'tasks:view:assigned'
      ]
    },

    // 3. Projek
    { icon: ICONS.documentText, label: 'Projek', view: 'projects' as DashboardView, requiredAnyPermissions: ['projects:view:all', 'projects:view:own'] },

    // 3.1 Masterlist (submenu Projek)
    { icon: ICONS.arrowDown, label: 'Masterlist', view: 'masterlists' as DashboardView, requiredAnyPermissions: ['masterlists:view:all', 'masterlists:view:own', 'tasks:view:all', 'tasks:view:own', 'tasks:view:assigned', 'tasks:create', 'tasks:edit:all'], isSubmenu: true },

    // 3.2 Aset
    { icon: ICONS.clipboardCheck, label: 'Aset', view: 'assets' as DashboardView, requiredAnyPermissions: ['assets:view:all', 'assets:view:own', 'tasks:view:all', 'tasks:view:own', 'tasks:view:assigned', 'tasks:create', 'tasks:edit:all'] },

    // 4. Tugasan
    { icon: ICONS.briefcase, label: 'Tugasan', view: 'tasks' as DashboardView, requiredAnyPermissions: ['tasks:view:all', 'tasks:view:own', 'tasks:view:assigned'] },

    // 4.1 Tugasan Siap (submenu Tugasan)
    { icon: ICONS.checkCircle, label: 'Tugasan Siap', view: 'completed-tasks' as DashboardView, requiredAnyPermissions: ['tasks:view:all', 'tasks:view:own', 'tasks:view:assigned'], isSubmenu: true },

    // 4.2 Kelulusan Bayaran
    { icon: ICONS.checkCircle, label: 'Kelulusan Bayaran', view: 'payment-approvals' as DashboardView, requiredAnyPermissions: ['payments:view:all', 'payments:view:own', 'payments:approve', 'payments:mark_paid'] },

    // 4.3 AI Instruction
    { icon: ICONS.sparkles, label: 'AI Instruction', view: 'ai-instruction' as DashboardView, requiredAnyPermissions: ['tasks:create', 'ai:task:view', 'ai:masterlist:view'] },

    // 7. Main-con
    { icon: ICONS.userGroup, label: 'Main-Con', view: 'main-cons' as DashboardView, requiredAnyPermissions: ['maincons:view:all', 'maincons:view:own'] },

    // 8. Notifikasi
    { icon: ICONS.bell, label: 'Notifikasi', view: 'notifications' as DashboardView, requiredAnyPermissions: ['notifications:view:all', 'notifications:view:own', 'notifications:view'] },

    // 9. Laporan
    { icon: ICONS.chartBar, label: 'Laporan', view: 'reports' as DashboardView, requiredAnyPermissions: ['reports:view:all', 'reports:view:own'] },

    // 10. Tetapan
    { icon: ICONS.cog, label: 'Tetapan', view: 'settings' as DashboardView, requiredPermission: 'settings:view' },
  ];

  const visibleMenuItems = menuItems.filter(item => {
    if (item.requiredAnyPermissions && item.requiredAnyPermissions.length > 0) {
      return item.requiredAnyPermissions.some(permission => hasPermission(permission));
    }
    return !item.requiredPermission || hasPermission(item.requiredPermission);
  });

  // Use the role string from currentUser directly, fallback to roles array lookup if needed
  const rawRoleId = (currentUser as any).roleId ?? (currentUser as any).role_id ?? (currentUser as any).role?.id;
  const resolvedRoleId = typeof rawRoleId === 'string' ? Number(rawRoleId) : rawRoleId;
  const roleName = currentUser.role || roles.find(r => r.id === resolvedRoleId)?.name || 'Tiada Peranan';

  return (
    <aside className="w-64 h-full min-h-0 flex-shrink-0 bg-gray-800 text-white flex flex-col">
      <div className="h-16 flex items-center justify-center px-4 bg-gray-900">
        <h1 className="text-2xl font-bold text-white">SPFIT</h1>
      </div>
      <nav className="flex-1 min-h-0 overflow-y-auto px-3 py-4 space-y-2">
        {visibleMenuItems.map(item => (
          <NavLink 
            key={item.label} 
            icon={item.icon} 
            label={item.label} 
            active={activeView === item.view}
            isSubmenu={item.isSubmenu}
            onClick={() => onNavigate(item.view)}
          />
        ))}
        {/* Manual Pengguna - opens in new tab */}
        <button
          onClick={() => window.open('/doc', '_blank')}
          className="w-full flex items-center px-4 py-2.5 text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white rounded-lg transition-colors text-left"
        >
          <span className="mr-3 flex-shrink-0">📖</span>
          Manual Pengguna
        </button>
      </nav>
      <div className="p-4 border-t border-gray-700">
        <div className="flex items-center">
            <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center font-bold">
                {currentUser.name.charAt(0)}
            </div>
            <div className="ml-3">
                <p className="text-sm font-medium text-white">{currentUser.name}</p>
                <p className="text-xs text-gray-400">{roleName}</p>
            </div>
        </div>
        <button
            onClick={onLogout}
            className="w-full mt-4 flex items-center justify-center py-2 px-4 text-sm font-medium rounded-md text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
        >
            {ICONS.logout}
            <span className="ml-2">Log Keluar</span>
        </button>
      </div>
    </aside>
  );
};


