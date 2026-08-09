import axios, { AxiosResponse } from 'axios';
import crypto from 'crypto';
import { User } from '../models/User';
import { Task } from '../models/Task';
import { Notification } from '../models/Notification';

export interface WebhookPayload {
  event: string;
  timestamp: string;
  data: any;
  signature?: string;
}

export interface WebhookEndpoint {
  id: string;
  url: string;
  secret: string;
  events: string[];
  active: boolean;
  retryCount: number;
  lastSuccess?: Date;
  lastFailure?: Date;
}

export interface WebhookDelivery {
  id: string;
  endpointId: string;
  event: string;
  payload: WebhookPayload;
  status: 'pending' | 'success' | 'failed' | 'retrying';
  attempts: number;
  maxAttempts: number;
  nextRetry?: Date;
  response?: {
    status: number;
    body: string;
    headers: Record<string, string>;
  };
  createdAt: Date;
  updatedAt: Date;
}

export class WebhookService {
  private endpoints: Map<string, WebhookEndpoint> = new Map();
  private deliveries: Map<string, WebhookDelivery> = new Map();
  private retryIntervals = [1000, 5000, 15000, 60000, 300000]; // 1s, 5s, 15s, 1m, 5m

  constructor() {
    this.loadEndpointsFromEnv();
    this.startRetryProcessor();
  }

  /**
   * Load webhook endpoints from environment variables
   */
  private loadEndpointsFromEnv(): void {
    const webhookUrls = process.env.WEBHOOK_URLS?.split(',') || [];
    const webhookSecrets = process.env.WEBHOOK_SECRETS?.split(',') || [];
    const webhookEvents = process.env.WEBHOOK_EVENTS?.split(';') || [];

    webhookUrls.forEach((url, index) => {
      if (url.trim()) {
        const endpoint: WebhookEndpoint = {
          id: `endpoint_${index + 1}`,
          url: url.trim(),
          secret: webhookSecrets[index]?.trim() || '',
          events: webhookEvents[index]?.split(',').map(e => e.trim()) || ['*'],
          active: true,
          retryCount: 0
        };
        this.endpoints.set(endpoint.id, endpoint);
      }
    });

    console.log(`Loaded ${this.endpoints.size} webhook endpoints`);
  }

