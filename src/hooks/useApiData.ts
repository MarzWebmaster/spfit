import { useState, useEffect, useCallback } from 'react';
import { User, Task, Freelancer, Notification } from '../types';
import { usersApi, tasksApi, freelancersApi, notificationsApi, systemApi, mainConsApi } from '../services/api';
import { authService } from '../services/authService';

// Gunakan API nyata untuk semua operasi

interface ApiDataState {
  tasks: Task[];
  users: User[];
  freelancers: Freelancer[];
  notifications: Notification[];
  mainCons: any[];
  loading: boolean;
  error: string | null;
}

interface DashboardStats {
  totalTasks: number;
  totalUsers: number;
  totalFreelancers: number;
  activeTasks: number;
  completedTasks: number;
  pendingTasks: number;
}

export const useApiData = () => {
  const [state, setState] = useState<ApiDataState>({
    tasks: [],
    users: [],
    freelancers: [],
    notifications: [],
    mainCons: [],
    loading: false,
    error: null
  });

  const [dashboardStats, setDashboardStats] = useState<DashboardStats>({
    totalTasks: 0,
    totalUsers: 0,
    totalFreelancers: 0,
    activeTasks: 0,
    completedTasks: 0,
    pendingTasks: 0
  });

  // Check if user is authenticated with proper JWT validation
  const isAuthenticated = useCallback(() => {
    const token = localStorage.getItem('authToken');
    const user = localStorage.getItem('spfit_current_user');
    
    if (!token || !user) {
      return false;
    }
    
    try {
      // Validate JWT token structure and expiration
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Date.now() / 1000;
      
      // Check if token is expired
      if (payload.exp && payload.exp < currentTime) {
        console.warn('Token expired, clearing authentication');
        localStorage.removeItem('authToken');
        localStorage.removeItem('spfit_current_user');
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Token validation error:', error);
      return false;
    }
  }, []);

  // Load all data from API
  const loadData = useCallback(async () => {
    // Only load data if user is authenticated
    if (!isAuthenticated()) {
      console.log('🔒 User not authenticated, skipping data load');
      setState({
        tasks: [],
        users: [],
        freelancers: [],
        notifications: [],
        mainCons: [],
        loading: false,
        error: null
      });
      return;
    }

    try {
      console.log('📊 Loading data from API...');
      setState(prev => ({ ...prev, loading: true, error: null }));

      // Build role-aware access flags from persisted auth user.
      // Production often has stricter permissions than localhost, so we avoid
      // calling admin-only endpoints for freelancer users.
      let storedUser: any = null;
      try {
        const rawUser = localStorage.getItem('spfit_current_user');
        storedUser = rawUser ? JSON.parse(rawUser) : null;
      } catch (parseError) {
        console.warn('Failed to parse current user from storage:', parseError);
      }

      const normalizedRole = String(storedUser?.role || '').toLowerCase();
      const userPermissions: string[] = Array.isArray(storedUser?.permissions)
        ? storedUser.permissions
        : [];
      const hasAnyPermission = (...permissions: string[]) =>
        permissions.some(permission => userPermissions.includes(permission));
      const isAdmin = normalizedRole === 'admin';

      const canReadUsers = isAdmin || hasAnyPermission('settings:manage:users');
      const canReadFreelancersAll = isAdmin || hasAnyPermission('freelancers:view:all', 'freelancers:manage');
      const canReadOwnFreelancer = canReadFreelancersAll || hasAnyPermission('freelancers:view:own', 'settings:manage:profile');
      const canReadNotifications = isAdmin || hasAnyPermission('notifications:view', 'notifications:view:all', 'notifications:view:own');
      const canReadSystemStats = isAdmin || hasAnyPermission('system.admin', 'reports:view:all', 'reports:view:own');
      const canReadMainCons = isAdmin || hasAnyPermission('maincons:view:all', 'maincons:view:own', 'settings:manage:api');
      
      console.log('🚀 Calling tasksApi.getAll()...');
      let tasksResponse: any = { success: false, data: [] };
      try {
        tasksResponse = await tasksApi.getAll();
        console.log('✅ tasksApi.getAll() returned:', tasksResponse);
      } catch (err) {
        console.error('❌ tasksApi.getAll() THREW ERROR:', err);
      }

      console.log('🚀 Calling other APIs...');
      const [usersResponse, freelancersResponse, notificationsResponse, statsResponse, mainConsResponse] = await Promise.allSettled([
        canReadUsers
          ? usersApi.getAll(1, 100)
          : Promise.resolve({ success: true, data: [] }),
        canReadFreelancersAll
          ? freelancersApi.getAll(1, 100)
          : (canReadOwnFreelancer && storedUser?.id
            ? freelancersApi.getById(storedUser.id)
            : Promise.resolve({ success: true, data: [] })),
        canReadNotifications
          ? notificationsApi.getAll()
          : Promise.resolve({ success: true, data: [] }),
        canReadSystemStats
          ? systemApi.getDashboardStats()
          : Promise.resolve({ success: true, data: null }),
        canReadMainCons
          ? mainConsApi.getAll()
          : Promise.resolve({ success: true, data: [] })
      ]);

      console.log('📦 Tasks API Response (After):', tasksResponse);

      // Helper to get result or default
      const getResult = (result: PromiseSettledResult<any>, defaultVal: any = { success: false, data: [] }) => 
        result.status === 'fulfilled' ? result.value : defaultVal;

      const usersRes = getResult(usersResponse);
      const freelancersRes = getResult(freelancersResponse);
      const notificationsRes = getResult(notificationsResponse);
      const statsRes = getResult(statsResponse, { success: false, data: null });
      const mainConsRes = getResult(mainConsResponse);

      // We proceed even if some fail, but we log errors
      if (usersResponse.status === 'rejected') console.error('❌ usersApi failed:', usersResponse.reason);
      if (freelancersResponse.status === 'rejected') console.error('❌ freelancersApi failed:', freelancersResponse.reason);
      if (notificationsResponse.status === 'rejected') console.error('❌ notificationsApi failed:', notificationsResponse.reason);

      // Extract tasks array - backend returns { success, data: { tasks: [...], pagination: {...} } }
      const rawTasksData = (tasksResponse.data as any)?.tasks || tasksResponse.data || [];
      
      // Map backend snake_case to frontend camelCase
      const tasksData = Array.isArray(rawTasksData) ? rawTasksData.map((task: any) => ({
          ...task,
          logNumber: task.log_number || task.logNumber,
          supportType: task.support_type || task.supportType,
          supportTypeSettingId: task.support_type_id ?? task.support_type_setting_id ?? task.supportTypeSettingId,
          clientLocation: task.client_location || task.clientLocation,
          districtAddress: task.bandar_daerah || task.district_address || task.districtAddress,
          offerPrice: task.offer_price !== undefined ? Number(task.offer_price) : (task.offerPrice || 0),
          statusSettingId: task.status_id ?? task.status_setting_id ?? task.statusSettingId,
          equipmentTypes: task.equipment_types_id ?? task.equipment_types ?? task.equipmentTypes,
          paymentDate: task.payment_date || task.paymentDate,
          createdBy: task.created_by || task.createdBy,
          assignedTo: task.assigned_to || task.assignedTo || task.assignee?.id,
          createdAt: task.created_at || task.createdAt,
          updatedAt: task.updated_at || task.updatedAt,
          deadlineTime: task.deadline_time || task.deadlineTime,
          requirementDate: task.requirement_date || task.requirementDate,
          requirementTime: task.requirement_time || task.requirementTime,
          serviceStartDate: task.service_start_date || task.serviceStartDate,
          serviceStartTime: task.service_start_time || task.serviceStartTime,
          arrivalConfirmedAt: task.arrival_confirmed_at || task.arrivalConfirmedAt,
          arrivalLatitude: task.arrival_latitude ?? task.arrivalLatitude,
          arrivalLongitude: task.arrival_longitude ?? task.arrivalLongitude,
          arrivalAccuracyMeters: task.arrival_accuracy_meters ?? task.arrivalAccuracyMeters,
          report: task.report
            ? {
                ...task.report,
                submittedAt: task.report.submittedAt || task.report.submitted_at,
                fileUrl: task.report.fileUrl || task.report.file_url,
              }
            : undefined,
      })) : [];

      const rawUsersData = (usersRes.data as any)?.data || (usersRes.data as any)?.users || usersRes.data || [];
      const usersData = Array.isArray(rawUsersData)
        ? rawUsersData.map((u: any) => ({
            ...u,
            roleId: u.roleId || u.role_id || u.role?.id,
            activityLog: u.activityLog || []
          }))
        : [];
      
      const freelancersPayload = freelancersRes.data as any;
      let rawFreelancersData = freelancersPayload?.freelancers || freelancersPayload?.data || freelancersPayload || [];
      if (!Array.isArray(rawFreelancersData)) {
        if (freelancersPayload?.freelancer) {
          rawFreelancersData = [freelancersPayload.freelancer];
        } else if (freelancersPayload?.id) {
          rawFreelancersData = [freelancersPayload];
        } else {
          rawFreelancersData = [];
        }
      }
      const freelancersData = Array.isArray(rawFreelancersData) ? rawFreelancersData.map((f: any) => ({
        ...f,
        roleId: f.role_id || f.roleId,
        isAvailable: f.profile?.is_available !== undefined
          ? (f.profile.is_available === 1 || f.profile.is_available === true || f.profile.is_available === 'true')
          : (f.is_available !== undefined ? (f.is_available === 1 || f.is_available === true || f.is_available === 'true') : (f.isAvailable ?? true)),
        icNumber: f.profile?.ic_number || f.ic_number || f.icNumber,
        banReason: f.ban_reason || f.banReason,
        email: f.email || '',
        phone: f.profile?.phone || f.phone || '',
        name: f.name || '',
        experience: Number(f.profile?.experience ?? f.experience ?? 0),
        rating: Number(f.profile?.rating ?? f.rating ?? 0),
        skills: f.skills || f.freelancerSkills?.map((s: any) => s.skill) || [],
        locations: f.locations || f.freelancerLocations?.map((l: any) => ({ district: l.district, state: l.state })) || [],
        status: f.status || 'Aktif'
      })) : [];

      const notificationsData = (notificationsRes.data as any)?.data || notificationsRes.data || [];
      const mainConsData = (mainConsRes.data as any)?.data || mainConsRes.data || [];

      console.log('📋 Extracted tasks:', tasksData);
      console.log('📋 Tasks count:', tasksData.length);
      console.log('📋 Freelancers count:', freelancersData.length);
      
      setState({
        tasks: tasksData,
        users: Array.isArray(usersData) ? usersData : [],
        freelancers: freelancersData,
        notifications: Array.isArray(notificationsData) ? notificationsData : [],
        mainCons: Array.isArray(mainConsData) ? mainConsData : [],
        loading: false,
        error: null
      });

      if (statsRes.success && statsRes.data) {
        setDashboardStats(statsRes.data);
      }
    } catch (error) {
      console.error('❌ Error loading data:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }));
    }
  }, [isAuthenticated]); // Add isAuthenticated to dependency array

  // Load data when user is authenticated - simple, clean approach
  useEffect(() => {
    loadData();
  }, []); // Empty dependency - run ONCE on mount only

  // Task operations
  const createTask = useCallback(async (taskData: any) => {
    console.log('🔧 createTask hook called with:', taskData);
    try {
      const formData = new FormData();
      formData.append('title', (taskData as any).title);
      if ((taskData as any).logNumber) formData.append('log_number', String((taskData as any).logNumber));
      formData.append('description', (taskData as any).description);
      formData.append('support_type', (taskData as any).supportType);
      if ((taskData as any).supportTypeSettingId) formData.append('support_type_id', String((taskData as any).supportTypeSettingId));
      formData.append('client_location', (taskData as any).clientLocation);
      if ((taskData as any).districtAddress) formData.append('bandar_daerah', (taskData as any).districtAddress);
      formData.append('state', (taskData as any).state);
      if ((taskData as any).requirementDate) formData.append('requirement_date', (taskData as any).requirementDate);
      if ((taskData as any).requirementTime) formData.append('requirement_time', (taskData as any).requirementTime);
      if ((taskData as any).deadline) formData.append('deadline', (taskData as any).deadline);
      if ((taskData as any).deadlineTime) formData.append('deadline_time', (taskData as any).deadlineTime);
      if ((taskData as any).serviceStartDate) formData.append('service_start_date', (taskData as any).serviceStartDate);
      if ((taskData as any).serviceStartTime) formData.append('service_start_time', (taskData as any).serviceStartTime);
      formData.append('offer_price', String((taskData as any).offerPrice));
      if ((taskData as any).statusSettingId) formData.append('status_id', String((taskData as any).statusSettingId));
      if ((taskData as any).status) formData.append('status', (taskData as any).status);
      if ((taskData as any).remarks) formData.append('remarks', (taskData as any).remarks);

      // New fields
      if ((taskData as any).mainConId) formData.append('main_con_id', String((taskData as any).mainConId));
      if ((taskData as any).picName) formData.append('pic_name', (taskData as any).picName);
      if ((taskData as any).picPhone) formData.append('pic_phone', (taskData as any).picPhone);
      if ((taskData as any).clientName) formData.append('client_name', (taskData as any).clientName);
      if ((taskData as any).assetTagId) formData.append('asset_tag_id', (taskData as any).assetTagId);
      if ((taskData as any).assetBrand) formData.append('asset_brand', (taskData as any).assetBrand);
      if ((taskData as any).assetModel) formData.append('asset_model', (taskData as any).assetModel);
      if ((taskData as any).assetSerialNumber) formData.append('asset_serial_number', (taskData as any).assetSerialNumber);
      if ((taskData as any).branchName) formData.append('branch_name', (taskData as any).branchName);
      if ((taskData as any).equipmentTypes) formData.append('equipment_types_id', JSON.stringify((taskData as any).equipmentTypes));

      const linksArray = Array.isArray((taskData as any).links)
        ? (taskData as any).links.map((url: string) => ({ url }))
        : [];
      if (linksArray.length > 0) {
        formData.append('links', JSON.stringify(linksArray));
      }

      const attachments = (taskData as any).attachments as File[] | undefined;
      if (attachments && attachments.length > 0) {
        attachments.forEach(file => formData.append('attachments', file));
      }

      console.log('📤 Sending request to tasksApi.create...');
      const response = await tasksApi.create(formData);
      console.log('📥 Response from tasksApi.create:', response);
      
      if (response.success && response.data) {
        const createdTask = (response.data as any).task || response.data;
        if (!createdTask?.id) {
          const backendMessage = (response as any).message || 'Respons pelayan tidak lengkap selepas simpan tugasan.';
          console.error('❌ Create task response missing persisted task ID:', response);
          return { success: false, error: backendMessage };
        }
        console.log('✅ Task created successfully:', createdTask);
        // Don't update state here - let refreshData() handle it after delay
        return { success: true, data: createdTask };
      }
      
      const errorMsg = response.error || 'Failed to create task';
      console.error('❌ Task creation failed:', errorMsg);
      return { success: false, error: errorMsg };
    } catch (error: any) {
      console.error('💥 Exception in createTask:', error);
      return { success: false, error: error?.message || 'Unknown error' };
    }
  }, []);

  const updateTask = useCallback(async (taskId: number, taskData: Partial<Task>) => {
    try {
      const payload: any = {}
      if ((taskData as any).title !== undefined) payload.title = (taskData as any).title
      if ((taskData as any).description !== undefined) payload.description = (taskData as any).description
      if ((taskData as any).supportType !== undefined) payload.support_type = (taskData as any).supportType
      if ((taskData as any).supportTypeSettingId !== undefined) payload.support_type_id = (taskData as any).supportTypeSettingId
      if ((taskData as any).clientLocation !== undefined) payload.client_location = (taskData as any).clientLocation
      if ((taskData as any).districtAddress !== undefined) payload.bandar_daerah = (taskData as any).districtAddress
      if ((taskData as any).state !== undefined) payload.state = (taskData as any).state
      if ((taskData as any).deadline !== undefined) payload.deadline = (taskData as any).deadline
      if ((taskData as any).deadlineTime !== undefined) payload.deadline_time = (taskData as any).deadlineTime
      if ((taskData as any).requirementDate !== undefined) payload.requirement_date = (taskData as any).requirementDate
      if ((taskData as any).requirementTime !== undefined) payload.requirement_time = (taskData as any).requirementTime
      if ((taskData as any).serviceStartDate !== undefined) payload.service_start_date = (taskData as any).serviceStartDate
      if ((taskData as any).serviceStartTime !== undefined) payload.service_start_time = (taskData as any).serviceStartTime
      if ((taskData as any).offerPrice !== undefined) payload.offer_price = (taskData as any).offerPrice
      if ((taskData as any).remarks !== undefined) payload.remarks = (taskData as any).remarks
      if ((taskData as any).statusSettingId !== undefined) payload.status_id = (taskData as any).statusSettingId
      if ((taskData as any).equipmentTypes !== undefined) payload.equipment_types_id = (taskData as any).equipmentTypes

      let latestTask: any = null;

      if (Object.keys(payload).length > 0) {
        const response = await tasksApi.update(taskId, payload);
        if (!response.success) {
          throw new Error(response.error || 'Failed to update task');
        }
        latestTask = (response.data as any)?.task || response.data || latestTask;
      }

      if ((taskData as any).status !== undefined) {
        const statusResponse = await tasksApi.updateStatus(taskId, (taskData as any).status);
        if (!statusResponse.success) {
          throw new Error(statusResponse.error || 'Failed to update task status');
        }
        latestTask = (statusResponse.data as any)?.task || statusResponse.data || latestTask;
      }

      if (latestTask) {
        setState(prev => ({
          ...prev,
          tasks: prev.tasks.map(task => task.id === taskId ? latestTask : task)
        }));
      }

      return { success: true, data: latestTask };
    } catch (error) {
      console.error('Error updating task:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }, []);

  const deleteTask = useCallback(async (taskId: number) => {
    try {
      const response = await tasksApi.delete(taskId);
      if (response.success) {
        setState(prev => ({
          ...prev,
          tasks: prev.tasks.filter(task => task.id !== taskId)
        }));
        return { success: true };
      }
      throw new Error('Failed to delete task');
    } catch (error) {
      console.error('Error deleting task:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }, []);

  // User operations
  const createUser = useCallback(async (userData: Omit<User, 'id'>) => {
    try {
      const response = await usersApi.create(userData);
      if (response.success && response.data) {
        setState(prev => ({
          ...prev,
          users: [response.data as User, ...prev.users]
        }));
        return { success: true, data: response.data };
      }
      throw new Error(response.error || response.message || 'Failed to create user');
    } catch (error) {
      console.error('Error creating user:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }, []);

  const updateUser = useCallback(async (userId: number, userData: Partial<User>) => {
    try {
      const response = await usersApi.update(userId, userData);
      const updatedUser = (response.data as any)?.user || response.data;
      if (response.success && updatedUser) {
        setState(prev => ({
          ...prev,
          users: prev.users.map(user => user.id === userId ? updatedUser : user)
        }));
        return { success: true, data: updatedUser };
      }
      throw new Error(response.error || 'Failed to update user');
    } catch (error) {
      console.error('Error updating user:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }, []);

  const deleteUser = useCallback(async (userId: number) => {
    try {
      const response = await usersApi.delete(userId);
      if (response.success) {
        setState(prev => ({
          ...prev,
          users: prev.users.filter(user => user.id !== userId)
        }));
        return { success: true };
      }
      throw new Error('Failed to delete user');
    } catch (error) {
      console.error('Error deleting user:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }, []);

  // Freelancer operations
  const createFreelancer = useCallback(async (freelancerData: Omit<Freelancer, 'id'>) => {
    try {
      const response = await freelancersApi.create(freelancerData);
      if (response.success && response.data) {
        setState(prev => ({
          ...prev,
          freelancers: [response.data as Freelancer, ...prev.freelancers]
        }));
        return { success: true, data: response.data };
      }
      throw new Error('Failed to create freelancer');
    } catch (error) {
      console.error('Error creating freelancer:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }, []);

  const updateFreelancer = useCallback(async (freelancerId: number, freelancerData: Partial<Freelancer>) => {
    try {
      const response = await freelancersApi.update(freelancerId, freelancerData);
      if (response.success && response.data) {
        setState(prev => ({
          ...prev,
          freelancers: prev.freelancers.map(freelancer => freelancer.id === freelancerId ? response.data as Freelancer : freelancer)
        }));
        return { success: true, data: response.data };
      }
      throw new Error('Failed to update freelancer');
    } catch (error) {
      console.error('Error updating freelancer:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }, []);

  const deleteFreelancer = useCallback(async (freelancerId: number) => {
    try {
      const response = await freelancersApi.delete(freelancerId);
      if (response.success) {
        setState(prev => ({
          ...prev,
          freelancers: prev.freelancers.filter(f => f.id !== freelancerId)
        }));
        return { success: true };
      }
      throw new Error('Failed to delete freelancer');
    } catch (error) {
      console.error('Error deleting freelancer:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }, []);

  // Notification operations
  const markNotificationAsRead = useCallback(async (notificationId: number) => {
    try {
      const response = await notificationsApi.markAsRead(notificationId);
      if (response.success) {
        setState(prev => ({
          ...prev,
          notifications: prev.notifications.map(notification => 
            notification.id === notificationId ? { ...notification, read: true } : notification
          )
        }));
        return { success: true };
      }
      throw new Error('Failed to mark notification as read');
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }, []);

  return {
    ...state,
    dashboardStats,
    loadData,
    refreshData: loadData, // Alias for loadData
    createTask,
    updateTask,
    deleteTask,
    createUser,
    updateUser,
    deleteUser,
    createFreelancer,
    updateFreelancer,
    deleteFreelancer,
    markNotificationAsRead
  };
};
