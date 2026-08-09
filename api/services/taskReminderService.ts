import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import { AppDataSource } from '../config/database.ts';
import { Task, TaskStatus } from '../models/Task.ts';
import { User, UserStatus } from '../models/User.ts';
import { Notification, NotificationType } from '../models/Notification.ts';
import { WhatsAppMessage } from '../models/WhatsAppMessage.ts';
import { SystemSettings } from '../models/SystemSettings.ts';
import { ReminderType } from '../models/TaskReminder.ts';
import { enqueueWhatsAppMessage } from './messageQueueService.ts';
import { GlobalTaskReminderConfig, ReminderOffsetConfig, loadGlobalTaskReminderSettings } from './taskReminderConfig.ts';

const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const LOOKBACK_MS = CHECK_INTERVAL_MS + 60 * 1000;

const TERMINAL_STATUSES = new Set<string>([
  TaskStatus.SELESAI,
  TaskStatus.BORANG_DISEMAK_PEMBAYARAN_TERTUNGGAK,
  TaskStatus.TELAH_DIBAYAR,
  TaskStatus.DIBATALKAN,
  TaskStatus.SELESAI_PENUH,
]);

interface StoredNotificationTemplate {
  id: number;
  type: string;
  channel: 'E-mel' | 'Whatsapp' | 'Web Notification' | 'Webhook';
  name: string;
  subjectOrTitle: string;
  body: string;
  isDefault: boolean;
}

interface ReminderTrigger {
  code: string;
  title: string;
  targetAt: Date;
}

function toTimeString(value?: string | null): string {
  if (!value) return '09:00:00';
  const trimmed = String(value).trim();
  if (!trimmed) return '09:00:00';
  return trimmed.length === 5 ? `${trimmed}:00` : trimmed;
}

function buildEventDateTime(task: Task, reminderType: ReminderType): Date | null {
  let dateSource: Date | null = null;
  let timeSource: string | null = null;

  if (reminderType === ReminderType.ATTENDANCE) {
    dateSource = task.service_start_date || task.deadline || null;
    timeSource = task.service_start_time || null;
  } else if (reminderType === ReminderType.REQUIREMENT) {
    dateSource = task.requirement_date || task.deadline || null;
    timeSource = task.requirement_time || task.deadline_time || null;
  } else {
    // DOCUMENT_SUBMISSION or other types
    dateSource = task.deadline || null;
    timeSource = task.deadline_time || null;
  }

  if (!dateSource) return null;

  const yyyyMmDd = new Date(dateSource).toISOString().slice(0, 10);
  const hhMmSs = toTimeString(timeSource || null);
  const value = new Date(`${yyyyMmDd}T${hhMmSs}`);
  return Number.isNaN(value.getTime()) ? null : value;
}

