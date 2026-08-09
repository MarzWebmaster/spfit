import { useState, useEffect, useCallback } from 'react';

interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// Generic hook for API calls
export function useApi<T>(
  apiCall: () => Promise<ApiResponse<T>>,
  dependencies: any[] = []
) {
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  const fetchData = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const response = await apiCall();
      
      if (response.success) {
        setState({
          data: response.data || null,
          loading: false,
          error: null,
        });
      } else {
        setState({
          data: null,
          loading: false,
          error: response.error || 'An error occurred',
        });
      }
    } catch (error) {
      setState({
        data: null,
        loading: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      });
    }
  }, dependencies);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    ...state,
    refetch: fetchData,
  };
}

// Hook for API mutations (create, update, delete)
export function useApiMutation<T, P = any>(
  apiCall: (params: P) => Promise<ApiResponse<T>>
) {
  const [state, setState] = useState<ApiState<T> & { isSubmitting: boolean }>({
    data: null,
    loading: false,
    error: null,
    isSubmitting: false,
  });

  const mutate = useCallback(async (params: P) => {
    setState(prev => ({ ...prev, isSubmitting: true, error: null }));
    
    try {
      const response = await apiCall(params);
      
      if (response.success) {
        setState({
          data: response.data || null,
          loading: false,
          error: null,
          isSubmitting: false,
        });
        return { success: true, data: response.data };
      } else {
        setState(prev => ({
          ...prev,
          error: response.error || 'An error occurred',
          isSubmitting: false,
        }));
        return { success: false, error: response.error };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';
      setState(prev => ({
        ...prev,
        error: errorMessage,
        isSubmitting: false,
      }));
      return { success: false, error: errorMessage };
    }
  }, [apiCall]);

  const reset = useCallback(() => {
    setState({
      data: null,
      loading: false,
      error: null,
      isSubmitting: false,
    });
  }, []);

  return {
    ...state,
    mutate,
    reset,
  };
}

// Hook for paginated data
export function usePaginatedApi<T>(
  apiCall: (page: number, limit: number, ...args: any[]) => Promise<ApiResponse<{
    data: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>>,
  initialPage = 1,
  initialLimit = 10,
  dependencies: any[] = []
) {
  const [page, setPage] = useState(initialPage);
  const [limit, setLimit] = useState(initialLimit);
  const [state, setState] = useState<ApiState<{
    data: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> & { refreshing: boolean }>({
    data: null,
    loading: true,
    error: null,
    refreshing: false,
  });

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setState(prev => ({ ...prev, refreshing: true, error: null }));
    } else {
      setState(prev => ({ ...prev, loading: true, error: null }));
    }
    
    try {
      const response = await apiCall(page, limit, ...dependencies);
      
      if (response.success) {
        setState({
          data: response.data || null,
          loading: false,
          error: null,
          refreshing: false,
        });
      } else {
        setState({
          data: null,
          loading: false,
          error: response.error || 'An error occurred',
          refreshing: false,
        });
      }
    } catch (error) {
      setState({
        data: null,
        loading: false,
        error: error instanceof Error ? error.message : 'An error occurred',
        refreshing: false,
      });
    }
  }, [page, limit, ...dependencies]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const goToPage = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  const changeLimit = useCallback((newLimit: number) => {
    setLimit(newLimit);
    setPage(1); // Reset to first page when changing limit
  }, []);

  const refresh = useCallback(() => {
    fetchData(true);
  }, [fetchData]);

  return {
    ...state,
    page,
    limit,
    goToPage,
    changeLimit,
    refresh,
    refetch: fetchData,
  };
}

// Hook for authentication state
export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return !!localStorage.getItem('authToken');
  });
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      const { authApi } = await import('../services/api');
      const response = await authApi.login(email, password);
      
      if (response.success) {
        setIsAuthenticated(true);
        setUser(response.data?.user);
        return { success: true };
      } else {
        return { success: false, error: response.message || 'Login failed' };
      }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Login failed' 
      };
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    const { authApi } = await import('../services/api');
    await authApi.logout();
    setIsAuthenticated(false);
    setUser(null);
  }, []);

  const getCurrentUser = useCallback(async () => {
    if (!isAuthenticated) return;
    
    setLoading(true);
    try {
      const { authApi } = await import('../services/api');
      const response = await authApi.getCurrentUser();
      
      if (response.success) {
        setUser(response.data);
      } else {
        // Token might be invalid
        await logout();
      }
    } catch (error) {
      await logout();
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, logout]);

  useEffect(() => {
    getCurrentUser();
  }, [getCurrentUser]);

  return {
    isAuthenticated,
    user,
    loading,
    login,
    logout,
    getCurrentUser,
  };
}