import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import type { Task } from './Task.ts';
import { User } from './User.ts';

@Entity('task_waiting_list')
export class TaskWaitingList {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  @Index()
  task_id!: number;

  @Column({ type: 'int' })
  @Index()
  freelancer_id!: number;

  @Column({ type: 'int', default: 0 })
  position!: number;

  @CreateDateColumn()
  created_at!: Date;

  // Relations
  @ManyToOne('Task')
  @JoinColumn({ name: 'task_id' })
  task!: Task;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'freelancer_id' })
  freelancer!: User;
}
