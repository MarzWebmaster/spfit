import api from '../utils/axios';

// API response types
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  errorType?: string;
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Login response interface
interface LoginResponse {
  accessToken: string;
  expiresIn: number;
  user: {
    id: number;
    name: string;
    email: string;
    role: string;
    status: string;
  };
}

// Generic API request function using axios
async function apiRequest<T>(
  endpoint: string,
  options: { method?: string; data?: any; params?: any } = {}
): Promise<ApiResponse<T>> {
  try {
    const axiosConfig = {
      method: options.method || 'GET',
      url: endpoint,
      data: options.data,
      params: options.params
    };
    
    const response = await api(axiosConfig);

    return {
      success: true,
      data: response.data.data || response.data,
      message: response.data.message,
    };
  } catch (error: any) {
    console.error('API request failed:', error instanceof Error ? error.message : 'Unknown error');
    const details = error.response?.data?.errors;
    const detailMessage = Array.isArray(details)
      ? details
          .map((item: any) => item?.message || item?.field)
          .filter(Boolean)
          .join(' | ')
      : '';
    const baseMessage = error.response?.data?.message || error.message || 'Unknown error';
    return {
      success: false,
      error: detailMessage ? `${baseMessage}: ${detailMessage}` : baseMessage,
    };
  }
}

// Authentication API
export const authApi = {
  login: async (
    email: string,
    password: string,
    rememberMe?: boolean,
    location?: {
      status: 'granted' | 'denied' | 'unsupported' | 'error' | 'timeout';
      latitude?: number;
      longitude?: number;
      accuracy?: number;
      capturedAt?: string;
      error?: string;
    }
  ) => {
    try {
      // Call backend API
      const response = await api.post('/auth/login', { email, password, rememberMe, location });
      
      const { success, message, data } = response.data;
      
      if (success && data?.user) {
        return {
          success: true,
          data: {
            user: data.user,
            accessToken: data.accessToken,
            sessionId: data.sessionId || data.accessToken // Fallback to token if no sessionId
          }
        };
      } else {
        return {
          success: false,
          message: message || 'Log masuk gagal. Sila semak e-mel dan kata laluan anda.'
        };
      }
      
      
    } catch (error: any) {
      return {
        success: false,
        message: error?.response?.data?.message || error?.message || 'Ralat sambungan. Sila cuba lagi.'
      };
    }
  },

  register: async (userData: any) => {
    return apiRequest('/auth/register', {
      method: 'POST',
      data: userData,
    });
  },

  logout: async () => {
    return apiRequest('/auth/logout', {
      method: 'POST'
    });
  },

  forgotPassword: async (email: string, captchaAnswer: number, number1: number, number2: number) => {
    return apiRequest('/auth/forgot-password', {
      method: 'POST',
      data: { email, captchaAnswer, number1, number2 },
    });
  },

  resetPassword: async (token: string, newPassword: string) => {
    return apiRequest('/auth/reset-password', {
      method: 'POST',
      data: { token, newPassword },
    });
  },

  getCurrentUser: async () => {
    return apiRequest('/auth/me');
  },
};

// Users API
export const usersApi = {
  getAll: async (page = 1, limit = 10, search?: string) => {
    const params = {
      page: page.toString(),
      limit: limit.toString(),
      ...(search && { search }),
    };
    return apiRequest<PaginatedResponse<any>>('/users', { params });
  },

  getById: async (id: number) => {
    return apiRequest(`/users/${id}`);
  },

  create: async (userData: any) => {
    return apiRequest('/users', {
      method: 'POST',
      data: userData,
    });
  },

  update: async (id: number, userData: any) => {
    return apiRequest(`/users/${id}`, {
      method: 'PUT',
      data: userData,
    });
  },

  delete: async (id: number) => {
    return apiRequest(`/users/${id}`, {
      method: 'DELETE',
    });
  },

  updateStatus: async (id: number, status: string) => {
    return apiRequest(`/users/${id}/status`, {
      method: 'PUT',
      data: { status },
    });
  },
};

