import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToOne, JoinColumn, Check } from 'typeorm';
import type { Task } from './Task.ts';

@Entity('task_feedback')
@Check('skill_rating >= 1 AND skill_rating <= 5')
@Check('communication_rating >= 1 AND communication_rating <= 5')
@Check('time_punctuality_rating >= 1 AND time_punctuality_rating <= 5')
@Check('response_time_rating >= 1 AND response_time_rating <= 5')
@Check('overall_rating >= 1 AND overall_rating <= 5')
export class TaskFeedback {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int', unique: true })
  task_id!: number;

  @Column({ type: 'int' })
  skill_rating!: number;

  @Column({ type: 'int' })
  communication_rating!: number;

  @Column({ type: 'int' })
  time_punctuality_rating!: number;

  @Column({ type: 'int' })
  response_time_rating!: number;

  @Column({ type: 'int' })
  overall_rating!: number;

  @Column({ type: 'text', nullable: true })
  comment?: string;

  @CreateDateColumn()
  created_at!: Date;

  // Relations
  @OneToOne('Task', (task: Task) => task.feedback, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_id' })
  task!: Task;
}
