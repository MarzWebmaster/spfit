import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToOne, JoinColumn, Index } from 'typeorm';
import { User } from './User.ts';

@Entity('user_profiles')
export class UserProfile {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int', unique: true })
  @Index()
  user_id!: number;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone?: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  ic_number?: string;

  @Column({ type: 'text', nullable: true })
  address?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city?: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  postcode?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  state?: string;

  @Column({ type: 'int', default: 0 })
  experience!: number;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0.00 })
  rating!: number;

  @Column({ type: 'boolean', default: true })
  is_available!: boolean;

  @Column({ type: 'varchar', length: 120, nullable: true })
  bank_name?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  bank_account_number?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  payment_email?: string;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  @OneToOne(() => User, user => user.profile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;
}