// Tasks API
export const tasksApi = {
  getAll: async (page = 1, limit = 10, filters?: any) => {
    const params = {
      page: page.toString(),
      limit: limit.toString(),
      ...filters,
    };
    return apiRequest<PaginatedResponse<any>>('/tasks', { params });
  },

  getById: async (id: number) => {
    return apiRequest(`/tasks/${id}`);
  },

  duplicate: async (id: number) => {
    return apiRequest(`/tasks/${id}/duplicate`, {
      method: 'POST'
    });
  },

  create: async (taskData: any) => {
    return apiRequest('/tasks', {
      method: 'POST',
      data: taskData,
    });
  },

  update: async (id: number, taskData: any) => {
    return apiRequest(`/tasks/${id}`, {
      method: 'PUT',
      data: taskData,
    });
  },

  delete: async (id: number) => {
    return apiRequest(`/tasks/${id}`, {
      method: 'DELETE',
    });
  },

  assign: async (id: number, freelancerId: number) => {
    return apiRequest(`/tasks/${id}/assign`, {
      method: 'PATCH',
      data: { assigned_to: freelancerId },
    });
  },

  unassign: async (id: number) => {
    return apiRequest(`/tasks/${id}/assign`, {
      method: 'PATCH',
      data: { assigned_to: null },
    });
  },

  updateStatus: async (id: number, status: string) => {
    return apiRequest(`/tasks/${id}/status`, {
      method: 'PATCH',
      data: { status },
    });
  },

  uploadReport: async (id: number, formData: FormData) => {
    const token = localStorage.getItem('authToken');
    const headers: Record<string, string> = {};
    
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    try {
      const response = await api.post(`/tasks/${id}/report`, formData, { headers });
      return {
        success: true,
        data: response.data.data || response.data,
        message: response.data.message,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Upload failed',
      };
    }
  },

  deleteAttachment: async (taskId: number, attachmentId: number) => {
    return apiRequest(`/tasks/${taskId}/attachments/${attachmentId}`, {
      method: 'DELETE',
    });
  },

  submitFeedback: async (taskId: number, data: {
    skill_rating: number;
    communication_rating: number;
    time_punctuality_rating: number;
    response_time_rating: number;
    comment?: string;
  }) => {
    return apiRequest(`/tasks/${taskId}/feedback`, {
      method: 'POST',
      data,
    });
  },
};

export const projectsApi = {
  getAll: async (page = 1, limit = 10, filters?: any) => {
    const params = {
      page: page.toString(),
      limit: limit.toString(),
      ...filters,
    };

    return apiRequest('/projects', { params });
  },

  getById: async (id: number) => {
    return apiRequest(`/projects/${id}`);
  },

  create: async (projectData: any) => {
    return apiRequest('/projects', {
      method: 'POST',
      data: projectData,
    });
  },

  update: async (id: number, projectData: any) => {
    return apiRequest(`/projects/${id}`, {
      method: 'PUT',
      data: projectData,
    });
  },

  delete: async (id: number) => {
    return apiRequest(`/projects/${id}`, {
      method: 'DELETE',
    });
  }
};

export const masterlistsApi = {
  getAll: async (page = 1, limit = 10, filters?: any) => {
    const params = {
      page: page.toString(),
      limit: limit.toString(),
      ...filters,
    };

    return apiRequest('/masterlists', { params });
  },

  getById: async (id: number, options?: { include_assets?: boolean }) => {
    const params =
      typeof options?.include_assets === 'boolean'
        ? { include_assets: options.include_assets ? 'true' : 'false' }
        : undefined;
    return apiRequest(`/masterlists/${id}`, params ? { params } : undefined);
  },

  duplicate: async (
    id: number,
    options?: { project_id?: number; code?: string; name?: string; include_assets?: boolean }
  ) => {
    return apiRequest(`/masterlists/${id}/duplicate`, {
      method: 'POST',
      data: options || {}
    });
  },

  create: async (payload: any) => {
    return apiRequest('/masterlists', {
      method: 'POST',
      data: payload,
    });
  },

  update: async (id: number, payload: any) => {
    return apiRequest(`/masterlists/${id}`, {
      method: 'PUT',
      data: payload,
    });
  },

  deleteWorkLink: async (id: number, index: number) => {
    return apiRequest(`/masterlists/${id}/work-links/${index}`, {
      method: 'DELETE',
    });
  },

  deleteWorkDocument: async (id: number, index: number) => {
    return apiRequest(`/masterlists/${id}/work-documents/${index}`, {
      method: 'DELETE',
    });
  },

  delete: async (id: number) => {
    return apiRequest(`/masterlists/${id}`, {
      method: 'DELETE',
    });
  },

  exportData: async (id: number) => {
    return apiRequest(`/masterlists/${id}/export`);
  }
};

export const assetsApi = {
  getAll: async (page = 1, limit = 10, filters?: any) => {
    const params = {
      page: page.toString(),
      limit: limit.toString(),
      ...filters,
    };

    return apiRequest('/assets', { params });
  },

  getById: async (id: number) => {
    return apiRequest(`/assets/${id}`);
  },

  create: async (payload: any) => {
    return apiRequest('/assets', {
      method: 'POST',
      data: payload,
    });
  },

  update: async (id: number, payload: any) => {
    return apiRequest(`/assets/${id}`, {
      method: 'PUT',
      data: payload,
    });
  },

  delete: async (id: number) => {
    return apiRequest(`/assets/${id}`, {
      method: 'DELETE',
    });
  },

  suggestIntel: async (model?: string, serial?: string) => {
    return apiRequest('/assets/intel/suggest', {
      params: {
        model: model || '',
        serial: serial || ''
      }
    });
  },

  uploadAttachments: async (assetId: number, formData: FormData) => {
    return apiRequest(`/assets/${assetId}/attachments`, {
      method: 'POST',
      data: formData,
    });
  },

  deleteAttachment: async (assetId: number, attachmentId: number) => {
    return apiRequest(`/assets/${assetId}/attachments/${attachmentId}`, {
      method: 'DELETE',
    });
  },

  updateAttachment: async (assetId: number, attachmentId: number, displayName: string) => {
    return apiRequest(`/assets/${assetId}/attachments/${attachmentId}`, {
      method: 'PATCH',
      data: { display_name: displayName },
    });
  },

  getUpdateLogs: async (id: number) => {
    return apiRequest(`/assets/${id}/update-logs`);
  }
};

