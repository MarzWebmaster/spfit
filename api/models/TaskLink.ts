import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import type { Task } from './Task.ts';

@Entity('task_links')
export class TaskLink {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  @Index()
  task_id!: number;

  @Column({ type: 'varchar', length: 500 })
  url!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description?: string;

  @CreateDateColumn()
  created_at!: Date;

  // Relations
  @ManyToOne('Task', (task: Task) => task.links, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_id' })
  task!: Task;
}
