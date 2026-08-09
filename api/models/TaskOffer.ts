import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import type { Task } from './Task.ts';
import { User } from './User.ts';

@Entity('task_offers')
export class TaskOffer {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  @Index()
  task_id!: number;

  @Column({ type: 'int' })
  @Index()
  freelancer_id!: number;

  @Column({ type: 'varchar', length: 255, unique: true })
  @Index()
  token!: string;

  @Column({ type: 'enum', enum: ['pending', 'accepted', 'rejected', 'expired'], default: 'pending' })
  @Index()
  status!: 'pending' | 'accepted' | 'rejected' | 'expired';

  @Column({ type: 'datetime', nullable: true })
  responded_at?: Date;

  @Column({ type: 'datetime' })
  expires_at!: Date;

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