export const assetReportsApi = {
  getTopUpdaters: async (filters?: {
    project_id?: number;
    masterlist_id?: number;
    category_id?: number;
    action_type?: string;
    status?: string;
    period?: string;
    start_date?: string;
    end_date?: string;
    limit?: number;
  }) => {
    return apiRequest('/reports/top-updaters', { params: filters });
  },

  getUpdateLogs: async (filters?: {
    page?: number;
    limit?: number;
    asset_id?: number;
    project_id?: number;
    masterlist_id?: number;
    category_id?: number;
    action_type?: string;
    status?: string;
    period?: string;
    start_date?: string;
    end_date?: string;
  }) => {
    return apiRequest('/reports/update-logs', { params: filters });
  }
};

export const taskSettingsApi = {
  getAll: async (includeInactive = false) => {
    return apiRequest('/task-settings', {
      params: { includeInactive: includeInactive ? 'true' : 'false' }
    });
  },

  createStatus: async (value: string) => {
    return apiRequest('/task-settings/statuses', {
      method: 'POST',
      data: { value }
    });
  },

  updateStatus: async (id: number, value: string) => {
    return apiRequest(`/task-settings/statuses/${id}`, {
      method: 'PUT',
      data: { value }
    });
  },

  deleteStatus: async (id: number) => {
    return apiRequest(`/task-settings/statuses/${id}`, {
      method: 'DELETE'
    });
  },

  createSupportType: async (value: string) => {
    return apiRequest('/task-settings/support-types', {
      method: 'POST',
      data: { value }
    });
  },

  updateSupportType: async (id: number, value: string) => {
    return apiRequest(`/task-settings/support-types/${id}`, {
      method: 'PUT',
      data: { value }
    });
  },

  deleteSupportType: async (id: number) => {
    return apiRequest(`/task-settings/support-types/${id}`, {
      method: 'DELETE'
    });
  },

  createEquipmentCode: async (value: string) => {
    return apiRequest('/task-settings/equipment-codes', {
      method: 'POST',
      data: { value }
    });
  },

  updateEquipmentCode: async (id: number, value: string) => {
    return apiRequest(`/task-settings/equipment-codes/${id}`, {
      method: 'PUT',
      data: { value }
    });
  },

  deleteEquipmentCode: async (id: number) => {
    return apiRequest(`/task-settings/equipment-codes/${id}`, {
      method: 'DELETE'
    });
  }
};

export const taskRemindersApi = {
  getSettings: async () => {
    return apiRequest('/task-reminders/settings');
  },

  saveSettings: async (settings: any[]) => {
    return apiRequest('/task-reminders/settings', {
      method: 'PUT',
      data: { settings }
    });
  },

  getAll: async () => {
    return apiRequest('/task-reminders');
  },

  getByTaskId: async (taskId: number) => {
    return apiRequest(`/task-reminders/task/${taskId}`);
  },

  create: async (reminderData: any) => {
    return apiRequest('/task-reminders', {
      method: 'POST',
      data: reminderData
    });
  },

  update: async (id: number, reminderData: any) => {
    return apiRequest(`/task-reminders/${id}`, {
      method: 'PUT',
      data: reminderData
    });
  },

  delete: async (id: number) => {
    return apiRequest(`/task-reminders/${id}`, {
      method: 'DELETE'
    });
  },

  bulkUpsert: async (taskId: number, reminders: any[]) => {
    return apiRequest('/task-reminders/bulk-upsert', {
      method: 'POST',
      data: { task_id: taskId, reminders }
    });
  },

  confirmArrival: async (token: string, coords?: { latitude?: number; longitude?: number; accuracy?: number }) => {
    return apiRequest('/task-reminders/arrival/confirm', {
      method: 'POST',
      data: {
        token,
        latitude: coords?.latitude,
        longitude: coords?.longitude,
        accuracy: coords?.accuracy,
      }
    });
  },

  manuallyConfirmArrival: async (taskId: number) => {
    return apiRequest(`/task-reminders/arrival/manual/${taskId}`, {
      method: 'POST'
    });
  }
};

