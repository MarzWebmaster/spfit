import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import type { Task } from './Task.ts';

@Entity('task_parts')
export class TaskPart {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  task_id!: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  part_number?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description?: string;

  @Column({ type: 'int', default: 1 })
  quantity!: number;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  @ManyToOne('Task', (task: Task) => task.parts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_id' })
  task!: Task;
}