  /**
   * Register a new webhook endpoint
   */
  registerEndpoint(
    url: string,
    secret: string,
    events: string[] = ['*']
  ): string {
    const id = `endpoint_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const endpoint: WebhookEndpoint = {
      id,
      url,
      secret,
      events,
      active: true,
      retryCount: 0
    };

    this.endpoints.set(id, endpoint);
    console.log(`Registered webhook endpoint: ${id} -> ${url}`);
    return id;
  }

  /**
   * Remove webhook endpoint
   */
  removeEndpoint(id: string): boolean {
    const removed = this.endpoints.delete(id);
    if (removed) {
      console.log(`Removed webhook endpoint: ${id}`);
    }
    return removed;
  }

  /**
   * Update webhook endpoint
   */
  updateEndpoint(
    id: string,
    updates: Partial<Omit<WebhookEndpoint, 'id'>>
  ): boolean {
    const endpoint = this.endpoints.get(id);
    if (!endpoint) {
      return false;
    }

    Object.assign(endpoint, updates);
    this.endpoints.set(id, endpoint);
    console.log(`Updated webhook endpoint: ${id}`);
    return true;
  }

  /**
   * Send webhook for user events
   */
  async sendUserWebhook(
    event: 'user.created' | 'user.updated' | 'user.deleted' | 'user.status_changed',
    user: User,
    metadata?: any
  ): Promise<void> {
    const payload: WebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role?.name,
          status: user.status,
          created_at: user.created_at,
          updated_at: user.updated_at
        },
        metadata
      }
    };

    await this.sendWebhook(event, payload);
  }

  /**
   * Send webhook for task events
   */
  async sendTaskWebhook(
    event: 'task.created' | 'task.updated' | 'task.assigned' | 'task.completed' | 'task.deleted',
    task: Task,
    metadata?: any
  ): Promise<void> {
    const payload: WebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      data: {
        task: {
          id: task.id,
          title: task.title,
          log_number: task.log_number,
          status: task.statusSetting?.name || task.status_id || null,
          // priority: task.priority, // Property doesn't exist in Task model
          assigned_to: task.assigned_to,
          created_by: task.created_by,
          due_date: task.deadline, // Using deadline instead of due_date
          created_at: task.created_at,
          updated_at: task.updated_at
        },
        metadata
      }
    };

    await this.sendWebhook(event, payload);
  }

  /**
   * Send webhook for notification events
   */
  async sendNotificationWebhook(
    event: 'notification.created' | 'notification.read',
    notification: Notification,
    metadata?: any
  ): Promise<void> {
    const payload: WebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      data: {
        notification: {
          id: notification.id,
          title: notification.title,
          message: notification.message,
          type: notification.type,
          // priority: notification.priority, // Property doesn't exist in Notification model
          user_id: notification.user_id,
          is_read: notification.is_read,
          created_at: notification.created_at
        },
        metadata
      }
    };

    await this.sendWebhook(event, payload);
  }

  /**
   * Send custom webhook
   */
  async sendCustomWebhook(
    event: string,
    data: any,
    metadata?: any
  ): Promise<void> {
    const payload: WebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      data: {
        ...data,
        metadata
      }
    };

    await this.sendWebhook(event, payload);
  }

  /**
   * Send webhook to all matching endpoints
   */
  private async sendWebhook(event: string, payload: WebhookPayload): Promise<void> {
    const matchingEndpoints = Array.from(this.endpoints.values()).filter(
      endpoint => endpoint.active && this.eventMatches(event, endpoint.events)
    );

    if (matchingEndpoints.length === 0) {
      console.log(`No active webhook endpoints for event: ${event}`);
      return;
    }

    console.log(`Sending webhook for event '${event}' to ${matchingEndpoints.length} endpoints`);

    const deliveryPromises = matchingEndpoints.map(endpoint => 
      this.deliverWebhook(endpoint, payload)
    );

    await Promise.allSettled(deliveryPromises);
  }

  /**
   * Deliver webhook to specific endpoint
   */
  private async deliverWebhook(
    endpoint: WebhookEndpoint,
    payload: WebhookPayload
  ): Promise<void> {
    const deliveryId = `delivery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Sign the payload
    const signedPayload = this.signPayload(payload, endpoint.secret);
    
    const delivery: WebhookDelivery = {
      id: deliveryId,
      endpointId: endpoint.id,
      event: payload.event,
      payload: signedPayload,
      status: 'pending',
      attempts: 0,
      maxAttempts: 5,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.deliveries.set(deliveryId, delivery);
    await this.attemptDelivery(delivery, endpoint);
  }

  /**
   * Attempt webhook delivery
   */
  private async attemptDelivery(
    delivery: WebhookDelivery,
    endpoint: WebhookEndpoint
  ): Promise<void> {
    delivery.attempts++;
    delivery.updatedAt = new Date();
    delivery.status = 'pending';

    try {
      const response: AxiosResponse = await axios.post(
        endpoint.url,
        delivery.payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'SPFIT-Webhook/1.0',
            'X-SPFIT-Event': delivery.event,
            'X-SPFIT-Delivery': delivery.id,
            'X-SPFIT-Signature': delivery.payload.signature || ''
          },
          timeout: 30000, // 30 seconds
          validateStatus: (status) => status >= 200 && status < 300
        }
      );

      // Success
      delivery.status = 'success';
      delivery.response = {
        status: response.status,
        body: JSON.stringify(response.data),
        headers: response.headers as Record<string, string>
      };

      endpoint.lastSuccess = new Date();
      endpoint.retryCount = 0;

      console.log(`Webhook delivered successfully: ${delivery.id} -> ${endpoint.url}`);
    } catch (error: any) {
      // Failure
      delivery.response = {
        status: error.response?.status || 0,
        body: error.message,
        headers: error.response?.headers || {}
      };

      endpoint.lastFailure = new Date();
      endpoint.retryCount++;

      if (delivery.attempts < delivery.maxAttempts) {
        delivery.status = 'retrying';
        delivery.nextRetry = new Date(
          Date.now() + (this.retryIntervals[delivery.attempts - 1] || 300000)
        );
        console.log(`Webhook delivery failed, will retry: ${delivery.id} -> ${endpoint.url}`);
      } else {
        delivery.status = 'failed';
        console.error(`Webhook delivery failed permanently: ${delivery.id} -> ${endpoint.url}`, error.message);
      }
    }