export const assetSettingsApi = {
  getAll: async (includeInactive = false) => {
    return apiRequest('/asset-settings', {
      params: { includeInactive: includeInactive ? 'true' : 'false' }
    });
  },

  createCategory: async (value: string) => {
    return apiRequest('/asset-settings/categories', {
      method: 'POST',
      data: { value }
    });
  },

  updateCategory: async (id: number, value: string) => {
    return apiRequest(`/asset-settings/categories/${id}`, {
      method: 'PUT',
      data: { value }
    });
  },

  deleteCategory: async (id: number) => {
    return apiRequest(`/asset-settings/categories/${id}`, {
      method: 'DELETE'
    });
  },

  createBrand: async (value: string) => {
    return apiRequest('/asset-settings/brands', {
      method: 'POST',
      data: { value }
    });
  },

  updateBrand: async (id: number, value: string) => {
    return apiRequest(`/asset-settings/brands/${id}`, {
      method: 'PUT',
      data: { value }
    });
  },

  deleteBrand: async (id: number) => {
    return apiRequest(`/asset-settings/brands/${id}`, {
      method: 'DELETE'
    });
  }
};

// Task Done (Tugasan Siap) API
const normalizeTaskDone = (raw: any): any => {
  if (!raw) return raw;

  const task = raw.task
    ? {
        ...raw.task,
        log_number: raw.task.log_number || raw.task.logNumber || '',
        support_type: raw.task.support_type || raw.task.supportType || '',
        client_location: raw.task.client_location || raw.task.clientLocation || '',
        bandar_daerah: raw.task.bandar_daerah || raw.task.district_address || raw.task.districtAddress || '',
        offer_price: Number(raw.task.offer_price ?? raw.task.offerPrice ?? 0),
        status: raw.task.status || raw.task.statusSetting?.name || raw.task.status_setting?.name || '',
      }
    : raw.task;

  const files = Array.isArray(raw.files)
    ? raw.files.map((file: any) => ({
        id: Number(file.id),
        file_url: file.file_url || file.fileUrl || '',
        original_name: file.original_name || file.originalName || 'Fail PDF',
        created_at: file.created_at || file.createdAt || '',
      }))
    : [];

  return {
    ...raw,
    service_start_date: raw.service_start_date || raw.serviceStartDate || '',
    action_taken: raw.action_taken || raw.actionTaken || '',
    support_pdf_url: raw.support_pdf_url || raw.supportPdfUrl || '',
    task,
    files,
  };
};

export const taskDoneApi = {
  getAll: async (page = 1, limit = 10) => {
    const params = {
      page: page.toString(),
      limit: limit.toString(),
    };
    const response = await apiRequest<any>('/tasks-done', { params });
    if (!response.success || !response.data) return response;

    const data = response.data as any;
    const tasks = Array.isArray(data.tasks) ? data.tasks.map((item: any) => normalizeTaskDone(item)) : [];
    return {
      ...response,
      data: {
        ...data,
        tasks,
      },
    };
  },

  getById: async (id: number) => {
    const response = await apiRequest(`/tasks-done/${id}`);
    if (!response.success || !response.data) return response;

    const wrapped = response.data as any;
    const taskDone = wrapped.taskDone || wrapped;
    return {
      ...response,
      data: normalizeTaskDone(taskDone),
    };
  },

  create: async (taskDoneData: any) => {
    if (taskDoneData instanceof FormData) {
      const token = localStorage.getItem('authToken');
      const headers: Record<string, string> = {};

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      try {
        const response = await api.post('/tasks-done', taskDoneData, { headers });
        const wrapped = response.data.data || response.data;
        const taskDone = wrapped.taskDone || wrapped;
        return {
          success: true,
          data: normalizeTaskDone(taskDone),
          message: response.data.message,
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.response?.data?.message || error.message || 'Upload failed',
        };
      }
    }

    return apiRequest('/tasks-done', {
      method: 'POST',
      data: taskDoneData,
    });
  },

  update: async (id: number, taskDoneData: any) => {
    if (taskDoneData instanceof FormData) {
      const token = localStorage.getItem('authToken');
      const headers: Record<string, string> = {};

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      try {
        const response = await api.put(`/tasks-done/${id}`, taskDoneData, { headers });
        const wrapped = response.data.data || response.data;
        const taskDone = wrapped.taskDone || wrapped;
        return {
          success: true,
          data: normalizeTaskDone(taskDone),
          message: response.data.message,
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.response?.data?.message || error.message || 'Update failed',
        };
      }
    }

    return apiRequest(`/tasks-done/${id}`, {
      method: 'PUT',
      data: taskDoneData,
    });
  },

  submit: async (id: number, taskDoneData: any) => {
    if (taskDoneData instanceof FormData) {
      const token = localStorage.getItem('authToken');
      const headers: Record<string, string> = {};

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      try {
        const response = await api.put(`/tasks-done/${id}/submit`, taskDoneData, { headers });
        const wrapped = response.data.data || response.data;
        const taskDone = wrapped.taskDone || wrapped;
        return {
          success: true,
          data: normalizeTaskDone(taskDone),
          message: response.data.message,
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.response?.data?.message || error.message || 'Submit failed',
        };
      }
    }

    return apiRequest(`/tasks-done/${id}/submit`, {
      method: 'PUT',
      data: taskDoneData,
    });
  },

  markReviewed: async (id: number, taskDoneData?: any) => {
    if (taskDoneData instanceof FormData) {
      const token = localStorage.getItem('authToken');
      const headers: Record<string, string> = {};

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      try {
        const response = await api.patch(`/tasks-done/${id}/reviewed`, taskDoneData, { headers });
        const wrapped = response.data.data || response.data;
        const taskDone = wrapped.taskDone || wrapped;
        return {
          success: true,
          data: normalizeTaskDone(taskDone),
          message: response.data.message,
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.response?.data?.message || error.message || 'Reviewed action failed',
        };
      }
    }

    return apiRequest(`/tasks-done/${id}/reviewed`, {
      method: 'PATCH',
      data: taskDoneData,
    });
  },

  getByFreelancer: async (freelancerId: number, page = 1, limit = 10) => {
    const params = {
      page: page.toString(),
      limit: limit.toString(),
    };
    const response = await apiRequest<any>(`/tasks-done/freelancer/${freelancerId}`, { params });
    if (!response.success || !response.data) return response;

    const data = response.data as any;
    const tasks = Array.isArray(data.tasks) ? data.tasks.map((item: any) => normalizeTaskDone(item)) : [];
    return {
      ...response,
      data: {
        ...data,
        tasks,
      },
    };
  },

  deleteFile: async (taskDoneId: number, fileId: number) => {
    const response = await apiRequest(`/tasks-done/${taskDoneId}/files/${fileId}`, {
      method: 'DELETE'
    });
    if (!response.success || !response.data) return response;
    const wrapped = response.data as any;
    const taskDone = wrapped.taskDone || wrapped;
    return {
      ...response,
      data: normalizeTaskDone(taskDone),
    };
  },
};

