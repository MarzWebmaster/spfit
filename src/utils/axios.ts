import axios from 'axios';
import { storage } from './storage';
import { getApiBaseUrl } from './apiUrl';

const api = axios.create({
  baseURL: getApiBaseUrl(),
});

// Flag to prevent multiple refresh attempts
let isRefreshing = false;
let failedQueue: Array<{resolve: Function, reject: Function}> = [];

// Request interceptor
api.interceptors.request.use((config) => {
  const token = storage.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  // Log outgoing requests
  logNetworkRequest('request', {
    url: config.url,
    method: config.method?.toUpperCase(),
    hasAuth: !!token,
    baseURL: config.baseURL
  });
  
  return config;
});

// Enhanced logging function
const logNetworkRequest = (type: 'request' | 'response' | 'error', data: any) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${type.toUpperCase()}]`, data);
};

// Response interceptor
api.interceptors.response.use(
  (response) => {
    // Log successful responses
    logNetworkRequest('response', {
      url: response.config.url,
      method: response.config.method?.toUpperCase(),
      status: response.status,
      statusText: response.statusText
    });
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;

    // Enhanced error logging
    logNetworkRequest('error', {
      url: originalRequest?.url,
      method: originalRequest?.method?.toUpperCase(),
      status: status,
      statusText: error.response?.statusText,
      message: error.message,
      isRetry: originalRequest?._retry || false
    });

    // Handle 429 (Too Many Requests) - don't retry immediately
    if (status === 429) {
      console.warn('🚫 Rate limit exceeded, waiting before retry...');
      // Wait 1 second before rejecting to avoid immediate retry
      await new Promise(resolve => setTimeout(resolve, 1000));
      return Promise.reject(error);
    }

    // Handle 401 (Unauthorized): Clear auth and redirect
    if (status === 401) {
      // Don't clear if this is the verify-session endpoint itself
      if (!originalRequest.url?.includes('/auth/verify-session')) {
        storage.clearAll();
        delete api.defaults.headers.common['Authorization'];
        
        // Redirect to login only if not already there
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
      }
      return Promise.reject(error);
    }

    return Promise.reject(error);
  }
);

// Initialize headers if token exists
const token = storage.getToken();
if (token) {
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}

export default api;
