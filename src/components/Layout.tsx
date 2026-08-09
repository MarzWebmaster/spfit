import React from 'react';
import { Sidebar } from './Sidebar';
import type { User, DashboardView, Permission, Role } from '../types';
import { Menu } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  currentUser: User;
  onLogout: () => void;
  onNavigate: (view: DashboardView) => void;
  activeView: DashboardView;
  hasPermission: (permission: Permission) => boolean;
  roles: Role[];
}

export const Layout: React.FC<LayoutProps> = ({ children, currentUser, onLogout, onNavigate, activeView, hasPermission, roles }) => {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  console.debug('🏗️ Layout render - currentUser:', currentUser);
  console.debug('🏗️ Layout render - activeView:', activeView);
  console.debug('🏗️ Layout render - roles:', roles);

  const handleNavigate = (view: DashboardView) => {
    onNavigate(view);
    setSidebarOpen(false);
  };
  
  return (
    <div className="flex min-h-screen h-dvh bg-gray-100 overflow-hidden">
      <div className={`fixed inset-y-0 left-0 z-40 transition-transform duration-200 lg:static lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <Sidebar 
          currentUser={currentUser}
          onLogout={onLogout}
          onNavigate={handleNavigate}
          activeView={activeView}
          hasPermission={hasPermission}
          roles={roles}
        />
      </div>

      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Tutup menu"
        />
      )}

      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="inline-flex items-center justify-center rounded-md border border-gray-200 p-2 text-gray-700"
            aria-label="Buka menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-semibold text-gray-800">SPFIT</h1>
        </div>

        <main className="flex-1 min-h-0 overflow-x-hidden overflow-y-auto bg-gray-100 p-3 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
};