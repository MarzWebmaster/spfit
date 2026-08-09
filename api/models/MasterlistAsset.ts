import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Masterlist } from './Masterlist.ts';
import { Asset } from './Asset.ts';

@Entity('masterlist_assets')
export class MasterlistAsset {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  @Index()
  masterlist_id!: number;

  @Column({ type: 'int' })
  @Index()
  asset_id!: number;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  @ManyToOne(() => Masterlist, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'masterlist_id' })
  masterlist!: Masterlist;

  @ManyToOne(() => Asset, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'asset_id' })
  asset!: Asset;
}

