import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Asset } from './Asset';
import { User } from './User';

@Entity('asset_pairing_history')
export class AssetPairingHistory {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  @Index('idx_pairing_history_parent')
  parent_asset_id!: number;

  @Column({ type: 'int' })
  @Index('idx_pairing_history_accessory')
  accessory_asset_id!: number;

  @Column({ type: 'enum', enum: ['PAIRED', 'UNPAIRED'] })
  @Index('idx_pairing_history_action')
  action!: 'PAIRED' | 'UNPAIRED';

  @Column({ type: 'int', nullable: true })
  action_by?: number;

  @CreateDateColumn()
  created_at!: Date;

  @ManyToOne(() => Asset, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parent_asset_id' })
  parentAsset?: Asset;

  @ManyToOne(() => Asset, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'accessory_asset_id' })
  accessoryAsset?: Asset;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'action_by' })
  actionByUser?: User;
}
