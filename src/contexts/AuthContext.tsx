import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { User } from '../types';
import { storage } from '../utils/storage';
import api from '../utils/axios';

interface AuthState {
  user: User | null;
  token: string | null;
  sessionId: string | null;
  lastActivity: Date | null;
  rememberMe: boolean;
}

interface AuthContextType extends AuthState {
  isInitialized: boolean;
  login: (token: string, user: User, sessionId: string, rememberMe?: boolean) => void;
  logout: () => Promise<void>;
  updateLastActivity: () => void;
  isAuthenticated: () => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initializationCompleted = useRef(false);
  const [authState, setAuthState] = useState<AuthState>({
    token: null,
    user: null,
    sessionId: null,
    lastActivity: null,
    rememberMe: false
  });
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize auth state from localStorage and verify session
  useEffect(() => {
    const initializeAuth = async () => {
      // Prevent multiple initializations
      if (initializationCompleted.current) {
        return;
      }
      initializationCompleted.current = true;

      try {
        const token = storage.getToken();
        const user = storage.getUser();
        const sessionId = storage.getSessionId();
        const lastActivity = storage.getLastActivity();
        const rememberMe = storage.getRememberMe();

        if (token && user && sessionId) {
          // Set axios header first
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          
          // Always restore state from localStorage first
          setAuthState({
            token,
            user,
            sessionId,
            lastActivity: lastActivity ? new Date(lastActivity) : new Date(),
            rememberMe
          });
          
          // Try to verify with backend in background without blocking UI
          try {
            const response = await api.get('/auth/verify-session');
            if (!response.data.valid) {
              handleLogout();
            } else if (response.data?.data?.user) {
              const refreshedUser = response.data.data.user;
              setAuthState(prev => ({
                ...prev,
                user: {
                  ...(prev.user as any),
                  ...refreshedUser,
                  roleId: (refreshedUser as any).roleId ?? (refreshedUser as any).role_id ?? (prev.user as any)?.roleId
                }
              }));
              storage.setUser({
                ...(user as any),
                ...refreshedUser,
                roleId: (refreshedUser as any).roleId ?? (refreshedUser as any).role_id ?? (user as any)?.roleId
              });
            }
          } catch (error) {
            // Silently handle backend errors without affecting UI
            console.error('Session verification error:', error);
          }
        }
      } catch (error) {
        // Handle any storage errors
        console.error('Auth initialization error:', error);
        handleLogout();
      } finally {
        setIsInitialized(true);
      }
    };

    initializeAuth();
  }, []); // Empty dependency array for single initialization

  const handleLogout = useCallback(() => {
    setAuthState({
      token: null,
      user: null,
      sessionId: null,
      lastActivity: null,
      rememberMe: false
    });
    storage.clearAll();
    delete api.defaults.headers.common['Authorization'];
  }, []);

  // Session timeout checker
  useEffect(() => {
    if (!authState.lastActivity || !authState.token || authState.rememberMe) return;

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const lastActivity = authState.lastActivity!.getTime();
      
      if (now - lastActivity > SESSION_TIMEOUT) {
        handleLogout();
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [authState.lastActivity, authState.token, authState.rememberMe, handleLogout]);

  const login = useCallback((token: string, user: User, sessionId: string, rememberMe = false) => {
    const newState = {
      token,
      user,
      sessionId,
      lastActivity: new Date(),
      rememberMe
    };

    // Set state first
    setAuthState(newState);
    
    // Then save to storage
    storage.setToken(token);
    storage.setUser(user);
    storage.setSessionId(sessionId);
    storage.setLastActivity();
    storage.setRememberMe(rememberMe);
    
    // Initialize axios headers
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }, []);

  const logout = useCallback(async () => {
    try {
      if (authState.token) {
        // Only call logout API if we have a token
        await api.post('/auth/logout');
      }
    } catch (error) {
      // Ignore API errors during logout
      console.error('Logout error:', error);
    }
    
    handleLogout();
  }, [authState.token, handleLogout]);

  const updateLastActivity = useCallback(() => {
    const now = new Date();
    setAuthState(prev => ({
      ...prev,
      lastActivity: now
    }));
    storage.setLastActivity();
  }, []);

  const isAuthenticated = useCallback(() => {
    return Boolean(authState.token && authState.user && authState.sessionId);
  }, [authState.token, authState.user, authState.sessionId]);

  const contextValue = React.useMemo(() => ({
    ...authState,
    isInitialized,
    login,
    logout,
    updateLastActivity,
    isAuthenticated
  }), [
    authState,
    isInitialized,
    login,
    logout,
    updateLastActivity,
    isAuthenticated
  ]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};