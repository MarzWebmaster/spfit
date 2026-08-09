import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Asset } from './Asset.ts';
import { User } from './User.ts';

@Entity('asset_update_logs')
export class AssetUpdateLog {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  @Index()
  asset_id!: number;

  @Column({ type: 'int', nullable: true })
  @Index()
  user_id?: number | null;

  @Column({ type: 'varchar', length: 30 })
  @Index()
  action_type!: string;

  @Column({ type: 'json', nullable: true })
  field_changes?: Record<string, { old: any; new: any }> | null;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ip_address?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  user_agent?: string;

  @CreateDateColumn()
  created_at!: Date;

  @ManyToOne(() => Asset, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'asset_id' })
  asset!: Asset;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user?: User;
}