export const paymentsApi = {
  getAll: async (page = 1, limit = 10, filters?: any) => {
    const params = {
      page: page.toString(),
      limit: limit.toString(),
      ...(filters || {}),
    };
    return apiRequest<any>('/payments', { params });
  },

  getById: async (id: number) => {
    return apiRequest<any>(`/payments/${id}`);
  },

  getPrefillByTaskDone: async (taskDoneId: number) => {
    return apiRequest<any>(`/payments/prefill/${taskDoneId}`);
  },

  create: async (paymentData: {
    task_done_id: number;
    recipient_name: string;
    recipient_account_number: string;
    recipient_bank_name: string;
    recipient_email: string;
    remarks?: string;
  }) => {
    return apiRequest('/payments', {
      method: 'POST',
      data: paymentData,
    });
  },

  approve: async (id: number) => {
    return apiRequest(`/payments/${id}/approve`, {
      method: 'PATCH',
    });
  },

  markPaid: async (id: number, payload?: any) => {
    return apiRequest(`/payments/${id}/mark-paid`, {
      method: 'PATCH',
      data: payload,
    });
  },
};

// Freelancers API
export const freelancersApi = {
  getAll: async (page = 1, limit = 10, filters?: any) => {
    const params = {
      page: page.toString(),
      limit: limit.toString(),
      ...filters,
    };
    return apiRequest<PaginatedResponse<any>>('/freelancers', { params });
  },

  getById: async (id: number) => {
    return apiRequest(`/freelancers/${id}`);
  },

  create: async (freelancerData: any) => {
    return apiRequest('/freelancers', {
      method: 'POST',
      data: freelancerData,
    });
  },

  update: async (id: number, freelancerData: any) => {
    return apiRequest(`/freelancers/${id}`, {
      method: 'PUT',
      data: freelancerData,
    });
  },

  delete: async (id: number) => {
    return apiRequest(`/freelancers/${id}`, {
      method: 'DELETE',
    });
  },

  updateStatus: async (id: number, status: string) => {
    return apiRequest(`/freelancers/${id}/status`, {
      method: 'PUT',
      data: { status },
    });
  },

  rate: async (id: number, rating: number, comment?: string) => {
    return apiRequest(`/freelancers/${id}/rate`, {
      method: 'POST',
      data: { rating, comment },
    });
  },

  updateProfile: async (id: number, profileData: any) => {
    return apiRequest(`/freelancers/${id}/profile`, {
      method: 'PUT',
      data: profileData,
    });
  },

  getTasks: async (id: number, page = 1, limit = 100) => {
    return apiRequest(`/freelancers/${id}/tasks?page=${page}&limit=${limit}`);
  },

  getBankAccounts: async (id: number) => {
    return apiRequest<{ bankAccounts: any[] }>(`/freelancers/${id}/bank-accounts`);
  },

  createBankAccount: async (id: number, bankAccountData: any) => {
    return apiRequest(`/freelancers/${id}/bank-accounts`, {
      method: 'POST',
      data: bankAccountData,
    });
  },

  updateBankAccount: async (id: number, accountId: number, bankAccountData: any) => {
    return apiRequest(`/freelancers/${id}/bank-accounts/${accountId}`, {
      method: 'PUT',
      data: bankAccountData,
    });
  },

  deleteBankAccount: async (id: number, accountId: number) => {
    return apiRequest(`/freelancers/${id}/bank-accounts/${accountId}`, {
      method: 'DELETE',
    });
  },
};

