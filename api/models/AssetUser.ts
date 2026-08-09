import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Asset } from './Asset.ts';

@Entity('asset_users')
export class AssetUser {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  @Index()
  asset_id!: number;

  @Column({ type: 'varchar', length: 255 })
  @Index()
  user_name!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  @Index()
  position?: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  @Index()
  department?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  floor?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  building?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  location?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  @Index()
  branch?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  state?: string;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  @ManyToOne(() => Asset, asset => asset.assetUsers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'asset_id' })
  asset!: Asset;
}
