import React, { useState, useEffect, useMemo } from 'react';
import type { User, Task, Freelancer, DashboardView, Notification, SettingsView, Webhook, NotificationTemplate, SmtpSettings, ActivityLogEntry, DetailedRating, Role, Permission } from './types';
import { UserRole, TaskStatus, UserStatus, NotificationType } from './types';
// Hapus penggunaan data statik; semua data diambil dari database
import { useApiData } from './hooks/useApiData';
import { rolesApi, authApi, wasapmaticApi, offersApi, usersApi, freelancersApi } from './services/api';
import { settingsService } from './services/settingsService';
// sessionMonitoring is now handled by AuthContext
import { useAuth } from './contexts/AuthContext';
import { ErrorBoundary, initializeGlobalErrorHandlers } from './components/ErrorBoundary';
import { Routes, Route, Navigate, useNavigate, useLocation, Outlet } from 'react-router-dom';

import { LoginScreen } from './components/LoginScreen.tsx';
import { Register } from './components/Register.tsx';
import { Layout } from './components/Layout.tsx';

import { AdminDashboard } from './components/AdminDashboard.tsx';
import { FreelancerDashboard } from './components/FreelancerDashboard.tsx';
import { ManagementDashboard } from './components/ManagementDashboard.tsx';
import { OperationsDashboard } from './components/OperationsDashboard.tsx';

import { TaskManagementPage } from './components/TaskManagementPage.tsx';
import { MyTasksPage } from './components/MyTasksPage.tsx';
import { FreelancerManagementPage } from './components/FreelancerManagementPage.tsx';
import { FreelancerProfilePage } from './components/FreelancerProfilePage.tsx';
import { NotificationsPage } from './components/NotificationsPage.tsx';
import { ReportsPage } from './components/ReportsPage.tsx';
import { SettingsPage } from './components/SettingsPage.tsx';
import { MainConsManagement } from './components/settings/MainConsManagement.tsx';


import { CreateTaskModal } from './components/CreateTaskModal.tsx';
import { TaskDetailsModal } from './components/TaskDetailsModal.tsx';
import { AssignTechModal } from './components/AssignTechModal.tsx';
import { EditTaskModal } from './components/EditTaskModal.tsx';
import { UploadReportModal } from './components/UploadReportModal.tsx';
import { AddFreelancerModal } from './components/AddFreelancerModal.tsx';
import { RateFreelancerModal } from './components/RateFreelancerModal.tsx';
import { TemplateEditorModal } from './components/settings/TemplateEditorModal.tsx';
import { UserDetailsModal } from './components/UserDetailsModal.tsx';
import { AddUserModal } from './components/settings/AddUserModal.tsx';
import { EditUserModal } from './components/settings/EditUserModal.tsx';
import { BanUserModal } from './components/settings/BanUserModal.tsx';
import { RoleEditorModal } from './components/settings/RoleEditorModal.tsx';
import { Toast } from './components/ui/Toast.tsx';



import { TaskViewPage } from './components/TaskViewPage.tsx';
import { TaskViewPageWrapper } from './components/TaskViewPageWrapper.tsx';
import { TaskFormPage } from './components/TaskFormPage.tsx';
import { CompletedTasksPage } from './components/CompletedTasksPage.tsx';
import { CompletedTaskDetailPage } from './components/CompletedTaskDetailPage.tsx';
import { PaymentApprovalsPage } from './components/PaymentApprovalsPage.tsx';
import { PaymentDetailPage } from './components/PaymentDetailPage.tsx';
import { ProjectsPage } from './components/ProjectsPage.tsx';
import { ProjectViewPage } from './components/ProjectViewPage.tsx';
import { ProjectFormPage } from './components/ProjectFormPage.tsx';
import { MasterlistsPage } from './components/MasterlistsPage.tsx';
import { MasterlistViewPage } from './components/MasterlistViewPage.tsx';
import { MasterlistFormPage } from './components/MasterlistFormPage.tsx';
import { AssetsPage } from './components/AssetsPage.tsx';
import { AssetFormPage } from './components/AssetFormPage.tsx';
import { AssetViewPage } from './components/AssetViewPage.tsx';
import { UserManualPage } from './components/UserManualPage.tsx';
import { AIInstructionPage } from './components/AIInstructionPage.tsx';
import { ArrivalConfirmationPage } from './components/ArrivalConfirmationPage.tsx';

