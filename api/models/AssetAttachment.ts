import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import type { Asset } from './Asset.ts';

@Entity('asset_attachments')
export class AssetAttachment {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  @Index()
  asset_id!: number;

  @Column({ type: 'varchar', length: 255 })
  file_name!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  display_name?: string;

  @Column({ type: 'varchar', length: 500 })
  file_path!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  file_type?: string;

  @Column({ type: 'int', nullable: true })
  file_size?: number;

  @CreateDateColumn()
  created_at!: Date;

  // Relations
  @ManyToOne('Asset', (asset: Asset) => asset.attachments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'asset_id' })
  asset!: Asset;
}