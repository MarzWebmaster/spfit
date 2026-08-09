import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import type { Task } from './Task.ts';

export enum ReminderType {
  ATTENDANCE = 'attendance', // Hadir Ke Lokasi
  DOCUMENT_SUBMISSION = 'document_submission', // Hantar Dokumen
  REQUIREMENT = 'requirement' // Masa Keperluan
}

export enum ReminderTiming {
  ON_SPOT = 'on_spot', // Langsung/keadaan
  ON_DATE_TIME = 'on_date_time', // Pada tarikh/masa tertentu
  BEFORE_HOURS = 'before_hours', // Sebelum beberapa jam
  BEFORE_DAYS = 'before_days', // Sebelum beberapa hari
  BEFORE_MINUTES = 'before_minutes' // Sebelum beberapa minit
}

export enum ReminderChannel {
  EMAIL = 'email',
  WHATSAPP = 'whatsapp',
  WEB_NOTIFICATION = 'web_notification'
}

@Entity('task_reminders')
export class TaskReminder {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  @Index()
  task_id!: number;

  @Column({
    type: 'enum',
    enum: ReminderType
  })
  reminder_type!: ReminderType;

  @Column({
    type: 'enum',
    enum: ReminderTiming
  })
  timing_option!: ReminderTiming;

  @Column({ type: 'int', nullable: true })
  timing_value?: number; // Untuk BEFORE_HOURS, BEFORE_DAYS, BEFORE_MINUTES

  @Column({ type: 'varchar', length: 5, nullable: true })
  timing_date_time?: string; // Format: HH:mm untuk ON_DATE_TIME

  @Column({ type: 'simple-array', default: 'email' })
  channels!: string[]; // Array of ReminderChannel

  @Column({ type: 'int', nullable: true })
  template_id?: number; // Reference ke NotificationTemplate id

  @Column({ type: 'varchar', length: 500, nullable: true })
  custom_message?: string; // Fallback jika template tidak ada

  @Column({ type: 'boolean', default: true })
  is_active!: boolean;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  // Relations
  @ManyToOne('Task', (task: Task) => task.reminders, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_id' })
  task!: Task;
}
