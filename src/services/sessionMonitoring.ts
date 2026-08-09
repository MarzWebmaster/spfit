import axios from 'axios';

export interface Session {
  id: string;
  userId: number;
  ipAddress: string;
  userAgent: string;
  lastActivity: Date;
  isActive: boolean;
}

class SessionMonitoringService {
  private static instance: SessionMonitoringService;
  private activeSessionsCheckInterval: NodeJS.Timeout | null = null;

  private constructor() {
    // Private constructor to enforce singleton
  }

  public static getInstance(): SessionMonitoringService {
    if (!SessionMonitoringService.instance) {
      SessionMonitoringService.instance = new SessionMonitoringService();
    }
    return SessionMonitoringService.instance;
  }

  // Start monitoring sessions
  public startMonitoring(onSessionExpired: () => void) {
    // Check active sessions every minute
    this.activeSessionsCheckInterval = setInterval(async () => {
      try {
        const isSessionValid = await this.validateCurrentSession();
        if (!isSessionValid) {
          onSessionExpired();
        }
      } catch (error) {
        console.error('Session validation error:', error);
      }
    }, 60000); // 1 minute interval
  }

  // Stop monitoring sessions
  public stopMonitoring() {
    if (this.activeSessionsCheckInterval) {
      clearInterval(this.activeSessionsCheckInterval);
      this.activeSessionsCheckInterval = null;
    }
  }

  // Get all active sessions for current user
  public async getActiveSessions(): Promise<Session[]> {
    try {
      const response = await axios.get('/api/auth/sessions');
      return response.data.sessions;
    } catch (error) {
      console.error('Error fetching active sessions:', error);
      return [];
    }
  }

  // Validate current session
  public async validateCurrentSession(): Promise<boolean> {
    try {
      const token = localStorage.getItem('token');
      if (!token) return false;

      const response = await axios.get('/api/auth/validate-session', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      return response.data.valid;
    } catch (error) {
      console.error('Session validation error:', error);
      return false;
    }
  }

  // Terminate a specific session
  public async terminateSession(sessionId: string): Promise<boolean> {
    try {
      await axios.post('/api/auth/terminate-session', { sessionId });
      return true;
    } catch (error) {
      console.error('Error terminating session:', error);
      return false;
    }
  }

  // Terminate all other sessions except current
  public async terminateOtherSessions(): Promise<boolean> {
    try {
      await axios.post('/api/auth/terminate-other-sessions');
      return true;
    } catch (error) {
      console.error('Error terminating other sessions:', error);
      return false;
    }
  }

  // Update last activity timestamp
  public async updateLastActivity(): Promise<void> {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      await axios.post('/api/auth/update-activity', null, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
    } catch (error) {
      console.error('Error updating last activity:', error);
    }
  }
}

export const sessionMonitoring = SessionMonitoringService.getInstance();