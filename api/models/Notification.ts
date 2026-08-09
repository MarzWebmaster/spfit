import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import type { User } from './User.ts';
import type { Task } from './Task.ts';

export enum NotificationType {
  TASK_CREATED = 'task_created',
  TASK_ASSIGNED = 'task_assigned',
  TASK_COMPLETED = 'task_completed',
  TASK_CANCELLED = 'task_cancelled',
  PAYMENT_RECEIVED = 'payment_received',
  REPORT_SUBMITTED = 'report_submitted',
  FEEDBACK_RECEIVED = 'feedback_received',
  SYSTEM_ANNOUNCEMENT = 'system_announcement',
  TASK_APPLICATION = 'task_application',
  TASK_STATUS_CHANGED = 'task_status_changed',
  TASK_REMINDER = 'task_reminder',
  REGISTRATION_FREELANCER = 'registration_freelancer'
}

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  @Index()
  user_id!: number;

  @Column({ type: 'int', nullable: true })
  @Index()
  task_id?: number;

  @Column({ 
    type: 'enum', 
    enum: NotificationType 
  })
  type!: NotificationType;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text' })
  message!: string;

  @Column({ type: 'boolean', default: false })
  @Index()
  is_read!: boolean;

  @CreateDateColumn()
  created_at!: Date;

  // Relations
  @ManyToOne('User', (user: User) => user.notifications, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne('Task', (task: Task) => task.notifications, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_id' })
  task?: Task;
}