function formatDateTime(value: Date): string {
  return value.toLocaleString('ms-MY', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function offsetToMinutes(offset: ReminderOffsetConfig): number {
  if (offset.unit === 'days') return offset.value * 24 * 60;
  if (offset.unit === 'hours') return offset.value * 60;
  return offset.value;
}

function buildTriggerCode(offset: ReminderOffsetConfig): string {
  const suffix = offset.unit === 'days' ? 'D' : offset.unit === 'hours' ? 'H' : 'M';
  return `B${offset.value}${suffix}`;
}

function buildTriggers(config: GlobalTaskReminderConfig, eventAt: Date): ReminderTrigger[] {
  const triggers = config.offsets.map((offset) => {
    const minutesBefore = offsetToMinutes(offset);
    return {
      code: buildTriggerCode(offset),
      title: `Peringatan Tugasan (${offset.value} ${offset.unit})`,
      targetAt: new Date(eventAt.getTime() - minutesBefore * 60 * 1000),
    };
  });

  if (config.reminderType === ReminderType.ATTENDANCE && config.autoSendAtScheduledTime) {
    triggers.push({
      code: 'DUE',
      title: 'Peringatan Ketibaan Lokasi',
      targetAt: eventAt,
    });
  }

  return triggers;
}

function isTriggerDue(targetAt: Date, now: Date): boolean {
  const diff = now.getTime() - targetAt.getTime();
  return diff >= 0 && diff <= LOOKBACK_MS;
}

function buildCorrelationId(taskId: number, userId: number, reminderType: ReminderType, triggerCode: string, eventDate: string): string {
  return `REM-${reminderType}-${taskId}-${userId}-${triggerCode}-${eventDate}`;
}

function renderTemplateString(template: string, variables: Record<string, string>): string {
  return template.replace(/{{\s*(\w+)\s*}}/g, (_match, key) => variables[key] ?? '');
}

function getChannelLabel(channel: string): StoredNotificationTemplate['channel'] | null {
  if (channel === 'email') return 'E-mel';
  if (channel === 'whatsapp') return 'Whatsapp';
  if (channel === 'web_notification') return 'Web Notification';
  return null;
}

function stripTemplateSuffix(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

function findTemplateForChannel(templates: StoredNotificationTemplate[], config: GlobalTaskReminderConfig, channel: string): StoredNotificationTemplate | undefined {
  const channelLabel = getChannelLabel(channel);
  if (!channelLabel) return undefined;

  const selected = config.templateId ? templates.find(template => Number(template.id) === Number(config.templateId)) : undefined;
  if (selected?.channel === channelLabel) return selected;

  if (selected) {
    const groupName = stripTemplateSuffix(selected.name);
    const sibling = templates.find(template =>
      stripTemplateSuffix(template.name) === groupName &&
      template.type === selected.type &&
      template.channel === channelLabel
    );
    if (sibling) return sibling;
  }

  return templates.find(template => template.type === 'Peringatan Tugasan' && template.channel === channelLabel && template.isDefault);
}

function buildArrivalConfirmationLink(task: Task, assignee: User): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) return '';

  const token = jwt.sign({
    type: 'arrival_confirmation',
    taskId: task.id,
    userId: assignee.id,
  }, secret, { expiresIn: '7d' });

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  return `${frontendUrl.replace(/\/$/, '')}/arrival-confirm?token=${encodeURIComponent(token)}`;
}

function buildDefaultReminderMessage(task: Task, assignee: User, eventAt: Date, config: GlobalTaskReminderConfig): string {
  const logNo = task.log_number ? ` (${task.log_number})` : '';
  const taskRef = `${task.title}${logNo}`;
  const when = formatDateTime(eventAt);

  if (config.reminderType === ReminderType.DOCUMENT_SUBMISSION) {
    return `Salam ${assignee.name}, ini peringatan untuk hantar dokumen bagi tugasan ${taskRef} sebelum ${when}.`;
  }

  return `Assalamualaikum ${assignee.name}, peringatan tugasan ${taskRef}. Kehadiran dijadualkan pada ${when}.\n\nTelah Tiba Di Lokasi: {{arrivalConfirmationLink}}`;
}

function buildReminderPayload(
  templates: StoredNotificationTemplate[],
  config: GlobalTaskReminderConfig,
  channel: string,
  task: Task,
  assignee: User,
  eventAt: Date,
): { subject: string; body: string } {
  const arrivalConfirmationLink = config.reminderType === ReminderType.ATTENDANCE ? buildArrivalConfirmationLink(task, assignee) : '';

  const variables = {
    freelancerName: assignee.name || '',
    taskTitle: task.title || '',
    taskLocation: task.client_location || '',
    reminderTime: formatDateTime(eventAt),
    referenceNumber: task.log_number || '',
    arrivalConfirmationLink,
  };

  const selectedTemplate = findTemplateForChannel(templates, config, channel);
  const defaultBody = config.customMessage?.trim() || buildDefaultReminderMessage(task, assignee, eventAt, config);

  if (!selectedTemplate) {
    return {
      subject: `Peringatan Tugasan - ${task.title}`,
      body: renderTemplateString(defaultBody, variables),
    };
  }

  return {
    subject: renderTemplateString(selectedTemplate.subjectOrTitle || `Peringatan Tugasan - ${task.title}`, variables),
    body: renderTemplateString(selectedTemplate.body || defaultBody, variables),
  };
}

function parseNotificationTemplates(raw: string | undefined): StoredNotificationTemplate[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getSmtpTransporter(): nodemailer.Transporter | null {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || '587');
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

async function sendReminderEmail(transporter: nodemailer.Transporter | null, assignee: User, subject: string, body: string): Promise<void> {
  if (!transporter || !assignee.email) return;

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: assignee.email,
      subject,
      text: body,
      html: `<div>${body.replace(/\n/g, '<br />')}</div>`,
    });
  } catch (error) {
    console.error('Task reminder email send error:', error);
  }
}

