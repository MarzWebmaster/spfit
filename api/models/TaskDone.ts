import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index, OneToMany } from 'typeorm';
import type { Task } from './Task.ts';
import { User } from './User.ts';
import { TaskDoneFile } from './TaskDoneFile.ts';

@Entity('task_done')
@Index(['task_id', 'submitted_at'])
export class TaskDone {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  @Index()
  task_id!: number;

  @Column({ type: 'int' })
  @Index()
  freelancer_id!: number;

  @Column({ type: 'date', nullable: true })
  service_start_date?: Date;

  @Column({ type: 'text', nullable: true })
  action_taken?: string;

  @Column({ type: 'text', nullable: true })
  remarks?: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  support_pdf_url?: string;

  @CreateDateColumn()
  submitted_at!: Date;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  // Relations
  @ManyToOne('Task')
  @JoinColumn({ name: 'task_id' })
  task!: Task;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'freelancer_id' })
  freelancer!: User;

  @OneToMany(() => TaskDoneFile, file => file.taskDone)
  files!: TaskDoneFile[];
}
