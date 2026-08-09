
import { AppDataSource } from '../config/database.js';
import { AuditTrail } from '../models/AuditTrail.js';
import { Request } from 'express';

export class AuditService {
  private static repo = AppDataSource.getRepository(AuditTrail);

  /**
   * Log an audit trail entry
   */
  static async log(params: {
    req?: Request;
    userId?: number;
    actionType: 'CREATE' | 'UPDATE' | 'DELETE' | 'VIEW' | 'LOGIN' | 'LOGOUT' | 'SYSTEM';
    tableName: string;
    recordId?: number;
    oldValues?: any;
    newValues?: any;
    description: string;
  }) {
    try {
      const { req, userId, actionType, tableName, recordId, oldValues, newValues, description } = params;

      // Determine user ID from request if not provided explicitly
      let finalUserId = userId;
      if (!finalUserId && req && (req as any).user) {
        finalUserId = (req as any).user.id;
      }

      // Get IP and User Agent from request
      let ipAddress = '127.0.0.1';
      let userAgent = 'System';
      
      if (req) {
        ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
        userAgent = req.headers['user-agent'] || 'Unknown';
      }

      // Sanitize sensitive data in old/new values
      const sanitizedOld = this.sanitizeData(oldValues);
      const sanitizedNew = this.sanitizeData(newValues);

      const audit = this.repo.create({
        user_id: finalUserId,
        action_type: actionType,
        table_name: tableName,
        record_id: recordId,
        old_values: sanitizedOld,
        new_values: sanitizedNew,
        ip_address: ipAddress,
        user_agent: userAgent,
        description: description,
      });

      await this.repo.save(audit);
    } catch (error) {
      console.error('Failed to create audit log:', error);
      // We don't want to fail the main transaction just because logging failed, usually.
      // But for strict audit requirements, you might want to throw.
      // For now, just log the error.
    }
  }

  /**
   * Helper to remove sensitive keys from logged data
   */
  private static sanitizeData(data: any): any {
    if (!data) return null;
    if (typeof data !== 'object') return data;

    const sensitiveKeys = ['password', 'password_hash', 'token', 'secret', 'credit_card', 'cvv'];
    const sanitized = Array.isArray(data) ? [...data] : { ...data };

    for (const key in sanitized) {
      if (sensitiveKeys.some(s => key.toLowerCase().includes(s))) {
        sanitized[key] = '***REDACTED***';
      } else if (typeof sanitized[key] === 'object') {
        sanitized[key] = this.sanitizeData(sanitized[key]);
      }
    }

    return sanitized;
  }
}