// Notifications API
export const notificationsApi = {
  getAll: async (page = 1, limit = 10) => {
    const params = {
      page: page.toString(),
      limit: limit.toString(),
    };
    return apiRequest<PaginatedResponse<any>>('/notifications', { params });
  },

  getAllNotifications: async () => {
    return apiRequest<any>('/notifications/all');
  },

  markAsRead: async (id: number) => {
    return apiRequest(`/notifications/${id}/read`, {
      method: 'PATCH',
    });
  },

  markAllAsRead: async () => {
    return apiRequest('/notifications/read-all', {
      method: 'PATCH',
    });
  },

  getStats: async () => {
    return apiRequest('/notifications/stats');
  },
};

// System API
export const systemApi = {
  getDashboardStats: async () => {
    return apiRequest('/system/dashboard');
  },

  getHealth: async () => {
    return apiRequest('/system/health');
  },

  getSettings: async () => {
    return apiRequest('/system/settings/public');
  },

  // Get a specific setting by key (auth required)
  getSettingByKey: async (key: string) => {
    return apiRequest(`/system/settings/${key}`);
  },

  // Get all settings (admin only)
  getAllSettings: async (params?: any) => {
    return apiRequest('/system/settings', { params });
  },

  updateSetting: async (key: string, value: any) => {
    // If value is an object containing setting_value, treat it as the full payload
    if (typeof value === 'object' && value !== null && 'setting_value' in value) {
      return apiRequest(`/system/settings/${key}`, {
        method: 'PUT',
        data: value,
      });
    }
    
    // Otherwise wrap it
    const payload = typeof value === 'string' ? value : JSON.stringify(value);
    return apiRequest(`/system/settings/${key}`, {
      method: 'PUT',
      data: { setting_value: payload },
    });
  },

  // Create a new setting (admin only)
  createSetting: async (data: { key: string; value: string; description?: string; category?: string; is_public?: boolean }) => {
    const payload = {
      ...data,
      value: typeof data.value === 'string' ? data.value : JSON.stringify(data.value)
    } as typeof data;
    return apiRequest('/system/settings', {
      method: 'POST',
      data: payload,
    });
  },

  // Delete a setting (admin only)
  deleteSetting: async (key: string) => {
    return apiRequest(`/system/settings/${key}`, {
      method: 'DELETE',
    });
  },

  getActivityLogs: async (page = 1, limit = 10) => {
    const params = {
      page: page.toString(),
      limit: limit.toString(),
    };
    return apiRequest<PaginatedResponse<any>>('/system/activity-logs', { params });
  },

  sendTestEmail: async (payload: {
    recipient_email: string;
    smtp: {
      server: string;
      port: number;
      username: string;
      password: string;
      fromAddress: string;
      security: 'TLS' | 'SSL' | 'None';
    };
  }) => {
    return apiRequest('/system/settings/test-email', {
      method: 'POST',
      data: payload,
    });
  },

  getUpdateStatus: async (clearLogs = false) => {
    return apiRequest('/system/update/status', {
      params: clearLogs ? { clearLogs: '1' } : undefined,
    });
  },

  checkUpdate: async (branch?: string) => {
    return apiRequest('/system/update/check', {
      params: branch ? { branch } : undefined,
    });
  },

  applyUpdate: async (branch?: string) => {
    return apiRequest('/system/update/apply', {
      method: 'POST',
      data: branch ? { branch } : {},
    });
  },
};

// Roles API
export const rolesApi = {
  getAll: async () => {
    return apiRequest('/roles');
  },

  getById: async (id: number) => {
    return apiRequest(`/roles/${id}`);
  },

  create: async (roleData: { name: string; description?: string; permissions: string[]; roleTypeId?: number }) => {
    return apiRequest('/roles', {
      method: 'POST',
      data: roleData,
    });
  },

  update: async (id: number, roleData: { name: string; description?: string; permissions: string[]; roleTypeId?: number }) => {
    return apiRequest(`/roles/${id}`, {
      method: 'PUT',
      data: roleData,
    });
  },

  delete: async (id: number) => {
    return apiRequest(`/roles/${id}`, {
      method: 'DELETE',
    });
  },
};

// Role Types API
export const roleTypesApi = {
  getAll: async () => {
    return apiRequest('/role-types');
  },
};

// Main Cons API
export const mainConsApi = {
  getAll: async () => {
    return apiRequest('/main-cons');
  },

  getById: async (id: number) => {
    return apiRequest(`/main-cons/${id}`);
  },

  create: async (data: any) => {
    return apiRequest('/main-cons', {
      method: 'POST',
      data,
    });
  },

  update: async (id: number, data: any) => {
    return apiRequest(`/main-cons/${id}`, {
      method: 'PUT',
      data,
    });
  },

  delete: async (id: number) => {
    return apiRequest(`/main-cons/${id}`, {
      method: 'DELETE',
    });
  },
};

