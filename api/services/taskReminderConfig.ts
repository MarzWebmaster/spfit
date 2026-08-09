import type { Repository } from 'typeorm';
import { ReminderType } from '../models/TaskReminder.ts';
import { SystemSettings } from '../models/SystemSettings.ts';

export const TASK_REMINDER_SETTINGS_KEY = 'spfit_task_reminder_settings';

export type ReminderUnit = 'minutes' | 'hours' | 'days';

export interface ReminderOffsetConfig {
  value: number;
  unit: ReminderUnit;
}

export interface GlobalTaskReminderConfig {
  reminderType: ReminderType;
  offsets: ReminderOffsetConfig[];
  autoSendAtScheduledTime: boolean;
  channels: string[];
  templateId?: number;
  customMessage?: string;
  isActive: boolean;
}

const VALID_UNITS: ReminderUnit[] = ['minutes', 'hours', 'days'];

export function getDefaultReminderSettings(): GlobalTaskReminderConfig[] {
  return [
    {
      reminderType: ReminderType.ATTENDANCE,
      offsets: [],
      autoSendAtScheduledTime: true,
      channels: ['email'],
      customMessage: '',
      isActive: true,
    },
    {
      reminderType: ReminderType.DOCUMENT_SUBMISSION,
      offsets: [
        {
          value: 1,
          unit: 'days',
        },
      ],
      autoSendAtScheduledTime: false,
      channels: ['email'],
      customMessage: '',
      isActive: true,
    },
    {
      reminderType: ReminderType.REQUIREMENT,
      offsets: [
        {
          value: 1,
          unit: 'hours',
        },
      ],
      autoSendAtScheduledTime: true,
      channels: ['whatsapp', 'email'],
      customMessage: '',
      isActive: true,
    },
  ];
}

export function normalizeReminderSettings(raw: unknown): GlobalTaskReminderConfig[] {
  const defaults = getDefaultReminderSettings();
  const input = Array.isArray(raw) ? raw : [];

  return defaults.map((defaultConfig) => {
    const source = input.find((item) => item && (item as any).reminderType === defaultConfig.reminderType) as Partial<GlobalTaskReminderConfig> | undefined;
    const offsets = Array.isArray(source?.offsets)
      ? source!.offsets
          .map((offset: any) => ({
            value: Number(offset?.value),
            unit: offset?.unit as ReminderUnit,
          }))
          .filter(offset => Number.isFinite(offset.value) && offset.value > 0 && VALID_UNITS.includes(offset.unit))
      : defaultConfig.offsets;

    const channels = Array.isArray(source?.channels)
      ? source!.channels.filter((channel: unknown) => typeof channel === 'string' && channel.trim().length > 0)
      : defaultConfig.channels;

    return {
      reminderType: defaultConfig.reminderType,
      offsets,
      autoSendAtScheduledTime: source?.autoSendAtScheduledTime ?? defaultConfig.autoSendAtScheduledTime,
      channels: channels.length > 0 ? channels : defaultConfig.channels,
      templateId: source?.templateId ? Number(source.templateId) : undefined,
      customMessage: typeof source?.customMessage === 'string' ? source.customMessage : defaultConfig.customMessage,
      isActive: source?.isActive ?? defaultConfig.isActive,
    };
  });
}

export async function loadGlobalTaskReminderSettings(systemSettingsRepository: Repository<SystemSettings>): Promise<GlobalTaskReminderConfig[]> {
  const setting = await systemSettingsRepository.findOne({
    where: { setting_key: TASK_REMINDER_SETTINGS_KEY, is_active: true },
  });

  if (!setting?.setting_value) {
    return getDefaultReminderSettings();
  }

  try {
    return normalizeReminderSettings(JSON.parse(setting.setting_value));
  } catch (error) {
    console.error('Failed to parse task reminder settings:', error);
    return getDefaultReminderSettings();
  }
}