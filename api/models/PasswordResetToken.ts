import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './User.ts';

@Entity('password_reset_tokens')
export class PasswordResetToken {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  @Index()
  user_id!: number;

  @Column({ type: 'varchar', length: 255, unique: true })
  @Index()
  token!: string;

  @Column({ type: 'timestamp' })
  expires_at!: Date;

  @Column({ type: 'boolean', default: false })
  used!: boolean;

  @CreateDateColumn()
  created_at!: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;
}