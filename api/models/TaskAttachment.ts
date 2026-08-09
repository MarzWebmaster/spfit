import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import type { Task } from './Task.ts';

@Entity('task_attachments')
export class TaskAttachment {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  @Index()
  task_id!: number;

  @Column({ type: 'varchar', length: 255 })
  file_name!: string;

  @Column({ type: 'varchar', length: 500 })
  file_path!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  file_type?: string;

  @Column({ type: 'int', nullable: true })
  file_size?: number;

  @CreateDateColumn()
  created_at!: Date;

  // Relations
  @ManyToOne('Task', (task: Task) => task.attachments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_id' })
  task!: Task;
}