    this.deliveries.set(delivery.id, delivery);
  }

  /**
   * Sign webhook payload
   */
  private signPayload(payload: WebhookPayload, secret: string): WebhookPayload {
    if (!secret) {
      return payload;
    }

    const payloadString = JSON.stringify(payload);
    const signature = crypto
      .createHmac('sha256', secret)
      .update(payloadString)
      .digest('hex');

    return {
      ...payload,
      signature: `sha256=${signature}`
    };
  }

  /**
   * Verify webhook signature
   */
  verifySignature(payload: string, signature: string, secret: string): boolean {
    if (!secret || !signature) {
      return false;
    }

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    const receivedSignature = signature.replace('sha256=', '');
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(receivedSignature, 'hex')
    );
  }

  /**
   * Check if event matches endpoint events
   */
  private eventMatches(event: string, endpointEvents: string[]): boolean {
    return endpointEvents.includes('*') || endpointEvents.includes(event);
  }

  /**
   * Start retry processor
   */
  private startRetryProcessor(): void {
    setInterval(() => {
      this.processRetries();
    }, 10000); // Check every 10 seconds
  }

  /**
   * Process pending retries
   */
  private async processRetries(): Promise<void> {
    const now = new Date();
    const retryDeliveries = Array.from(this.deliveries.values()).filter(
      delivery => delivery.status === 'retrying' && 
                 delivery.nextRetry && 
                 delivery.nextRetry <= now
    );

    for (const delivery of retryDeliveries) {
      const endpoint = this.endpoints.get(delivery.endpointId);
      if (endpoint && endpoint.active) {
        await this.attemptDelivery(delivery, endpoint);
      }
    }
  }

  /**
   * Get webhook statistics
   */
  getStats(): {
    endpoints: number;
    activeEndpoints: number;
    totalDeliveries: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    pendingRetries: number;
  } {
    const deliveries = Array.from(this.deliveries.values());
    
    return {
      endpoints: this.endpoints.size,
      activeEndpoints: Array.from(this.endpoints.values()).filter(e => e.active).length,
      totalDeliveries: deliveries.length,
      successfulDeliveries: deliveries.filter(d => d.status === 'success').length,
      failedDeliveries: deliveries.filter(d => d.status === 'failed').length,
      pendingRetries: deliveries.filter(d => d.status === 'retrying').length
    };
  }

  /**
   * Get delivery history
   */
  getDeliveryHistory(limit: number = 100): WebhookDelivery[] {
    return Array.from(this.deliveries.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  /**
   * Get endpoint status
   */
  getEndpointStatus(id: string): WebhookEndpoint | null {
    return this.endpoints.get(id) || null;
  }

  /**
   * Get all endpoints
   */
  getAllEndpoints(): WebhookEndpoint[] {
    return Array.from(this.endpoints.values());
  }

  /**
   * Clean up old deliveries
   */
  cleanupOldDeliveries(olderThanDays: number = 30): number {
    const cutoffDate = new Date(Date.now() - (olderThanDays * 24 * 60 * 60 * 1000));
    const deliveries = Array.from(this.deliveries.entries());
    let cleaned = 0;

    for (const [id, delivery] of deliveries) {
      if (delivery.createdAt < cutoffDate && delivery.status !== 'retrying') {
        this.deliveries.delete(id);
        cleaned++;
      }
    }

    console.log(`Cleaned up ${cleaned} old webhook deliveries`);
    return cleaned;
  }

  /**
   * Test webhook endpoint
   */
  async testEndpoint(id: string): Promise<boolean> {
    const endpoint = this.endpoints.get(id);
    if (!endpoint) {
      return false;
    }

    const testPayload: WebhookPayload = {
      event: 'test.ping',
      timestamp: new Date().toISOString(),
      data: {
        message: 'This is a test webhook from SPFIT',
        endpoint_id: id
      }
    };

    try {
      await this.deliverWebhook(endpoint, testPayload);
      return true;
    } catch (error) {
      console.error(`Webhook test failed for endpoint ${id}:`, error);
      return false;
    }
  }
}