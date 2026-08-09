import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Task } from './Task.ts';

@Entity('task_support_types')
export class SupportTypeOption {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 150, unique: true })
  name!: string;

  @Column({ type: 'tinyint', width: 1, default: () => '1' })
  is_active!: boolean;

  @Column({ type: 'int', default: () => '0' })
  sort_order!: number;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  @OneToMany(() => Task, task => task.supportTypeSetting)
  tasks!: Task[];
}