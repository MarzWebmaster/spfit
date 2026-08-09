import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from './User.ts';

@Entity('user_sessions')
export class UserSession {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  user_id!: number;

  @Column({ type: 'varchar', length: 500, unique: true })
  @Index()
  token_hash!: string;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ip_address?: string;

  @Column({ type: 'text', nullable: true })
  user_agent?: string;

  @Column({ type: 'timestamp' })
  expires_at!: Date;

  @Column({ type: 'boolean', default: true })
  @Index()
  is_active!: boolean;

  @Column({ type: 'timestamp', nullable: true })
  last_activity?: Date;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  // Relations
  @ManyToOne(() => User, user => user.sessions)
  @JoinColumn({ name: 'user_id' })
  user!: User;
}