// src/utils/storage.ts
export const StorageKeys = {
  AUTH_TOKEN: 'authToken',
  USER_DATA: 'spfit_current_user',
  SESSION_ID: 'sessionId',
  LAST_ACTIVITY: 'lastActivity',
  REMEMBER_ME: 'rememberMe'
} as const;

export const storage = {
  setToken: (token: string) => localStorage.setItem(StorageKeys.AUTH_TOKEN, token),
  getToken: () => localStorage.getItem(StorageKeys.AUTH_TOKEN),
  setUser: (user: any) => localStorage.setItem(StorageKeys.USER_DATA, JSON.stringify(user)),
  getUser: () => {
    const data = localStorage.getItem(StorageKeys.USER_DATA);
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch (e) {
      return null;
    }
  },
  setSessionId: (sessionId: string) => localStorage.setItem(StorageKeys.SESSION_ID, sessionId),
  getSessionId: () => localStorage.getItem(StorageKeys.SESSION_ID),
  setLastActivity: () => localStorage.setItem(StorageKeys.LAST_ACTIVITY, new Date().toISOString()),
  getLastActivity: () => {
    const data = localStorage.getItem(StorageKeys.LAST_ACTIVITY);
    if (!data) return null;
    const date = new Date(data);
    return isNaN(date.getTime()) ? null : date;
  },
  setRememberMe: (rememberMe: boolean) => localStorage.setItem(StorageKeys.REMEMBER_ME, JSON.stringify(rememberMe)),
  getRememberMe: () => {
    const data = localStorage.getItem(StorageKeys.REMEMBER_ME);
    if (!data) return false;
    try {
      return JSON.parse(data) === true;
    } catch (e) {
      return false;
    }
  },
  clearAll: () => {
    localStorage.removeItem(StorageKeys.AUTH_TOKEN);
    localStorage.removeItem(StorageKeys.USER_DATA);
    localStorage.removeItem(StorageKeys.SESSION_ID);
    localStorage.removeItem(StorageKeys.LAST_ACTIVITY);
    localStorage.removeItem(StorageKeys.REMEMBER_ME);
  }
};