// Helper function to get initial state from database
const getInitialStateFromDB = async () => {
  try {
    // Try to get current user from localStorage first (for session restoration)
    const currentUser = JSON.parse(localStorage.getItem('spfit_current_user') || 'null');
    
    // Get settings from database
    const settingsKeys = [
      'spfit_webhooks',
      'spfit_notification_templates',
      'spfit_default_freelancer_role_id',
      'spfit_smtp_settings'
    ];
    
    const settings = await settingsService.getSettingsByKeys(settingsKeys);
    
    const parseArraySetting = (value: string | undefined): any[] => {
      if (!value) return [];
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    };

    return {
      currentUser,
      webhooks: parseArraySetting(settings.spfit_webhooks),
      notificationTemplates: parseArraySetting(settings.spfit_notification_templates),
      defaultFreelancerRoleId: (() => {
        const val = settings.spfit_default_freelancer_role_id;
        if (!val) return 3;
        try {
            // Handle potential double-JSON encoding or just string
            let cleanVal = val;
            if (typeof val === 'string' && val.trim().startsWith('{')) {
                try {
                    const parsed = JSON.parse(val);
                    if (parsed && parsed.setting_value) {
                        cleanVal = parsed.setting_value;
                    }
                } catch {}
            }
            const num = parseInt(cleanVal);
            return isNaN(num) ? 3 : num;
        } catch {
            return 3;
        }
      })(),
      smtpSettings: settings.spfit_smtp_settings ? JSON.parse(settings.spfit_smtp_settings) : {
        server: '',
        port: 587,
        username: '',
        password: '',
        fromAddress: '',
        security: 'TLS'
      }
    };
  } catch (error) {
    console.error('Error loading initial state:', error);
    // Fallback to localStorage if database fails
    try {
      const parseLocalArray = (key: string): any[] => {
        try {
          const parsed = JSON.parse(localStorage.getItem(key) || '[]');
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      };

      return {
        currentUser: JSON.parse(localStorage.getItem('spfit_current_user') || 'null'),
        webhooks: parseLocalArray('spfit_webhooks'),
        notificationTemplates: parseLocalArray('spfit_notification_templates'),
        defaultFreelancerRoleId: parseInt(localStorage.getItem('spfit_default_freelancer_role_id') || '3'),
        smtpSettings: JSON.parse(localStorage.getItem('spfit_smtp_settings') || JSON.stringify({
          server: '',
          port: 587,
          username: '',
          password: '',
          fromAddress: '',
          security: 'TLS'
        }))
      };
    } catch (fallbackError) {
      console.error('Error parsing localStorage data:', fallbackError);
      return {
        currentUser: null,
        webhooks: [],
        notificationTemplates: [],
        defaultFreelancerRoleId: 3,
        smtpSettings: {
          server: '',
          port: 587,
          username: '',
          password: '',
          fromAddress: '',
          security: 'TLS'
        }
      };
    }
  }
};

const App: React.FC = () => {
  // Initialize global error handlers
  useEffect(() => {
    initializeGlobalErrorHandlers();
  }, []);

  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
};

// RoleBasedRedirect Component
const RoleBasedRedirect = ({ roles, user }: { roles: Role[], user: User | Freelancer | null }) => {
    if (!user) return <Navigate to="/login" />;
    
    // Find user's role
    // First try to find by ID
    let userRole = roles.find(r => r.id === user.roleId);
    
    // Fallback logic if roles not loaded yet or mismatch
    // (Wait for roles to load if possible, but here we just proceed)
    
    const roleTypeId = userRole?.roleTypeId;
    
    // Debug
    console.log('RoleBasedRedirect:', { userRole, roleTypeId, user });

    if (!roleTypeId) {
        // Fallback based on name or default
        if (user.role === UserRole.ADMIN) return <Navigate to="/dashboard/pentadbiran" />;
        if (user.role === UserRole.FREELANCER) return <Navigate to="/dashboard/freelancer" />;
        return <Navigate to="/dashboard/pentadbiran" />;
    }

    switch (roleTypeId) {
        case 1: return <Navigate to="/dashboard/pentadbiran" />; // Pentadbiran
        case 2: return <Navigate to="/dashboard/pengurusan" />; // Pengurusan
        case 3: return <Navigate to="/dashboard/operasi" />; // Operasi
        case 4: return <Navigate to="/dashboard/freelancer" />; // Luaran / Freelancer
        default: return <Navigate to="/dashboard/pentadbiran" />;
    }
};

const AppContent: React.FC = () => {
  // Navigation hooks
  const navigate = useNavigate();
  const location = useLocation();

  // const [view, setView] = useState<'login' | 'register' | 'dashboard'>('login'); // Removed in favor of Routes
  const [dashboardView, setDashboardView] = useState<DashboardView>('dashboard');
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  
  // Use AuthContext instead of local state
  const { user: currentUser, isAuthenticated, updateLastActivity, login, logout, isInitialized: authInitialized } = useAuth();
  
  // Use API data instead of localStorage
  const { 
    tasks, 
    users, 
    freelancers, 
    notifications, 
    loading, 
    error, 
    refreshData, 
    createTask, 
    updateTask, 
    deleteTask, 
    createUser, 
    updateUser, 
    deleteUser, 
    createFreelancer, 
    updateFreelancer, 
    deleteFreelancer, 
    markNotificationAsRead: markNotificationRead 
  } = useApiData();

  const markNotificationAsRead = async (notificationId: number) => {
    try {
        await markNotificationRead(notificationId);
        await refreshData();
    } catch (error) {
        console.error('Error marking notification as read:', error);
        showToast('Gagal menandakan notifikasi sebagai dibaca.', 'error');
    }
  };
  
  // Settings state - initialized from database
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [notificationTemplates, setNotificationTemplates] = useState<NotificationTemplate[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [defaultFreelancerRoleId, setDefaultFreelancerRoleId] = useState<number>(3);
  const [selfFreelancerProfileFromApi, setSelfFreelancerProfileFromApi] = useState<Freelancer | null>(null);
  const [selfFreelancerProfileLoading, setSelfFreelancerProfileLoading] = useState<boolean>(false);
  const [smtpSettings, setSmtpSettings] = useState<SmtpSettings>({
      server: '',
      port: 587,
      username: '',
      password: '',
      fromAddress: '',
      security: 'TLS'
  });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Data is now destructured directly from useApiData hook above

  // Effect to robustly synchronize system roles from code defaults to state.
  // Roles diambil sepenuhnya dari database (settings), tanpa fallback constants


  // Persist settings to database whenever they change
  const saveSettingToDatabase = async (key: string, value: any) => {
    try {
      if (!isAuthenticated() || !currentUser) {
        localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
        return;
      }
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      // Try update first; if not exist, create
      let shouldCreate = false;
      try {
        const existing = await settingsService.getSettingByKey(key);
        if (!existing?.success) {
          shouldCreate = true;
        }
      } catch {
        shouldCreate = true;
      }
      if (shouldCreate) {
        await settingsService.createSetting({ key, value: stringValue });
      } else {
        await settingsService.updateSetting(key, { setting_value: stringValue });
      }
    } catch (error) {
      console.error(`Error saving ${key} to database:`, error);
      // Fallback to localStorage if database fails
      localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
    }
  };

  // Initialize state from database on component mount
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Initialize default settings and migrate from localStorage if needed
        await settingsService.initializeDefaultSettings();
        await settingsService.migrateFromLocalStorage();
        
        // Load initial state from database
        const initialState = await getInitialStateFromDB();
        // Don't set currentUser here - let checkAuthToken handle session restoration
        setWebhooks(Array.isArray(initialState.webhooks) ? initialState.webhooks : []);
        setNotificationTemplates(Array.isArray(initialState.notificationTemplates) ? initialState.notificationTemplates : []);
        // roles are now loaded via API only, don't set from legacy settings
        // setRoles(Array.isArray(initialState.roles) ? initialState.roles : []);
        setDefaultFreelancerRoleId(initialState.defaultFreelancerRoleId);
        setSmtpSettings(initialState.smtpSettings);

        // Don't set view here - let checkAuthToken handle session restoration
        
        setIsInitialized(true);
      } catch (error) {
        console.error('Error initializing app:', error);
        setIsInitialized(true); // Still mark as initialized to show the app
      }
    };

    initializeApp();
  }, []);

  // Ensure a default Whatsapp template exists for task offers
  useEffect(() => {
    const ensureDefaultWhatsappTemplate = async () => {
      try {
        if (!Array.isArray(notificationTemplates)) {
          console.error('notificationTemplates is not an array:', notificationTemplates);
          setNotificationTemplates([]);
          return;
        }
        const hasWhatsappOfferTemplate = notificationTemplates.some(
          t => t.type === NotificationType.TASK_OFFER && t.channel === 'Whatsapp'
        );
        if (!hasWhatsappOfferTemplate) {
          const newTemplate: NotificationTemplate = {
            id: Date.now(),
            type: NotificationType.TASK_OFFER,
            channel: 'Whatsapp',
            name: 'Tawaran Standard (Whatsapp)',
            subjectOrTitle: 'Tawaran Tugasan Baru',
            body: 'Salam {{freelancerName}}, anda menerima tawaran tugasan: {{taskTitle}} di {{taskLocation}} dengan bayaran RM{{taskPrice}}.\n\nTerima: {{acceptLink}}\nTolak: {{rejectLink}}\n\nSila maklum balas segera.',
            isDefault: true,
          };
          const updated = [...notificationTemplates, newTemplate];
          setNotificationTemplates(updated);
          await saveSettingToDatabase('spfit_notification_templates', updated);
        }
      } catch (e) {
        console.error('Failed to ensure default Whatsapp template:', e);
      }
    };
    if (isInitialized && notificationTemplates) {
      ensureDefaultWhatsappTemplate();
    }
  }, [isInitialized, notificationTemplates]);

  // Load data from API on component mount
  useEffect(() => {
    if (currentUser) {
      refreshData();
    }
  }, [currentUser, refreshData]);

    // Load roles from API when user is authenticated
    useEffect(() => {
      const loadRoles = async () => {
        if (currentUser && isAuthenticated()) {
          try {
            const response = await rolesApi.getAll();
            if (response.success && response.data) {
              const rolesData = Array.isArray(response.data)
                ? response.data
                : ((response.data as any).roles || []);
              setRoles(rolesData);
            }
          } catch (error) {
            console.error('Error loading roles:', error);
          }
        }
      };
      loadRoles();
    }, [currentUser, isAuthenticated]);

  // Sync dashboardView with location to keep Sidebar active state correct
  useEffect(() => {
    const path = location.pathname;
    if (path.includes('/dashboard')) setDashboardView('dashboard');
    else if (path.includes('/masterlists')) setDashboardView('masterlists');
    else if (path.includes('/assets')) setDashboardView('assets');
    else if (path.includes('/projects')) setDashboardView('projects');
    else if (path.includes('/ai-instruction')) setDashboardView('ai-instruction');
    else if (path.includes('/tasks/completed')) setDashboardView('completed-tasks');
    else if (path.includes('/tasks')) setDashboardView('tasks');
    else if (path.includes('/my-tasks')) setDashboardView('my-tasks');
    else if (path.includes('/freelancers')) setDashboardView('freelancers');
    else if (path.includes('/payment-approvals')) setDashboardView('payment-approvals');
    else if (path.includes('/notifications')) setDashboardView('notifications');
    else if (path.includes('/reports')) setDashboardView('reports');
    else if (path.includes('/main-cons')) setDashboardView('main-cons');
    else if (path.includes('/settings')) setDashboardView('settings');
    else if (path.includes('/freelancer-profile')) setDashboardView('freelancer-profile');
  }, [location]);

  // Load data when user is authenticated
  useEffect(() => {
    if (isAuthenticated() && currentUser && authInitialized) {
      refreshData();
    }
  }, [currentUser, authInitialized]); // Remove isAuthenticated and refreshData to prevent loop
  
  // Settings sub-navigation state
  const [settingsView, setSettingsView] = useState<SettingsView>('hub');
  const [auditInitialSearch, setAuditInitialSearch] = useState<string | undefined>(undefined);
  const [auditInitialTable, setAuditInitialTable] = useState<string | undefined>(undefined);

  // FIX: Correctly type allUsers and populate the 'role' property.
  const allUsers: (User | Freelancer)[] = useMemo(() => {
    return users.map(u => ({
      ...u,
      roleId: (u as any).roleId || (u as any).role_id || (u as any).role?.id,
      role: roles.find(r => r.id === ((u as any).roleId || (u as any).role_id || (u as any).role?.id))?.name as UserRole
    }));
  }, [users, roles]);

  const selfFreelancerProfileFromList = useMemo(() => {
    if (!currentUser?.id) return null;
    return freelancers.find((f) => f.id === currentUser.id) || null;
  }, [freelancers, currentUser]);

  const selfFreelancerProfile = useMemo(() => {
    return selfFreelancerProfileFromList || selfFreelancerProfileFromApi;
  }, [selfFreelancerProfileFromList, selfFreelancerProfileFromApi]);

  const roleFallbackPermissions = useMemo<Permission[]>(() => {
    const normalizedRole = String(currentUser?.role || '').toLowerCase();
    if (!normalizedRole.includes('freelanc')) {
      return [];
    }

    return [
      'tasks:view:assigned',
      'tasks:view:own',
      'tasks:submit_report',
      'freelancers:view:own',
      'settings:manage:profile',
      'notifications:view:own'
    ];
  }, [currentUser]);

  useEffect(() => {
    const fetchSelfFreelancerProfile = async () => {
      if (!currentUser?.id) {
        setSelfFreelancerProfileFromApi(null);
        return;
      }

      if (selfFreelancerProfileFromList) {
        setSelfFreelancerProfileFromApi(selfFreelancerProfileFromList);
        return;
      }

      const currentPermissions = Array.isArray((currentUser as any).permissions)
        ? ((currentUser as any).permissions as Permission[])
        : [];
      const effectivePermissions = Array.from(new Set<Permission>([
        ...currentPermissions,
        ...roleFallbackPermissions
      ]));
      const normalizedRole = String(currentUser.role || '').toLowerCase();
      const canAccessFreelancerRoute =
        normalizedRole === UserRole.ADMIN.toLowerCase() ||
        normalizedRole.includes('freelanc') ||
        effectivePermissions.includes('freelancers:view:all') ||
        effectivePermissions.includes('freelancers:view:own') ||
        effectivePermissions.includes('freelancers:manage');

      if (!canAccessFreelancerRoute) {
        setSelfFreelancerProfileFromApi(null);
        return;
      }

      setSelfFreelancerProfileLoading(true);
      try {
        const response = await freelancersApi.getById(currentUser.id);
        if (!response.success || !response.data) {
          setSelfFreelancerProfileFromApi(null);
          return;
        }

        const rawFreelancer = (response.data as any).freelancer || response.data;
        const normalizedFreelancer: Freelancer = {
          ...(rawFreelancer as any),
          id: rawFreelancer.id,
          name: rawFreelancer.name || currentUser.name,
          email: rawFreelancer.email || currentUser.email || '',
          phone: rawFreelancer.phone || '',
          roleId: rawFreelancer.roleId || rawFreelancer.role_id || (currentUser as any).roleId,
          role: (rawFreelancer.role as any) || currentUser.role,
          status: rawFreelancer.status || currentUser.status,
          permissions: effectivePermissions,
          icNumber: rawFreelancer.icNumber || rawFreelancer.ic_number || '',
          ic_number: rawFreelancer.ic_number || rawFreelancer.icNumber || '',
          experience: Number(rawFreelancer.experience) || 0,
          rating: Number(rawFreelancer.rating) || 0,
          isAvailable: rawFreelancer.isAvailable ?? rawFreelancer.is_available ?? true,
          locations: Array.isArray(rawFreelancer.locations) ? rawFreelancer.locations : [],
          skills: Array.isArray(rawFreelancer.skills) ? rawFreelancer.skills : [],
          bankAccounts: Array.isArray(rawFreelancer.bankAccounts) ? rawFreelancer.bankAccounts : []
        };

        setSelfFreelancerProfileFromApi(normalizedFreelancer);
      } catch (error) {
        console.error('Error fetching self freelancer profile:', error);
        setSelfFreelancerProfileFromApi(null);
      } finally {
        setSelfFreelancerProfileLoading(false);
      }
    };

    fetchSelfFreelancerProfile();
  }, [currentUser, selfFreelancerProfileFromList]);

  const getCurrentUserRoleId = (): number | undefined => {
    if (!currentUser) return undefined;
    const rawRoleId =
      (currentUser as any).roleId ??
      (currentUser as any).role_id ??
      (currentUser as any).role?.id;
    if (typeof rawRoleId === 'number') return rawRoleId;
    if (typeof rawRoleId === 'string') {
      const parsed = Number(rawRoleId);
      return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
  };

  const hasPermission = (permission: Permission): boolean => {
    // console.debug('🔐 hasPermission called with:', permission);
    if (!currentUser) {
    //   console.debug('❌ No currentUser');
      return false;
    }
    // Admin has access to all permissions
    if ((currentUser.role || '').toLowerCase() === UserRole.ADMIN.toLowerCase()) {
      return true;
    }
    // console.debug('👤 currentUser:', currentUser);
    const currentRoleId = getCurrentUserRoleId();
    const userRole = roles.find(r => r.id === currentRoleId);
    // console.debug('🎭 userRole found:', userRole);
    const storedPermissions = Array.isArray((currentUser as any).permissions)
      ? ((currentUser as any).permissions as Permission[])
      : [];
    const fallbackPermissions = Array.from(new Set<Permission>([
      ...storedPermissions,
      ...roleFallbackPermissions
    ]));
    const hasAccess = userRole?.permissions.includes(permission) || fallbackPermissions.includes(permission);
    // console.debug('✅ hasAccess result:', hasAccess);
    return hasAccess;
  };

  const hasAnyPermission = (permissions: Permission[]): boolean => {
    return permissions.some(permission => hasPermission(permission));
  };

  const hasRolePermission = (permission: Permission): boolean => {
    if (!currentUser) return false;
    const currentRoleId = getCurrentUserRoleId();
    const userRole = roles.find(r => r.id === currentRoleId);
    const storedPermissions = Array.isArray((currentUser as any).permissions)
      ? ((currentUser as any).permissions as Permission[])
      : [];
    const fallbackPermissions = Array.from(new Set<Permission>([
      ...storedPermissions,
      ...roleFallbackPermissions
    ]));
    return userRole?.permissions.includes(permission) || fallbackPermissions.includes(permission);
  };

  const isAdminOrStaffTaskEditor = (() => {
    const normalizedRole = String(
      currentUser?.role ||
      (currentUser as any)?.roleName ||
      (currentUser as any)?.role_name ||
      ''
    ).toLowerCase();

    return normalizedRole.includes('admin') || normalizedRole.includes('staff');
  })();

  const canSubmitTaskFormByRole = hasRolePermission('tasks:submit_report');
  const canOpenCompletedTaskFormByRole = hasPermission('tasks:manage_completed_form');

  const ProtectedRoute: React.FC<{ canAccess: boolean; children: React.ReactElement }> = ({ canAccess, children }) => {
    if (!canAccess) {
      return <Navigate to="/" replace />;
    }
    return children;
  };

  const canAccessSettings = hasAnyPermission([
    'settings:view',
    'settings:manage:profile',
    'settings:manage:users',
    'settings:manage:roles',
    'settings:manage:mail',
    'settings:manage:templates',
    'settings:manage:api',
    'system.admin'
  ]);

  // Reset settings view when navigating away from the main settings page
  useEffect(() => {
    if (dashboardView !== 'settings') {
      setSettingsView('hub');
    }
  }, [dashboardView]);
  
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
  };
  
  const logActivity = (userId: number, action: string, details?: string) => {
    const newLogEntry: ActivityLogEntry = {
      timestamp: new Date().toLocaleString('ms-MY'),
      action,
      details,
      performedBy: currentUser?.name || 'Sistem',
    };

    // Activity logging is handled by backend. Refreshing data will show the new log.
    console.log('📝 Activity Logged:', newLogEntry);
  };

  // Handle login callback from LoginScreen.
  // LoginScreen already authenticates via authApi.login and passes the authenticated user here.
  // Keep credential-based fallback for compatibility with older callers.
  const handleLogin = async (loginData: any) => {
    console.log('🔑 App handleLogin called with:', loginData);
    
    try {
      const hasCredentials = Boolean(loginData?.email && loginData?.password);

      if (hasCredentials) {
        const { email, password, rememberMe, location } = loginData;
        const loginResponse = await authApi.login(email, password, rememberMe, location);

        if (loginResponse.success && loginResponse.data) {
          const { accessToken, user, sessionId } = loginResponse.data;
          login(accessToken, user, sessionId, Boolean(rememberMe));
          setLoginError(null);
          navigate('/');
          logActivity(user.id, 'Log Masuk');
          console.log('🔑 Login successful');
        } else {
          setLoginError('Login gagal. Sila semak e-mel dan kata laluan anda.');
        }
        return;
      }

      if (loginData?.id) {
        setLoginError(null);
        navigate('/');
        logActivity(loginData.id, 'Log Masuk');
        console.log('🔑 Login callback successful (existing session/user payload)');
        return;
      }

      setLoginError('Data login tidak sah. Sila cuba lagi.');
    } catch (error: any) {
      console.error('🔑 Login error:', error);
      setLoginError(`Ralat login: ${error.message}`);
    }
  }

  const handleLogout = async () => {
    console.log('🚪 Logout initiated');
    await logout();
    // setView('login'); // Removed
    navigate('/login');
    console.log('🚪 Logout successful');
  };

  const handleRegister = async (
    newFreelancerData: Omit<Freelancer, 'id' | 'isAvailable' | 'roleId' | 'rating' | 'status' | 'activityLog'> & {
      password?: string;
      confirmPassword?: string;
    }
  ) => {
    try {
      const { authApi } = await import('./services/api');
      
      // Prepare registration data for backend API
      const registrationData = {
        name: newFreelancerData.name,
        email: newFreelancerData.email,
        password: newFreelancerData.password,
        phone: newFreelancerData.phone,
        ic_number: newFreelancerData.icNumber,
        skills: newFreelancerData.skills,
        locations: newFreelancerData.locations,
        experience: newFreelancerData.experience
      };
      
      console.log('Registering user with data:', registrationData);
      const response = await authApi.register(registrationData);
      
      if (response.success) {
        showToast('Pendaftaran berjaya! Sila log masuk dengan e-mel anda.', 'success');
        // setView('login'); // Removed
        navigate('/login');
        // Refresh data to get the new user
        await refreshData();
      } else {
        showToast((response as any).error || response.message || 'Pendaftaran gagal. Sila cuba lagi.', 'error');
      }
    } catch (error) {
      console.error('Registration error:', error);
      showToast('Pendaftaran gagal. Sila cuba lagi.', 'error');
    }
  };

  const handleAddFreelancer = async (newFreelancerData: Omit<Freelancer, 'id' | 'isAvailable' | 'roleId' | 'rating' | 'status' | 'activityLog'>) => {
    try {
      // Debug: Log current user and permissions
      console.debug('🔐 Current user:', currentUser);
      console.debug('🔐 Current user role ID:', currentUser?.roleId);
      const currentUserRole = roles.find(r => r.id === currentUser?.roleId);
      console.debug('🔐 Current user role:', currentUserRole);
      console.debug('🔐 Current user permissions:', currentUserRole?.permissions);
      console.debug('🔐 Has settings:manage:users permission:', hasPermission('settings:manage:users'));
      
      // Debug: Log current roles state
      console.debug('Current roles state:', roles);
      console.debug('Looking for role with name "Freelancer"');
      
      // Find freelancer role
      let freelancerRole = roles.find(r => r.name === UserRole.FREELANCER);
      console.debug('Found freelancer role:', freelancerRole);
      
      // If not loaded yet, fetch roles once and retry lookup
      if (!freelancerRole) {
        try {
          const { rolesApi } = await import('./services/api');
          const rolesResp = await rolesApi.getAll();
          if (rolesResp.success && rolesResp.data) {
            const serverRoles = (rolesResp.data as any).roles || rolesResp.data;
            if (Array.isArray(serverRoles) && serverRoles.length) {
              setRoles(serverRoles);
              freelancerRole = serverRoles.find((r: any) => r.name === UserRole.FREELANCER);
            }
          }
        } catch {}
      }

      if (!freelancerRole) {
        showToast('Ralat: Peranan Freelancer tidak dijumpai. Sila hubungi pentadbir.', 'error');
        return;
      }

      // Prepare user data for API
      const userData = {
        name: newFreelancerData.name,
        email: newFreelancerData.email,
        password: 'defaultPassword123', // You may want to generate a random password or ask user to set it
        role_id: freelancerRole.id,
        phone: newFreelancerData.phone,
        ic_number: newFreelancerData.icNumber,
        experience: newFreelancerData.experience
      };

      // Call API to create user
      const { usersApi } = await import('./services/api');
      const response = await usersApi.create(userData);
      
      if (response.success && response.data) {
        // Refresh data to get updated user list
        await refreshData();
        showToast('Freelancer baru berjaya ditambah!', 'success');
        setAddFreelancerModalOpen(false);
      } else {
        throw new Error(response.message || 'Gagal mencipta freelancer');
      }
    } catch (error: any) {
      console.error('Error creating freelancer:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Gagal mencipta freelancer';
      showToast(`Ralat: ${errorMessage}`, 'error');
    }
  };
  
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [isDetailsModalOpen, setDetailsModalOpen] = useState(false);
  const [isAssignModalOpen, setAssignModalOpen] = useState(false);
  const [isEditTaskModalOpen, setEditTaskModalOpen] = useState(false);
  const [isUploadModalOpen, setUploadModalOpen] = useState(false);
  const [isAddFreelancerModalOpen, setAddFreelancerModalOpen] = useState(false);
  const [isRateModalOpen, setRateModalOpen] = useState(false);
  const [isTemplateEditorModalOpen, setTemplateEditorModalOpen] = useState(false);
  const [isUserDetailsModalOpen, setUserDetailsModalOpen] = useState(false);
  const [isAddUserModalOpen, setAddUserModalOpen] = useState(false);
  const [isEditUserModalOpen, setEditUserModalOpen] = useState(false);
  const [isBanUserModalOpen, setBanUserModalOpen] = useState(false);
  const [isRoleEditorModalOpen, setRoleEditorModalOpen] = useState(false);


  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedFreelancer, setSelectedFreelancer] = useState<Freelancer | null>(null);
  const [templateToEdit, setTemplateToEdit] = useState<NotificationTemplate | null>(null);
  const [selectedUserForDetails, setSelectedUserForDetails] = useState<User | Freelancer | null>(null);
  const [userToEdit, setUserToEdit] = useState<User | Freelancer | null>(null);
  const [userToBan, setUserToBan] = useState<User | Freelancer | null>(null);
  const [roleToEdit, setRoleToEdit] = useState<Role | null>(null);


  const handleViewTask = (task: Task) => {
    setSelectedTask(task);
    setDetailsModalOpen(true);
  };

  const handleCreateTask = async (newTaskData: any) => {
    console.log('📝 handleCreateTask called with:', newTaskData);
    try {
      console.log('🔄 Calling createTask...');
      const result = await createTask(newTaskData);
      console.log('✅ createTask result:', result);
      
      if (!result?.success) {
        const errorMsg = result?.error || 'Gagal mencipta tugasan';
        console.error('❌ Task creation failed:', errorMsg);
        showToast(errorMsg, 'error');
        return; // Don't close modal on error
      }
      
      console.log('🔄 Refreshing data...');
      // Small delay to ensure DB transaction is committed
      await new Promise(resolve => setTimeout(resolve, 500));
      await refreshData();
      console.log('✅ Data refreshed');
      
      const createdTask = result?.data as any;
      const taskRef = createdTask?.log_number || createdTask?.logNumber || `ID ${createdTask?.id}`;
      showToast(`Tugasan baru berjaya dicipta (${taskRef}).`, 'success');
      setCreateModalOpen(false);
    } catch (error: any) {
      console.error('💥 Error creating task:', error);
      const message = error?.message || 'Gagal mencipta tugasan. Sila cuba lagi.';
      showToast(message, 'error');
      // Don't close modal on error
    }
  };

  const handleAssignClick = (task: Task) => {
      setSelectedTask(task);
      setDetailsModalOpen(false);
      setAssignModalOpen(true);
  };

  const handleEditTask = async (taskId: number, updates: any) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;

      await updateTask(taskId, { ...task, ...updates });
      await refreshData();
      showToast('Tugasan berjaya dikemaskini!', 'success');
      setEditTaskModalOpen(false);
    } catch (error: any) {
      console.error('Error updating task:', error);
      const message = error?.message || 'Gagal mengemaskini tugasan. Sila cuba lagi.';
      showToast(message, 'error');
    }
  };

  const handleEditTaskClick = (task: Task) => {
    setSelectedTask(task);
    setDetailsModalOpen(false);
    setEditTaskModalOpen(true);
  };

    const handleSendOffers = async (
      taskId: number,
      freelancerIds: number[],
      methods: Array<'E-mel' | 'Whatsapp'>,
      emailTemplateId?: number,
      whatsappTemplateId?: number
    ) => {
      try {
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;

        let successCount = 0;
        let invalidCount = 0;

        // Send Whatsapp messages if selected
        if (methods.includes('Whatsapp')) {
          // Generate offer tokens first
          const tokenResponse = await offersApi.generate({
            taskId,
            freelancerIds
          });

          if (!tokenResponse.success || !(tokenResponse.data as any)?.offers) {
            showToast('Gagal menjana pautan tawaran. Sila cuba lagi.', 'error');
            return;
          }

          const offersData = (tokenResponse.data as any).offers;

          // Resolve Whatsapp template
          let whatsappTemplate = whatsappTemplateId
                  ? notificationTemplates.find(t => t.id === whatsappTemplateId)
                  : notificationTemplates.find(t => t.type === NotificationType.TASK_OFFER && t.channel === 'Whatsapp' && t.isDefault) ||
                    notificationTemplates.find(t => t.type === NotificationType.TASK_OFFER && t.channel === 'Whatsapp');

          if (!whatsappTemplate) {
            showToast('Tiada templat Whatsapp ditemui. Sila cipta templat terlebih dahulu.', 'error');
          } else {
            const interpolate = (template: string, ctx: Record<string, string | number>) =>
              template.replace(/\{\{(\w+)\}\}/g, (_, k) => String(ctx[k] ?? ''));

            const normalizeMsisdn = (phone: string) => {
              const digits = phone.replace(/\D/g, '');
              if (digits.startsWith('60')) return digits;
              if (digits.startsWith('0')) return '60' + digits.slice(1);
              if (phone.trim().startsWith('+60')) return digits;
              return digits;
            };

            for (const fid of freelancerIds) {
              const freelancer = freelancers.find(f => f.id === fid);
              if (!freelancer || !freelancer.phone) continue;

              // Find offer data for this freelancer
              const offerData = offersData.find((o: any) => o.freelancerId === fid);
              if (!offerData) continue;

              const msg = interpolate(whatsappTemplate.body, {
                freelancerName: freelancer.name,
                taskTitle: task.title,
                taskLocation: task.clientLocation,
                taskPrice: task.offerPrice,
                acceptLink: offerData.acceptLink,
                rejectLink: offerData.rejectLink,
              });
              try {
                const to = normalizeMsisdn(freelancer.phone);
                // Client-side normalisation preview, backend will normalise again
                const nationalized = to;
                const correlation_id = `TX-${taskId}-${fid}-${Date.now()}-${encodeURIComponent(freelancer.name)}`;
                const res = await wasapmaticApi.sendMessage({ 
                  to: nationalized, 
                  message: msg, 
                  correlation_id,
                  freelancer_id: fid,
                  freelancer_name: freelancer.name,
                  task_id: taskId,
                  task_title: task.title
                });
                if ((res as any)?.success) successCount += 1;
                // Prepare deep link to audit
                setAuditInitialSearch(correlation_id);
                setAuditInitialTable('whatsapp_messages');

                // Poll for status verification
                let verifiedStatus = 'queued';
                
                // Show processing toast if this takes time
                const processingToastId = `proc-${Date.now()}`;
                
                try {
                  let attempts = 0;
                  const maxAttempts = 10; // 5 seconds (500ms * 10)
                  
                  while (attempts < maxAttempts) {
                      await new Promise(r => setTimeout(r, 500));
                      try {
                          const statusRes = await wasapmaticApi.getDeliveryStatus(correlation_id);
                          if (statusRes.success && (statusRes.data as any)?.logs?.length > 0) {
                              const log = (statusRes.data as any).logs[0];
                              // Check main status or provider response status
                              const providerStatus = log.provider_payload?.status || (log.response as any)?.status;
                              
                              if (log.status === 'sent' || log.status === 'delivered') {
                                  verifiedStatus = 'sent';
                                  break;
                              } else if (log.status === 'failed') {
                                  verifiedStatus = 'failed';
                                  break;
                              }
                          }
                      } catch (e) {
                          console.warn('Polling error:', e);
                      }
                      attempts++;
                  }
                } catch (e) {
                  console.error('Verification loop error', e);
                }

                if (verifiedStatus === 'failed') {
                    console.error('Verification failed for', correlation_id);
                    invalidCount += 1;
                } else {
                    // 'sent' or 'queued' (timeout) - consider success since enqueue worked
                    successCount += 1;
                }

              } catch (e) {
                console.error('Wasapmatic send error for', freelancer.phone, e);
                invalidCount += 1;
              }
            }
            
            if (successCount === 0 && invalidCount > 0) {
              showToast('Gagal menghantar mesej Whatsapp. Sila semak log audit.', 'error');
            } else if (successCount === 0) {
              showToast('Tiada mesej berjaya dihantar.', 'error');
            }
          }
        }

        // Update task status after attempting notifications
        if (successCount > 0) {
          await updateTask(taskId, { ...task, status: TaskStatus.TAWARAN_DIHANTAR });
        }
        await refreshData();

        const methodString = methods.join(' & ');
        setAssignModalOpen(false);
        showToast(`${successCount} tawaran melalui ${methodString} diproses. ${invalidCount > 0 ? `(${invalidCount} nombor tidak sah)` : ''}`, successCount > 0 && invalidCount === 0 ? 'success' : 'error');
        // Offer user to view audit trail directly
        setToast({
          message: `${freelancerIds.length} tawaran telah diproses melalui ${methodString}.`,
          type: 'success'
        });
        // Navigate to settings/audit when user clicks action on toast
        const navigateToAudit = () => {
        //   setDashboardView('settings');
        //   setSettingsView('audit');
          navigate('/settings');
          setSettingsView('audit');
        };
        // Override toast with action
        setToast({
          message: `${freelancerIds.length} tawaran telah diproses melalui ${methodString}.`,
          type: 'success'
        });
      } catch (error) {
        console.error('Error sending offers:', error);
        showToast('Gagal menghantar tawaran. Sila cuba lagi.', 'error');
      }
    };
    
  const handleUploadReportClick = (task: Task) => {
    setSelectedTask(task);
    setDetailsModalOpen(false);
    setUploadModalOpen(true);
  };

  const handleUploadReport = async (taskId: number, notes: string) => {
    try {
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;
        
        await updateTask(taskId, { 
            ...task, 
            status: TaskStatus.SELESAI, 
            report: { notes, fileUrl: '#', submittedAt: new Date().toLocaleDateString() } 
        });
        await refreshData();
        showToast('Laporan berjaya dimuat naik!', 'success');
        setUploadModalOpen(false);
    } catch (error) {
        console.error('Error uploading report:', error);
        showToast('Gagal memuat naik laporan. Sila cuba lagi.', 'error');
    }
  };

  const handleAcceptAssignedTask = async (task: Task) => {
    try {
      const result = await updateTask(task.id, { status: TaskStatus.TELAH_DIAMBIL });
      if (!result?.success) {
        showToast(result?.error || 'Gagal menerima tawaran tugasan. Sila cuba lagi.', 'error');
        return;
      }

      await refreshData();
      showToast('Tawaran tugasan berjaya diterima.', 'success');
    } catch (error: any) {
      console.error('Error accepting assigned task:', error);
      showToast(error?.message || 'Gagal menerima tawaran tugasan. Sila cuba lagi.', 'error');
    }
  };

  const handleRejectAssignedTask = async (task: Task) => {
    try {
      const result = await updateTask(task.id, {
        status: TaskStatus.BARU,
        remarks: `Tawaran ditolak oleh freelancer ${currentUser?.name || ''}`.trim(),
      });

      if (!result?.success) {
        showToast(result?.error || 'Gagal menolak tawaran tugasan. Sila cuba lagi.', 'error');
        return;
      }

      await refreshData();
      showToast('Tawaran tugasan telah ditolak dan dipulangkan ke senarai agihan.', 'success');
    } catch (error: any) {
      console.error('Error rejecting assigned task:', error);
      showToast(error?.message || 'Gagal menolak tawaran tugasan. Sila cuba lagi.', 'error');
    }
  };

  const handleVerifyReport = async (taskId: number) => {
    try {
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;
        
        await updateTask(taskId, { ...task, status: TaskStatus.BORANG_DISEMAK });
        await refreshData();
        showToast('Laporan telah disahkan. Menunggu kelulusan bayaran.', 'success');
        setDetailsModalOpen(false);
    } catch (error) {
        console.error('Error verifying report:', error);
        showToast('Gagal mengesahkan laporan. Sila cuba lagi.', 'error');
    }
  };

  const handleMarkAsPaid = async (taskId: number) => {
    try {
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;
        
        await updateTask(taskId, { ...task, status: TaskStatus.TELAH_DIBAYAR, paymentDate: new Date().toISOString().split('T')[0] });
        await refreshData();
        showToast('Tugasan telah ditandakan sebagai telah dibayar.', 'success');
        setDetailsModalOpen(false);
    } catch (error) {
        console.error('Error marking as paid:', error);
        showToast('Gagal menandakan sebagai dibayar. Sila cuba lagi.', 'error');
    }
  };

  const handleCompleteTask = async (taskId: number) => {
      try {
          const task = tasks.find(t => t.id === taskId);
          if (!task) return;
          
          await updateTask(taskId, { ...task, status: TaskStatus.SELESAI_PENUH });
          await refreshData();
          showToast('Urusan tugasan telah selesai sepenuhnya.', 'success');
          setDetailsModalOpen(false);
      } catch (error) {
          console.error('Error completing task:', error);
          showToast('Gagal menyelesaikan tugasan. Sila cuba lagi.', 'error');
    }
  };

  const handleManualArrivalMarked = async (updatedTask: Task) => {
    setSelectedTask(updatedTask);
    await refreshData();
    showToast('Kehadiran berjaya ditandakan. Reminder kehadiran dihentikan.', 'success');
  };

  const handleDeleteTask = async (taskId: number) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;

      const result = await deleteTask(taskId);
      console.log('deleteTask result:', JSON.stringify(result));
      if (!result?.success) {
        console.error('Delete failed:', result?.error);
        showToast('DELETE ERROR: ' + (result?.error || 'Gagal memadam tugasan'), 'error');
        return;
      }
      await refreshData();
      showToast("Tugasan \"" + task.title + "\" telah berjaya dipadam.", 'success');
    } catch (error) {
      console.error('Error deleting task:', error);
      showToast('Gagal memadam tugasan. Sila cuba lagi.', 'error');
    }
  };

  const handleViewFreelancerProfile = (freelancer: Freelancer) => {
    setSelectedFreelancer(freelancer);
    // setDashboardView('freelancer-profile');
    navigate('/freelancer-profile');
  };

  const handleRateFreelancerClick = (task: Task) => {
    setSelectedTask(task);
    setDetailsModalOpen(false);
    setRateModalOpen(true);
  };
  
  const handleSaveRating = async (taskId: number, ratingData: DetailedRating) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;
      
      // Call feedback API — backend saves to task_feedback & updates user_profiles.rating
      const response = await tasksApi.submitFeedback(taskId, {
        skill_rating: ratingData.skill,
        communication_rating: ratingData.communication,
        time_punctuality_rating: ratingData.timePunctuality,
        response_time_rating: ratingData.responseTime,
        comment: ratingData.comment,
      });

      if (!response.success) {
        throw new Error(response.error || 'Gagal menyimpan penilaian');
      }
      
      await refreshData();
      showToast('Penilaian berjaya disimpan.', 'success');
      setRateModalOpen(false);
    } catch (error) {
      console.error('Error saving rating:', error);
      console.log('DETAIL_RATING_ERROR:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
      showToast('Gagal menyimpan penilaian: ' + (error?.message || error?.error || 'unknown'), 'error');
    }
  };

    // --- CRUD & USER MANAGEMENT HANDLERS ---
    const handleViewUserDetails = (user: User | Freelancer) => {
        setSelectedUserForDetails(user);
        setUserDetailsModalOpen(true);
    };
    
    const handleAddUser = async (newUserData: Omit<User, 'id' | 'status' | 'activityLog'>) => {
        try {
        const createPayload = {
          name: newUserData.name,
          email: newUserData.email,
          password: 'defaultPassword123',
          role_id: Number(newUserData.roleId),
          status: UserStatus.ACTIVE
        } as any;

        const createResult = await createUser(createPayload);
        if (!createResult?.success) {
          throw new Error(createResult?.error || 'Gagal mencipta pengguna');
        }

            await refreshData();
            showToast('Pengguna baru berjaya dicipta!', 'success');
            setAddUserModalOpen(false);
      } catch (error: any) {
            console.error('Error creating user:', error);
        const errorMessage = error?.response?.data?.message || error?.message || 'Gagal mencipta pengguna. Sila cuba lagi.';
        showToast(errorMessage, 'error');
        }
    };

    const handleOpenEditUserModal = (user: User | Freelancer) => {
        setUserToEdit(user);
        setEditUserModalOpen(true);
    };

    const handleUpdateUser = async (updatedUser: (User | Freelancer) & { password?: string }) => {
        try {
            const payload: Partial<User & Freelancer> = {
              name: updatedUser.name,
              email: updatedUser.email
            };

            if (updatedUser.password && updatedUser.password.trim()) {
              (payload as any).password = updatedUser.password.trim();
            }

            if (updatedUser.roleId !== undefined) {
              payload.roleId = Number(updatedUser.roleId);
            }

        const result = await updateUser(updatedUser.id, payload as User);

        if (!result?.success) {
          throw new Error(result?.error || 'Gagal mengemaskini pengguna');
            }

            await refreshData();
            showToast('Butiran pengguna berjaya dikemaskini!', 'success');
            setEditUserModalOpen(false);
            setUserToEdit(null);
          } catch (error: any) {
            console.error('Error updating user:', error);
            const errorMessage = error?.response?.data?.message || error?.message || 'Gagal mengemaskini pengguna. Sila cuba lagi.';
            showToast(errorMessage, 'error');
        }
    };

    const handleDeleteUser = async (userId: number) => {
        if (window.confirm('Adakah anda pasti mahu memadam pengguna ini? Tindakan ini tidak boleh diundur.')) {
            try {
                const userToDelete = allUsers.find(u => u.id === userId);
                if (!userToDelete) return;
                
                const roleName = roles.find(r => r.id === userToDelete.roleId)?.name;
                if (roleName === UserRole.FREELANCER) {
                    await deleteFreelancer(userId);
                } else {
                    await deleteUser(userId);
                }
                await refreshData();
                showToast(`Pengguna ${userToDelete.name} telah berjaya dipadam.`, 'success');
            } catch (error) {
                console.error('Error deleting user:', error);
                showToast('Gagal memadam pengguna. Sila cuba lagi.', 'error');
            }
        }
    };
    
    const handleUpdateUserStatus = async (userId: number, status: UserStatus) => {
        try {
            const userToUpdate = allUsers.find(u => u.id === userId);
            if (!userToUpdate) return;

            const oldStatus = userToUpdate.status;

            // All users (including freelancers) are updated via the users endpoint
            const response = await usersApi.updateStatus(userId, status);
            if (!response.success) {
                throw new Error(response.error || 'Failed to update user status');
            }
            
            await refreshData();
            logActivity(userId, 'Status Dikemas kini', `${oldStatus} -> ${status}`);
            showToast(`Status pengguna ${userToUpdate.name} telah dikemaskini kepada ${status}.`, 'success');
        } catch (error) {
            console.error('Error updating user status:', error);
            showToast('Gagal mengemaskini status pengguna. Sila cuba lagi.', 'error');
        }
    };
    
    const handleOpenBanModal = (user: User | Freelancer) => {
        setUserToBan(user);
        setBanUserModalOpen(true);
    };

    const handleConfirmBanUser = async (userId: number, reason: string) => {
        try {
            const userToUpdate = allUsers.find(u => u.id === userId);
            if (!userToUpdate) return;

            const oldStatus = userToUpdate.status;
            const roleName = roles.find(r => r.id === userToUpdate.roleId)?.name;

            if (roleName === UserRole.FREELANCER) {
                await updateFreelancer(userId, { ...userToUpdate as Freelancer, status: UserStatus.BANNED, banReason: reason });
            } else {
                await updateUser(userId, { ...userToUpdate as User, status: UserStatus.BANNED, banReason: reason });
            }
            
            await refreshData();
            logActivity(userId, 'Status Dikemas kini', `${oldStatus} -> ${UserStatus.BANNED}`);
            showToast(`Pengguna ${userToUpdate.name} telah disekat.`, 'success');
            setBanUserModalOpen(false);
            setUserToBan(null);
        } catch (error) {
            console.error('Error banning user:', error);
            showToast('Gagal menyekat pengguna. Sila cuba lagi.', 'error');
        }
    };
    
    const handleResetUserPassword = async (userId: number) => {
        try {
            const user = allUsers.find(u => u.id === userId);
            if(user) {
                // In a real app, this would call an API to send a password reset email
                logActivity(userId, 'Set Semula Kata Laluan Dicetuskan');
                showToast(`Pautan set semula kata laluan telah dihantar (simulasi) kepada ${user.name}.`, 'success');
            }
        } catch (error) {
            console.error('Error resetting password:', error);
            showToast('Gagal menghantar pautan set semula kata laluan. Sila cuba lagi.', 'error');
        }
    };

    // Settings Handlers
    const handleUpdateProfile = async (updatedUser: User | Freelancer) => {
        try {
            const roleName = roles.find(r => r.id === updatedUser.roleId)?.name;
            if (roleName === UserRole.FREELANCER) {
                await updateFreelancer(updatedUser.id, updatedUser as Freelancer);
            } else {
                await updateUser(updatedUser.id, updatedUser as User);
            }
            if (currentUser && currentUser.id === updatedUser.id) {
                // setCurrentUser(updatedUser); // Update handled by context/API
            }
            await refreshData();
            logActivity(updatedUser.id, 'Profil Dikemas kini');
            showToast('Profil berjaya dikemaskini!', 'success');
        } catch (error) {
            console.error('Error updating profile:', error);
            showToast('Gagal mengemaskini profil. Sila cuba lagi.', 'error');
        }
    };
    
    const handleSaveSmtpSettings = async (settings: SmtpSettings) => {
        try {
            setSmtpSettings(settings);
            await saveSettingToDatabase('spfit_smtp_settings', settings);
            showToast('Tetapan mel berjaya disimpan!', 'success');
        } catch (error) {
            console.error('Error saving SMTP settings:', error);
            showToast('Gagal menyimpan tetapan SMTP. Sila cuba lagi.', 'error');
        }
    };

    const handleAddWebhook = async (webhook: Omit<Webhook, 'id'>) => {
        try {
            const newWebhook = { ...webhook, id: Date.now() };
            const updatedWebhooks = [...webhooks, newWebhook];
            setWebhooks(updatedWebhooks);
            await saveSettingToDatabase('spfit_webhooks', updatedWebhooks);
            showToast('Webhook berjaya disimpan!', 'success');
        } catch (error) {
            console.error('Error saving webhook:', error);
            showToast('Gagal menyimpan webhook. Sila cuba lagi.', 'error');
        }
    };

    const handleDeleteWebhook = async (webhookId: number) => {
        try {
            const updatedWebhooks = webhooks.filter(w => w.id !== webhookId);
            setWebhooks(updatedWebhooks);
            await saveSettingToDatabase('spfit_webhooks', updatedWebhooks);
            showToast('Webhook berjaya dipadam!', 'success');
        } catch (error) {
            console.error('Error deleting webhook:', error);
            showToast('Gagal memadam webhook. Sila cuba lagi.', 'error');
        }
    };

    const handleOpenTemplateModal = (template: NotificationTemplate | null) => {
        setTemplateToEdit(template);
        setTemplateEditorModalOpen(true);
    };

    const handleCloseTemplateModal = () => {
        setTemplateEditorModalOpen(false);
        setTemplateToEdit(null);
    };

    const handleSaveTemplate = async (templateData: NotificationTemplate | Omit<NotificationTemplate, 'id' | 'isDefault'>[]) => {
        try {
            let updatedTemplates;
            if (!Array.isArray(templateData)) {
                updatedTemplates = notificationTemplates.map(t => t.id === templateData.id ? templateData : t);
                setNotificationTemplates(prev => prev.map(t => t.id === templateData.id ? templateData : t));
                showToast('Templat berjaya dikemaskini!', 'success');
            } else {
                const templatesToCreate = templateData;
                const newTemplates: NotificationTemplate[] = templatesToCreate.map((template, index) => {
                    const existingDefaults = notificationTemplates.filter(t => t.type === template.type && t.channel === template.channel && t.isDefault);
                    return {
                  ...template,
                  id: Date.now() + index,
                        isDefault: existingDefaults.length === 0,
                    };
                });
                updatedTemplates = [...notificationTemplates, ...newTemplates];
                setNotificationTemplates(updatedTemplates);
                showToast('Templat baru berjaya dicipta!', 'success');
            }
            await saveSettingToDatabase('spfit_notification_templates', updatedTemplates);
            handleCloseTemplateModal();
        } catch (error) {
            console.error('Error saving template:', error);
            showToast('Gagal menyimpan templat. Sila cuba lagi.', 'error');
        }
    };


    const handleDeleteTemplate = async (templateId: number) => {
        try {
            const updatedTemplates = notificationTemplates.filter(t => t.id !== templateId);
            setNotificationTemplates(updatedTemplates);
            await saveSettingToDatabase('spfit_notification_templates', updatedTemplates);
            showToast('Templat berjaya dipadam!', 'success');
        } catch (error) {
            console.error('Error deleting template:', error);
            showToast('Gagal memadam templat. Sila cuba lagi.', 'error');
        }
    };
    
    const handleSetDefaultTemplate = async (templateId: number) => {
        const template = notificationTemplates.find(t => t.id === templateId);
        if (!template) return;

        const updatedTemplates = notificationTemplates.map(t => {
            if (t.type === template.type && t.channel === template.channel) {
                return { ...t, isDefault: t.id === templateId };
            }
            return t;
        });

        setNotificationTemplates(updatedTemplates);
        await saveSettingToDatabase('spfit_notification_templates', updatedTemplates);
    };
    
    // Role Management Handlers
    const handleOpenRoleEditor = (role: Role | null) => {
        setRoleToEdit(role);
        setRoleEditorModalOpen(true);
    };

    const handleSaveRole = async (roleData: Role) => {
        try {
            if (roleData.id && roleData.id > 0) { // Update existing
                const response = await rolesApi.update(roleData.id!, {
                    name: roleData.name,
                    description: roleData.description,
                    permissions: roleData.permissions,
                    roleTypeId: roleData.roleTypeId
                });
                
                if (response.success && response.data) {
                  const updatedRole = response.data as Role;
                  setRoles(roles.map(r => r.id === roleData.id ? updatedRole : r));
                    showToast(`Peranan '${roleData.name}' berjaya dikemaskini.`, 'success');
                } else {
                    showToast(response.error || 'Gagal mengemaskini peranan.', 'error');
                    return;
                }
            } else { // Create new
                const response = await rolesApi.create({
                    name: roleData.name,
                    description: roleData.description,
                    permissions: roleData.permissions,
                    roleTypeId: roleData.roleTypeId
                });
                
                if (response.success && response.data) {
                  setRoles([...roles, response.data as Role]);
                    showToast(`Peranan '${roleData.name}' berjaya dicipta.`, 'success');
                } else {
                    showToast(response.error || 'Gagal mencipta peranan.', 'error');
                    return;
                }
            }
            setRoleEditorModalOpen(false);
        } catch (error) {
            console.error('Error saving role:', error);
            showToast('Ralat berlaku semasa menyimpan peranan.', 'error');
        }
    };

    const handleDeleteRole = async (roleId: number) => {
        const role = roles.find(r => r.id === roleId);
        const PROTECTED_ROLES = ['Freelancer', 'Staff', 'Admin'];
        
        if (!role || role.isSystemRole || PROTECTED_ROLES.includes(role.name)) return;
        
        if (allUsers.some(u => u.roleId === roleId)) {
            alert(`Tidak boleh memadam peranan '${role.name}' kerana ia sedang digunakan oleh pengguna.`);
            return;
        }

        if (window.confirm(`Adakah anda pasti mahu memadam peranan '${role.name}'?`)) {
            try {
                const response = await rolesApi.delete(roleId);
                
                if (response.success) {
                    setRoles(roles.filter(r => r.id !== roleId));
                    showToast(`Peranan '${role.name}' telah dipadam.`, 'success');
                } else {
                    showToast(response.error || 'Gagal memadam peranan.', 'error');
                }
            } catch (error) {
                console.error('Error deleting role:', error);
                showToast('Ralat berlaku semasa memadam peranan.', 'error');
            }
        }
    };
    
    const handleSetDefaultFreelancerRole = async (roleId: number) => {
        try {
            setDefaultFreelancerRoleId(roleId);
            await saveSettingToDatabase('spfit_default_freelancer_role_id', roleId);
            showToast('Peranan default untuk freelancer baru telah ditetapkan.', 'success');
        } catch (error) {
            console.error('Error saving default role:', error);
            showToast('Gagal menyimpan peranan default.', 'error');
        }
    };
    
    // Mapping function for Sidebar navigation
    const handleNavigate = (view: DashboardView) => {
      // Map view to URL
      switch (view) {
        case 'dashboard':
          navigate('/'); // Will hit RoleBasedRedirect
          break;
        case 'tasks':
          navigate('/tasks');
          break;
        case 'ai-instruction':
          navigate('/ai-instruction');
          break;
        case 'projects':
          navigate('/projects');
          break;
        case 'masterlists':
          navigate('/masterlists');
          break;
        case 'assets':
          navigate('/assets');
          break;
        case 'freelancers':
          navigate('/freelancers');
          break;
        case 'main-cons':
          navigate('/main-cons');
          break;
        case 'payment-approvals':
          navigate('/payment-approvals');
          break;
        case 'notifications':
          navigate('/notifications');
          break;
        case 'reports':
          navigate('/reports');
          break;
        case 'my-tasks':
          navigate('/my-tasks');
          break;
        case 'completed-tasks':
          navigate('/tasks/completed');
          break;
        case 'settings':
          navigate('/settings');
          break;
        case 'freelancer-profile':
          navigate('/freelancer-profile'); 
          break;
        default:
          navigate('/');
      }
    };


  // Show loading screen while initializing
  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Memuat aplikasi...</p>
        </div>
      </div>
    );
  }
  
  return (
    <>
      <Routes>
          <Route path="/arrival-confirm" element={<ArrivalConfirmationPage />} />
          <Route path="/doc" element={<UserManualPage />} />
          <Route path="/login" element={!currentUser ? <LoginScreen onLogin={handleLogin} onNavigateToRegister={() => navigate('/register')} error={loginError} /> : <Navigate to="/" />} />
          <Route path="/register" element={<Register onRegister={handleRegister} onNavigateToLogin={() => navigate('/login')} />} />
          
          <Route path="/" element={
            currentUser ? (
              <Layout 
                currentUser={currentUser} 
                onLogout={handleLogout}
                onNavigate={handleNavigate}
                activeView={dashboardView}
                hasPermission={hasPermission}
                roles={roles}
              >
                 <Outlet />
              </Layout>
            ) : (
                <Navigate to="/login" />
            )
          }>
             <Route index element={<RoleBasedRedirect roles={roles} user={currentUser} />} />
             
             {/* Dashboards */}
             <Route path="dashboard/pentadbiran" element={
                <AdminDashboard 
                  currentUser={currentUser!} 
                  tasks={tasks}
                  users={allUsers}
                  freelancers={freelancers}
                  onViewTask={handleViewTask}
                  onViewUser={handleViewUserDetails}
                  onViewFreelancer={handleViewFreelancerProfile}
                />
             } />
             <Route path="dashboard/pengurusan" element={<ManagementDashboard tasks={tasks} onViewTask={handleViewTask} allUsers={allUsers} />} />
             <Route path="dashboard/operasi" element={<OperationsDashboard tasks={tasks} onViewTask={handleViewTask} />} />
             <Route
               path="dashboard/freelancer"
               element={
                 <FreelancerDashboard
                   tasks={tasks}
                   currentUser={(selfFreelancerProfile || currentUser) as Freelancer}
                   onViewTask={handleViewTask}
                   onAcceptTask={handleAcceptAssignedTask}
                   onRejectTask={handleRejectAssignedTask}
                 />
               }
             />

             {/* Pages */}
             <Route path="tasks" element={
                <ProtectedRoute canAccess={hasAnyPermission(['tasks:view:all', 'tasks:view:own', 'tasks:view:assigned', 'tasks:create', 'tasks:edit:all'])}>
                  <TaskManagementPage 
                    tasks={tasks} 
                    onViewTask={handleViewTask} 
                    onCreateTask={() => navigate('/tasks/create')} 
                    onDeleteTask={handleDeleteTask} 
                    canCreate={hasPermission('tasks:create') && isAdminOrStaffTaskEditor} 
                    canDelete={hasPermission('tasks:delete')}
                    onOpenAudit={(task) => {
                      setAuditInitialSearch(`TX-${task.id}-`);
                      setAuditInitialTable('whatsapp_messages');
                      navigate('/settings');
                      setSettingsView('audit');
                    }}
                  />
                </ProtectedRoute>
             } />

               <Route path="ai-instruction" element={
                 <ProtectedRoute canAccess={hasAnyPermission(['tasks:create', 'ai:task:view', 'ai:masterlist:view'])}>
                  <AIInstructionPage
                    canUseAITask={hasAnyPermission(['tasks:create', 'ai:task:view'])}
                    canUseAIMasterlist={hasAnyPermission(['tasks:create', 'ai:masterlist:view'])}
                  />
                 </ProtectedRoute>
               } />

               <Route path="projects" element={
                 <ProtectedRoute canAccess={hasAnyPermission(['projects:view:all', 'projects:view:own'])}>
                  <ProjectsPage />
                 </ProtectedRoute>
               } />

               <Route path="projects/create" element={
                 <ProtectedRoute canAccess={hasPermission('tasks:create')}>
                  <ProjectFormPage />
                 </ProtectedRoute>
               } />

               <Route path="projects/:id" element={
                 <ProtectedRoute canAccess={hasAnyPermission(['projects:view:all', 'projects:view:own'])}>
                  <ProjectViewPage />
                 </ProtectedRoute>
               } />

               <Route path="projects/:id/edit" element={
                 <ProtectedRoute canAccess={hasPermission('tasks:edit:all')}>
                  <ProjectFormPage />
                 </ProtectedRoute>
               } />

               <Route path="masterlists" element={
                 <ProtectedRoute canAccess={hasAnyPermission(['masterlists:view:all', 'masterlists:view:own', 'tasks:view:all', 'tasks:view:own', 'tasks:view:assigned', 'tasks:create', 'tasks:edit:all'])}>
                  <MasterlistsPage />
                 </ProtectedRoute>
               } />

               <Route path="masterlists/create" element={
                 <ProtectedRoute canAccess={hasPermission('tasks:create')}>
                  <MasterlistFormPage showToast={showToast} hasPermission={hasPermission} />
                 </ProtectedRoute>
               } />

               <Route path="masterlists/:id" element={
                 <ProtectedRoute canAccess={hasAnyPermission(['masterlists:view:all', 'masterlists:view:own', 'tasks:view:all', 'tasks:view:own', 'tasks:view:assigned', 'tasks:create', 'tasks:edit:all'])}>
                  <MasterlistViewPage showToast={showToast} hasPermission={hasPermission} />
                 </ProtectedRoute>
               } />

               <Route path="masterlists/:id/edit" element={
                 <ProtectedRoute canAccess={hasPermission('tasks:edit:all')}>
                  <MasterlistFormPage showToast={showToast} hasPermission={hasPermission} />
                 </ProtectedRoute>
               } />

               <Route path="assets" element={
                 <ProtectedRoute canAccess={hasAnyPermission(['assets:view:all', 'assets:view:own', 'tasks:view:all', 'tasks:view:own', 'tasks:view:assigned', 'tasks:create', 'tasks:edit:all'])}>
                  <AssetsPage />
                 </ProtectedRoute>
               } />

               <Route path="assets/create" element={
                 <ProtectedRoute canAccess={hasPermission('tasks:create')}>
                  <AssetFormPage />
                 </ProtectedRoute>
               } />

               <Route path="assets/:id" element={
                 <ProtectedRoute canAccess={hasAnyPermission(['assets:view:all', 'assets:view:own', 'tasks:view:all', 'tasks:view:own', 'tasks:view:assigned', 'tasks:create', 'tasks:edit:all'])}>
                  <AssetViewPage />
                 </ProtectedRoute>
               } />

               <Route path="assets/:id/edit" element={
                 <ProtectedRoute canAccess={hasPermission('tasks:edit:all')}>
                  <AssetFormPage />
                 </ProtectedRoute>
               } />
             
             <Route path="tasks/create" element={
                <ProtectedRoute canAccess={hasPermission('tasks:create') && isAdminOrStaffTaskEditor}>
                  <TaskFormPage
                    freelancers={freelancers}
                    webhooks={webhooks}
                    notificationTemplates={notificationTemplates}
                    onSendOffers={handleSendOffers}
                    canSubmitTaskForm={canSubmitTaskFormByRole}
                  />
                </ProtectedRoute>
             } />
             <Route path="tasks/:id" element={
                <ProtectedRoute canAccess={hasAnyPermission(['tasks:view:all', 'tasks:view:own', 'tasks:view:assigned', 'tasks:edit:all', 'tasks:submit_report'])}>
                  <TaskViewPageWrapper tasks={tasks} onViewTask={handleViewTask} />
                </ProtectedRoute>
             } />
             <Route path="tasks/:id/view" element={
               <ProtectedRoute canAccess={hasAnyPermission(['tasks:view:all', 'tasks:view:own', 'tasks:view:assigned'])}>
                  <TaskViewPage />
                </ProtectedRoute>
             } />

             <Route path="my-tasks" element={
                <ProtectedRoute canAccess={hasPermission('tasks:view:assigned')}>
                  <MyTasksPage tasks={tasks} currentUser={currentUser as Freelancer} onViewTask={handleViewTask} />
                </ProtectedRoute>
             } />
             
             <Route path="tasks/completed" element={
                <ProtectedRoute canAccess={hasAnyPermission(['tasks:view:all', 'tasks:view:own', 'tasks:view:assigned'])}>
                  <CompletedTasksPage
                    onViewTask={(taskId) => navigate(`/tasks/${taskId}`)}
                  />
                </ProtectedRoute>
             } />

             <Route path="tasks/completed/:id" element={
               <ProtectedRoute canAccess={hasAnyPermission(['tasks:view:all', 'tasks:view:own', 'tasks:view:assigned']) && hasPermission('tasks:manage_completed_form')}>
                  <CompletedTaskDetailPage
                    canEditCompletedTaskForm={hasAnyPermission(['tasks:edit:all', 'payments:approve'])}
                    canReviewCompletedTaskForm={hasAnyPermission(['tasks:edit:all', 'payments:approve'])}
                  />
                </ProtectedRoute>
             } />
             
             <Route path="freelancers" element={
               <ProtectedRoute canAccess={hasAnyPermission(['freelancers:view:all', 'freelancers:view:own', 'freelancers:manage', 'settings:manage:profile', 'tasks:view:assigned'])}>
                  {hasAnyPermission(['freelancers:view:all', 'freelancers:manage']) ? (
                    <FreelancerManagementPage 
                        freelancers={freelancers} 
                        onAddFreelancer={() => setAddFreelancerModalOpen(true)} 
                        onViewProfile={handleViewFreelancerProfile} 
                        canManage={hasPermission('freelancers:manage')} 
                    />
                  ) : selfFreelancerProfile ? (
                    <FreelancerProfilePage 
                      freelancer={selfFreelancerProfile}
                      tasks={tasks}
                      onBack={() => navigate('/dashboard/freelancer')}
                      onViewTask={(task) => navigate(`/tasks/${task.id}`)}
                      onFreelancerUpdate={(updatedFreelancer) => {
                        setSelfFreelancerProfileFromApi(updatedFreelancer);
                        setSelectedFreelancer(updatedFreelancer);
                        refreshData();
                      }}
                    />
                  ) : selfFreelancerProfileLoading ? (
                    <div className="p-6 text-sm text-gray-600">Memuatkan profil freelancer...</div>
                  ) : (
                    <Navigate to="/dashboard/freelancer" />
                  )}
                </ProtectedRoute>
             } />

             <Route path="main-cons" element={
               <ProtectedRoute canAccess={hasAnyPermission(['maincons:view:all', 'maincons:view:own', 'settings:manage:api', 'tasks:view:all', 'tasks:view:own', 'tasks:view:assigned', 'tasks:create', 'tasks:edit:all'])}>
                  <div className="p-6">
                      <MainConsManagement />
                  </div>
                </ProtectedRoute>
             } />
             
             <Route path="payment-approvals" element={
                <ProtectedRoute canAccess={hasAnyPermission(['payments:view:all', 'payments:view:own', 'payments:approve', 'payments:mark_paid'])}>
                  <PaymentApprovalsPage
                    canApprove={hasPermission('payments:approve')}
                    canMarkPaid={hasPermission('payments:mark_paid')}
                  />
                </ProtectedRoute>
             } />

             <Route path="payment-approvals/:id" element={
                <ProtectedRoute canAccess={hasAnyPermission(['payments:view:all', 'payments:view:own', 'payments:approve', 'payments:mark_paid'])}>
                  <PaymentDetailPage
                    canApprove={hasPermission('payments:approve')}
                    canMarkPaid={hasPermission('payments:mark_paid')}
                  />
                </ProtectedRoute>
             } />
             <Route path="notifications" element={
               <ProtectedRoute canAccess={hasAnyPermission(['notifications:view:all', 'notifications:view:own', 'notifications:view'])}>
                  <NotificationsPage />
                </ProtectedRoute>
             } />
             <Route path="reports" element={
               <ProtectedRoute canAccess={hasAnyPermission(['reports:view:all', 'reports:view:own'])}>
                  <ReportsPage tasks={tasks} freelancers={freelancers} />
                </ProtectedRoute>
             } />
             
             <Route path="settings" element={
                <ProtectedRoute canAccess={canAccessSettings}>
                  <SettingsPage
                      currentUser={currentUser!}
                      currentView={settingsView}
                      onNavigate={setSettingsView}
                      onUpdateProfile={handleUpdateProfile}
                      smtpSettings={smtpSettings}
                      onSaveSmtpSettings={handleSaveSmtpSettings}
                      webhooks={webhooks}
                      onAddWebhook={handleAddWebhook}
                      onDeleteWebhook={handleDeleteWebhook}
                      notificationTemplates={notificationTemplates}
                      onOpenTemplateModal={handleOpenTemplateModal}
                      onDeleteTemplate={handleDeleteTemplate}
                      onSetDefaultTemplate={handleSetDefaultTemplate}
                      allUsers={allUsers}
                      roles={roles}
                      onUpdateUserStatus={handleUpdateUserStatus}
                      onResetUserPassword={handleResetUserPassword}
                      onViewUserDetails={handleViewUserDetails}
                      onAddUser={() => setAddUserModalOpen(true)}
                      onEditUser={handleOpenEditUserModal}
                      onDeleteUser={handleDeleteUser}
                      onBanUser={handleOpenBanModal}
                      onOpenRoleEditor={handleOpenRoleEditor}
                      onDeleteRole={handleDeleteRole}
                      defaultFreelancerRoleId={defaultFreelancerRoleId}
                      onSetDefaultFreelancerRole={handleSetDefaultFreelancerRole}
                      hasPermission={hasPermission}
                      initialAuditSearch={auditInitialSearch}
                      initialAuditTable={auditInitialTable}
                  />
                </ProtectedRoute>
             } />
             
             <Route path="freelancer-profile" element={
                (selectedFreelancer || selfFreelancerProfile) ? (
                    <FreelancerProfilePage 
                      freelancer={(selectedFreelancer || selfFreelancerProfile)!} 
                      tasks={tasks} 
                      onBack={() => navigate(selectedFreelancer ? '/freelancers' : '/dashboard/freelancer')}
                      onViewTask={(task) => navigate(`/tasks/${task.id}`)}
                      onFreelancerUpdate={(updatedFreelancer) => {
                        setSelectedFreelancer(updatedFreelancer);
                        // Refresh data to keep list in sync
                        refreshData();
                      }}
                    />
                ) : (
                    <Navigate to="/dashboard/freelancer" />
                )
             } />

          </Route>
      </Routes>

      {/* Modals */}
      {hasPermission('tasks:create') && 
        <CreateTaskModal 
          isOpen={isCreateModalOpen} 
          onClose={() => setCreateModalOpen(false)} 
          onSave={handleCreateTask}
          currentUser={currentUser} 
        />
      }

      {hasPermission('freelancers:manage') &&
        <AddFreelancerModal
            isOpen={isAddFreelancerModalOpen}
            onClose={() => setAddFreelancerModalOpen(false)}
            onSave={handleAddFreelancer}
        />
      }
      
      <AddUserModal
        isOpen={isAddUserModalOpen}
        onClose={() => setAddUserModalOpen(false)}
        onSave={handleAddUser}
        roles={roles}
      />
      
      <EditUserModal
        isOpen={isEditUserModalOpen}
        onClose={() => setEditUserModalOpen(false)}
        user={userToEdit}
        onSave={handleUpdateUser}
        roles={roles}
      />

      <BanUserModal
        isOpen={isBanUserModalOpen}
        onClose={() => setBanUserModalOpen(false)}
        user={userToBan}
        onConfirm={handleConfirmBanUser}
      />


      <TaskDetailsModal 
        isOpen={isDetailsModalOpen}
        onClose={() => setDetailsModalOpen(false)}
        task={selectedTask}
        currentUser={currentUser}
        allUsers={allUsers}
        onAssignClick={handleAssignClick}
        onEditClick={handleEditTaskClick}
        onUploadReportClick={handleUploadReportClick}
        onVerifyReport={handleVerifyReport}
        onMarkAsPaid={handleMarkAsPaid}
        onRateFreelancerClick={handleRateFreelancerClick}
        onCompleteTask={handleCompleteTask}
        onManualArrivalMarked={handleManualArrivalMarked}
        hasPermission={hasPermission}
      />
      
      {selectedTask &&
        <AssignTechModal
          isOpen={isAssignModalOpen}
          onClose={() => setAssignModalOpen(false)}
          task={selectedTask}
          freelancers={freelancers}
          webhooks={webhooks}
          notificationTemplates={notificationTemplates}
          onSendOffers={handleSendOffers}
        />
      }

      {selectedTask &&
        <EditTaskModal
          isOpen={isEditTaskModalOpen}
          onClose={() => setEditTaskModalOpen(false)}
          task={selectedTask}
          onSave={handleEditTask}
        />
      }

      {selectedTask &&
        <UploadReportModal
          isOpen={isUploadModalOpen}
          onClose={() => setUploadModalOpen(false)}
          task={selectedTask}
          onUpload={handleUploadReport}
        />
      }

      {selectedTask &&
        <RateFreelancerModal
          isOpen={isRateModalOpen}
          onClose={() => setRateModalOpen(false)}
          task={selectedTask}
          onSave={handleSaveRating}
        />
      }

      <TemplateEditorModal 
          isOpen={isTemplateEditorModalOpen}
          onClose={handleCloseTemplateModal}
          onSave={handleSaveTemplate}
          templateToEdit={templateToEdit}
      />
      
      <RoleEditorModal
        isOpen={isRoleEditorModalOpen}
        onClose={() => setRoleEditorModalOpen(false)}
        onSave={handleSaveRole}
        roleToEdit={roleToEdit}
      />
      
      <UserDetailsModal
        isOpen={isUserDetailsModalOpen}
        onClose={() => setUserDetailsModalOpen(false)}
        user={selectedUserForDetails}
        roles={roles}
      />

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
          actionLabel="Lihat Audit"
          onAction={() => {
            navigate('/settings');
            setSettingsView('audit');
          }}
        />
      )}
    </>
  );
};

export default App;

// Global error handlers for uncaught errors
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
  });

  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
  });
}