// Wasapmatic API
export const wasapmaticApi = {
  getProfile: async () => {
    return apiRequest('/wasapmatic/profile');
  },

  sendMessage: async (data: { 
    to: string; 
    message: string; 
    correlation_id?: string;
    freelancer_id?: number;
    freelancer_name?: string;
    task_id?: number;
    task_title?: string;
  }) => {
    return apiRequest('/wasapmatic/send', {
      method: 'POST',
      data,
    });
  },

  sendTemplate: async (data: { to: string; templateName: string; params?: Record<string, string> }) => {
    return apiRequest('/wasapmatic/send-template', {
      method: 'POST',
      data,
    });
  },

  testConnection: async () => {
    return apiRequest('/wasapmatic/profile');
  },

  updateConfig: async (data: { apiKey: string; deviceId: string; apiUrl?: string; isActive?: boolean }) => {
    return apiRequest('/wasapmatic/config', {
      method: 'POST',
      data,
    });
  },

  getProviderStatus: async () => {
    return apiRequest('/wasapmatic/providers/status');
  },

  setActiveProvider: async (provider: 'wasapmatic' | 'marz' | null) => {
    return apiRequest('/wasapmatic/providers/active', {
      method: 'POST',
      data: { provider },
    });
  },

  getDeliveryStatus: async (correlationId: string) => {
    return apiRequest('/delivery', {
      params: { correlationId, limit: 1 }
    });
  },
};

export const marzWasapApi = {
  getProfile: async () => {
    return apiRequest('/wasapmatic/marz/profile');
  },

  testConnection: async () => {
    return apiRequest('/wasapmatic/marz/profile');
  },

  updateConfig: async (data: { apiSecret: string; accountId: string; apiUrl?: string; isActive?: boolean }) => {
    return apiRequest('/wasapmatic/marz/config', {
      method: 'POST',
      data,
    });
  },
};

// OpenAI API
export const openaiApi = {
  testConnection: async () => {
    return apiRequest('/openai/test', {
      method: 'POST',
    });
  },

  getModels: async () => {
    return apiRequest('/openai/models');
  },

  chat: async (data: { messages: Array<{ role: string; content: string }>; model?: string; temperature?: number; max_tokens?: number }) => {
    return apiRequest('/openai/chat', {
      method: 'POST',
      data,
    });
  },

  updateConfig: async (data: { apiKey: string }) => {
    return apiRequest('/openai/config', {
      method: 'POST',
      data,
    });
  },
};

// Gemini API

export const ilmuApi = {
  testConnection: async () => {
    return apiRequest('/ilmu/test', {
      method: 'POST',
    });
  },

  getModels: async () => {
    return apiRequest('/ilmu/models');
  },

  chat: async (data: { messages: Array<{ role: string; content: string }>; model?: string; temperature?: number; max_tokens?: number }) => {
    return apiRequest('/ilmu/chat', {
      method: 'POST',
      data,
    });
  },

  getConfig: async () => {
    return apiRequest('/ilmu/config');
  },

  saveConfig: async (data: { apiKey?: string; model?: string; baseUrl?: string }) => {
    return apiRequest('/ilmu/config', {
      method: 'POST',
      data,
    });
  },
};

export const geminiApi = {
  testConnection: async () => {
    return apiRequest('/gemini/test', {
      method: 'POST',
    });
  },

  getModels: async () => {
    return apiRequest('/gemini/models');
  },

  generate: async (data: { prompt: string; model?: string }) => {
    return apiRequest('/gemini/generate', {
      method: 'POST',
      data,
    });
  },

  generateContent: async (data: { contents: any[]; generationConfig?: any; model?: string }) => {
    return apiRequest('/gemini/generate-content', {
      method: 'POST',
      data,
    });
  },

  updateConfig: async (data: { apiKey?: string; model?: string }) => {
    return apiRequest('/gemini/config', {
      method: 'POST',
      data,
    });
  },

  getConfig: async () => {
    return apiRequest('/gemini/config');
  },
};

export const apiKeysApi = {
  list: async () => {
    return apiRequest('/api-keys');
  },

  create: async (data: { name: string }) => {
    return apiRequest('/api-keys', {
      method: 'POST',
      data,
    });
  },

  revoke: async (id: number) => {
    return apiRequest(`/api-keys/${id}/revoke`, {
      method: 'PATCH',
    });
  },

  delete: async (id: number) => {
    return apiRequest(`/api-keys/${id}`, {
      method: 'DELETE',
    });
  },
};

export const aiTaskAssistantApi = {
  chat: async (formData: FormData) => {
    try {
      const response = await api.post('/ai-task-assistant/chat', formData);
      return {
        success: true,
        data: response.data.data || response.data,
        message: response.data.message,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'AI task assistant failed',
      };
    }
  },
};


