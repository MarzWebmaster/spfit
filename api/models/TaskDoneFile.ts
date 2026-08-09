import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { TaskDone } from './TaskDone.ts';

@Entity('task_done_files')
@Index(['task_done_id', 'created_at'])
export class TaskDoneFile {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  @Index()
  task_done_id!: number;

  @Column({ type: 'varchar', length: 500 })
  file_url!: string;

  @Column({ type: 'varchar', length: 255 })
  original_name!: string;

  @CreateDateColumn()
  created_at!: Date;

  @ManyToOne(() => TaskDone, taskDone => taskDone.files, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_done_id' })
  taskDone!: TaskDone;
}
