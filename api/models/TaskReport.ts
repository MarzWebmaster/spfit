import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToOne, JoinColumn } from 'typeorm';
import type { Task } from './Task.ts';

@Entity('task_reports')
export class TaskReport {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int', unique: true })
  task_id!: number;

  @Column({ type: 'varchar', length: 500, nullable: true })
  file_url?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'timestamp' })
  submitted_at!: Date;

  @CreateDateColumn()
  created_at!: Date;

  // Relations
  @OneToOne('Task', (task: Task) => task.report, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_id' })
  task!: Task;
}