export function startTaskReminderJob() {
  const taskRepository = AppDataSource.getRepository(Task);
  const notificationRepository = AppDataSource.getRepository(Notification);
  const whatsappRepository = AppDataSource.getRepository(WhatsAppMessage);
  const systemSettingsRepository = AppDataSource.getRepository(SystemSettings);
  const smtpTransporter = getSmtpTransporter();

  let timer: NodeJS.Timeout | null = null;
  let processing = false;

  const run = async () => {
    if (processing) {
      timer = setTimeout(run, CHECK_INTERVAL_MS);
      return;
    }

    processing = true;
    try {
      const now = new Date();
      const lookBack = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
      const lookAhead = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
      const settings = await loadGlobalTaskReminderSettings(systemSettingsRepository);
      const templateSetting = await systemSettingsRepository.findOne({ where: { setting_key: 'spfit_notification_templates', is_active: true } });
      const templates = parseNotificationTemplates(templateSetting?.setting_value);

      const tasks = await taskRepository
        .createQueryBuilder('task')
        .leftJoinAndSelect('task.assignee', 'assignee')
        .leftJoinAndSelect('task.statusSetting', 'statusSetting')
        .where('task.assigned_to IS NOT NULL')
        .andWhere('assignee.status = :activeUserStatus', { activeUserStatus: UserStatus.AKTIF })
        .andWhere('((task.service_start_date IS NOT NULL AND task.service_start_date BETWEEN :lookBack AND :lookAhead) OR (task.deadline IS NOT NULL AND task.deadline BETWEEN :lookBack AND :lookAhead))', { lookBack, lookAhead })
        .getMany();

      for (const task of tasks) {
        if (!task.assignee) continue;

        const statusName = task.statusSetting?.name || '';
        if (statusName && TERMINAL_STATUSES.has(statusName)) continue;

        for (const config of settings) {
          if (!config.isActive) continue;
          if (config.reminderType === ReminderType.ATTENDANCE && task.arrival_confirmed_at) continue;

          const eventAt = buildEventDateTime(task, config.reminderType);
          if (!eventAt) continue;

          const triggers = buildTriggers(config, eventAt);
          const eventDate = eventAt.toISOString().slice(0, 10);

          for (const trigger of triggers) {
            if (!isTriggerDue(trigger.targetAt, now)) continue;

            const correlationId = buildCorrelationId(task.id, task.assignee.id, config.reminderType, trigger.code, eventDate);
            const notificationTitle = `${trigger.title} - ${task.title}`;
            const existingNotification = await notificationRepository.count({
              where: {
                user_id: task.assignee.id,
                task_id: task.id,
                title: notificationTitle,
                type: NotificationType.TASK_REMINDER,
              },
            });
            if (existingNotification > 0) continue;

            const payloadByChannel = new Map<string, { subject: string; body: string }>();
            config.channels.forEach((channel) => {
              payloadByChannel.set(channel, buildReminderPayload(templates, config, channel, task, task.assignee!, eventAt));
            });

            const defaultPayload = payloadByChannel.values().next().value || { subject: notificationTitle, body: '' };
            const webPayload = payloadByChannel.get('web_notification') || defaultPayload;

            const notification = notificationRepository.create({
              user_id: task.assignee.id,
              task_id: task.id,
              type: NotificationType.TASK_REMINDER,
              title: notificationTitle,
              message: webPayload.body,
              is_read: !config.channels.includes('web_notification'),
              created_at: new Date(),
            });
            await notificationRepository.save(notification);

            if (config.channels.includes('whatsapp') && task.assignee.phone) {
              const existingWa = await whatsappRepository.count({ where: { correlation_id: correlationId } });
              if (existingWa === 0) {
                const whatsappPayload = payloadByChannel.get('whatsapp') || defaultPayload;
                await enqueueWhatsAppMessage({
                  to: task.assignee.phone,
                  message: whatsappPayload.body,
                  correlation_id: correlationId,
                  freelancer_id: task.assignee.id,
                  freelancer_name: task.assignee.name,
                  task_id: task.id,
                  task_title: task.title,
                });
              }
            }

            if (config.channels.includes('email')) {
              const emailPayload = payloadByChannel.get('email') || defaultPayload;
              await sendReminderEmail(smtpTransporter, task.assignee, emailPayload.subject, emailPayload.body);
            }
          }
        }
      }
    } catch (error) {
      console.error('Task reminder job error:', error);
    } finally {
      processing = false;
      timer = setTimeout(run, CHECK_INTERVAL_MS);
    }
  };

  run();

  return () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };
}
