import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from './User.ts';

export enum ActivityType {
  LOGIN = 'login',
  LOGOUT = 'logout',
  TASK_CREATED = 'task_created',
  TASK_UPDATED = 'task_updated',
  TASK_STATUS_CHANGED = 'task_status_changed',
  TASK_ASSIGNED = 'task_assigned',
  TASK_COMPLETED = 'task_completed',
  TASK_CANCELLED = 'task_cancelled',
  TASK_DELETED = 'task_deleted',
  TASK_APPLICATION = 'task_application',
  REPORT_SUBMITTED = 'report_submitted',
  FEEDBACK_SUBMITTED = 'feedback_submitted',
  PROFILE_UPDATED = 'profile_updated',
  PASSWORD_CHANGED = 'password_changed',
  PASSWORD_CHANGE_FAILED = 'password_change_failed',
  PASSWORD_RESET_REQUESTED = 'password_reset_requested',
  PASSWORD_RESET_COMPLETED = 'password_reset_completed',
  AVAILABILITY_CHANGED = 'availability_changed',
  NOTIFICATION_CREATED = 'notification_created',
  NOTIFICATION_READ = 'notification_read',
  NOTIFICATION_DELETED = 'notification_deleted',
  SYSTEM_ACCESS = 'system_access',
  SYSTEM_SETTING_CREATED = 'system_setting_created',
  SYSTEM_SETTING_UPDATED = 'system_setting_updated',
  SYSTEM_SETTING_DELETED = 'system_setting_deleted',
  SYSTEM_SETTING_VIEWED = 'system_setting_viewed'
}

@Entity('activity_logs')
export class ActivityLog {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int', nullable: true })
  @Index()
  user_id!: number | null;

  @Column({ 
    type: 'varchar', 
    length: 50 
  })
  @Index()
  activity_type!: ActivityType;

  @Column({ type: 'varchar', length: 255 })
  description!: string;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ip_address?: string;

  @Column({ type: 'text', nullable: true })
  user_agent?: string;

  @Column({ type: 'json', nullable: true })
  metadata?: any;

  @CreateDateColumn()
  created_at!: Date;

  // Relations
  @ManyToOne(() => User, user => user.activity_logs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;
}