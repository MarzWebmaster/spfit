import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, OneToOne, JoinColumn } from 'typeorm';
import type { Asset } from './Asset.ts';

@Entity('asset_laptops')
export class AssetLaptopDetails {
  @PrimaryColumn({ type: 'int' })
  asset_id!: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  mouse?: string | null;

  @Column({ type: 'text', nullable: true })
  other_hardware?: string | null;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  @OneToOne('Asset', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'asset_id' })
  asset!: Asset;
}

