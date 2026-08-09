import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from './User.ts';

export type ApiKeyStatus = 'active' | 'revoked';

@Entity('api_keys')
export class ApiKey {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'varchar', length: 64, unique: true })
  key_hash!: string;

  @Column({ type: 'varchar', length: 12 })
  key_prefix!: string;

  @Column({ type: 'enum', enum: ['active', 'revoked'], default: 'active' })
  @Index()
  status!: ApiKeyStatus;

  @Column({ type: 'int', nullable: true })
  @Index()
  created_by?: number | null;

  @Column({ type: 'timestamp', nullable: true })
  last_used_at?: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  expires_at?: Date | null;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  @ManyToOne('User', { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  creator?: User | null;
}
