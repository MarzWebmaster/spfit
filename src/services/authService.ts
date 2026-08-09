import jwt from 'jsonwebtoken';

export interface JWTPayload {
  userId: number;
  email: string;
  roleId: number;
  roleName: string;
  iat?: number;
  exp?: number;
}

export class AuthService {
  /**
   * Validate JWT token structure and expiration
   */
  validateToken(token: string): { valid: boolean; payload?: JWTPayload; error?: string } {
    try {
      // Check token structure (should have 3 parts)
      const parts = token.split('.');
      if (parts.length !== 3) {
        return { valid: false, error: 'Invalid token structure' };
      }

      // Decode payload (middle part)
      const payload = JSON.parse(atob(parts[1])) as JWTPayload;
      
      // Check expiration
      const currentTime = Date.now() / 1000;
      if (payload.exp && payload.exp < currentTime) {
        return { valid: false, error: 'Token expired' };
      }

      // Validate required fields
      if (!payload.userId || !payload.email || !payload.roleId || !payload.roleName) {
        return { valid: false, error: 'Missing required token fields' };
      }

      return { valid: true, payload };
    } catch (error) {
      return { valid: false, error: 'Token validation failed' };
    }
  }

  /**
   * Check if token is about to expire (within 5 minutes)
   */
  isTokenExpiringSoon(token: string): boolean {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return true;
      
      const payload = JSON.parse(atob(parts[1]));
      const currentTime = Date.now() / 1000;
      const fiveMinutes = 5 * 60;
      
      return payload.exp && (payload.exp - currentTime) < fiveMinutes;
    } catch {
      return true;
    }
  }

  /**
   * Sanitize user input to prevent XSS
   */
  sanitizeInput(input: string): string {
    if (typeof input !== 'string') return '';
    
    return input
      .replace(/[<>]/g, '') // Remove < and > characters
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  /**
   * Validate email format
   */
  validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate password strength
   */
  validatePassword(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
    
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    
    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }
    
    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate phone number format (Malaysian)
   */
  validatePhone(phone: string): boolean {
    const phoneRegex = /^[0-9+\-\s()]+$/;
    return phoneRegex.test(phone) && phone.length >= 10 && phone.length <= 15;
  }

  /**
   * Validate IC number format (Malaysian)
   */
  validateICNumber(ic: string): boolean {
    const icRegex = /^[0-9]{6}-[0-9]{2}-[0-9]{4}$/;
    return icRegex.test(ic);
  }

  /**
   * Validate URL format
   */
  validateUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate file upload
   */
  validateFile(file: File, maxSizeMB: number = 2): { valid: boolean; error?: string } {
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    
    if (file.size > maxSizeBytes) {
      return { valid: false, error: `File size exceeds ${maxSizeMB}MB limit` };
    }
    
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      return { valid: false, error: 'Invalid file type. Only JPEG, PNG, and PDF are allowed' };
    }
    
    return { valid: true };
  }
}

export const authService = new AuthService();