export const aiMasterlistAssistantApi = {
  chat: async (formData: FormData) => {
    try {
      const response = await api.post('/ai-masterlist-assistant/chat', formData);
      return {
        success: true,
        data: response.data.data || response.data,
        message: response.data.message,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'AI masterlist assistant failed',
      };
    }
  },
  processPdf: (formData: FormData, callbacks: {
    onStatus?: (data: any) => void;
    onPageOcr?: (data: any) => void;
    onPageProgress?: (data: any) => void;
    onPageSkip?: (data: any) => void;
    onPageError?: (data: any) => void;
    onComplete?: (data: any) => void;
    onError?: (data: any) => void;
    onOcrLog?: (data: any) => void;
  }): AbortController => {
    const controller = new AbortController();
    const token = localStorage.getItem('token');
    const baseUrl = api.defaults?.baseURL || '';

    fetch('/api/ai-masterlist-assistant/process-pdf', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
      signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok) {
        const text = await response.text();
        callbacks.onError?.({ message: text || `HTTP ${response.status}` });
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        callbacks.onError?.({ message: 'Stream not available' });
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let currentEvent = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            const dataStr = line.slice(6).trim();
            try {
              const data = JSON.parse(dataStr);
              switch (currentEvent) {
                case 'status': callbacks.onStatus?.(data); break;
                case 'page-ocr': callbacks.onPageOcr?.(data); break;
                case 'page-progress': callbacks.onPageProgress?.(data); break;
                case 'page-skip': callbacks.onPageSkip?.(data); break;
                case 'page-error': callbacks.onPageError?.(data); break;
                case 'complete': callbacks.onComplete?.(data); break;
                case 'error': callbacks.onError?.(data); break;
                case 'ocr-log': callbacks.onOcrLog?.(data); break;
              }
            } catch {}
          }
        }
      }
    }).catch((err) => {
      if (err.name !== 'AbortError') {
        callbacks.onError?.({ message: err.message || 'Gagal sambung ke server.' });
      }
    });

    return controller;
  },
  apply: async (drafts: any[], project_id?: number, masterlist_id?: number, resolutions?: Record<string, any>, files?: File[]) => {
    try {
      const formData = new FormData();
      formData.append('drafts', JSON.stringify(drafts));
      formData.append('project_id', String(project_id || ''));
      formData.append('masterlist_id', String(masterlist_id || ''));
      formData.append('resolutions', JSON.stringify(resolutions || {}));
      if (files && files.length > 0) {
        files.forEach(file => formData.append('attachments', file));
      }

      const response = await api.post('/ai-masterlist-assistant/apply', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return {
        success: true,
        data: response.data.data || response.data,
        message: response.data.message,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Failed to apply masterlist updates',
      };
    }
  },
};

// Offers API
export const offersApi = {
  generate: async (data: { taskId: number; freelancerIds: number[] }) => {
    return apiRequest('/offers/generate', {
      method: 'POST',
      data,
    });
  },

  accept: async (token: string) => {
    return apiRequest(`/offers/accept/${token}`, {
      method: 'GET',
    });
  },

  reject: async (token: string) => {
    return apiRequest(`/offers/reject/${token}`, {
      method: 'GET',
    });
  },

  getWaitingList: async (taskId: number) => {
    return apiRequest(`/offers/waiting-list/${taskId}`);
  },

  getTaskOffers: async (taskId: number) => {
    return apiRequest(`/offers/task/${taskId}`);
  },
};

// Audit API
export const auditApi = {
  getLogs: async (params?: { page?: number; limit?: number; startDate?: string; endDate?: string; actionType?: string; tableName?: string; userId?: string; search?: string }) => {
    return apiRequest<PaginatedResponse<any>>('/audit', { params });
  },

  exportLogs: async (params?: { startDate?: string; endDate?: string; actionType?: string; tableName?: string; userId?: string }) => {
    // For download, we need to handle it differently to trigger browser download
    // But since apiRequest wraps everything, we can just use the token and open a new window or use fetch blob
    // For simplicity here, we return the url to open
    const query = new URLSearchParams(params as any).toString();
    return {
        success: true,
        data: { url: `/api/audit/export?${query}` }
    };
  }
};

export default {
  auth: authApi,
  users: usersApi,
  tasks: tasksApi,
  freelancers: freelancersApi,
  notifications: notificationsApi,
  system: systemApi,
  roles: rolesApi,
  roleTypes: roleTypesApi,
  mainCons: mainConsApi,
  wasapmatic: wasapmaticApi,
  marzWasap: marzWasapApi,
  openai: openaiApi,
  gemini: geminiApi,
  ilmu: ilmuApi,
  aiTaskAssistant: aiTaskAssistantApi,
  offers: offersApi,
  audit: auditApi,
  assetReports: assetReportsApi,
};

