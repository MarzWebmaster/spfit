import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from './User.ts';

@Entity('freelancer_bank_accounts')
@Index(['user_id'])
@Index(['user_id', 'is_default'])
export class FreelancerBankAccount {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  user_id!: number;

  @Column({ type: 'varchar', length: 120 })
  bank_name!: string;

  @Column({ type: 'varchar', length: 120 })
  account_holder_name!: string;

  @Column({ type: 'varchar', length: 50 })
  account_number!: string;

  @Column({ type: 'boolean', default: false })
  is_default!: boolean;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  @ManyToOne(() => User, user => user.bankAccounts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;
}