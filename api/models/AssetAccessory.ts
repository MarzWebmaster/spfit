import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index, OneToOne } from 'typeorm';
import { Asset } from './Asset.ts';

export type AssetAccessoryType = 'monitor' | 'keyboard' | 'mouse' | 'other';

@Entity('asset_accessories')
@Index('uq_asset_accessories_asset_accessory', ['asset_id', 'accessory_asset_id'], { unique: true })
@Index('uq_asset_accessories_accessory', ['accessory_asset_id'], { unique: true })
export class AssetAccessory {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  @Index()
  asset_id!: number;

  @Column({ type: 'int' })
  @Index()
  accessory_asset_id!: number;

  @Column({ type: 'varchar', length: 30 })
  @Index()
  accessory_type!: AssetAccessoryType;

  @Column({ type: 'varchar', length: 255, nullable: true })
  notes?: string | null;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  @ManyToOne('Asset', 'accessories', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'asset_id' })
  asset!: Asset;

  @OneToOne('Asset', 'parentAccessoryLink', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'accessory_asset_id' })
  accessoryAsset!: Asset;
}

