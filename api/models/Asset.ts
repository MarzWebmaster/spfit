import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, OneToOne, JoinColumn, Index } from 'typeorm';
import { Masterlist } from './Masterlist.ts';
import { User } from './User.ts';
import { AssetCategoryOption } from './AssetCategoryOption.ts';
import { AssetBrandOption } from './AssetBrandOption.ts';
import { AssetUser } from './AssetUser.ts';
import type { AssetAccessory } from './AssetAccessory.ts';
import type { AssetAttachment } from './AssetAttachment.ts';

export enum AssetStatus {
  AKTIF = 'Aktif',
  TIDAK_AKTIF = 'Tidak Aktif',
  ROSAK = 'Rosak',
  LUPUS = 'Lupus'
}

@Entity('assets')
export class Asset {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  @Index()
  masterlist_id!: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  @Index()
  asset_tag?: string;

  @Column({ type: 'varchar', length: 255 })
  @Index()
  name!: string;

  @Column({ type: 'int', nullable: true })
  @Index()
  category_id?: number | null;

  @Column({ type: 'int', nullable: true })
  @Index()
  brand_id?: number | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  model?: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  serial_number?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  group?: string;

  @Column({ type: 'varchar', length: 30, default: AssetStatus.AKTIF })
  @Index()
  status!: AssetStatus;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'json', nullable: true })
  custom_fields_values?: Record<string, any>;

  @Column({ type: 'int', nullable: true })
  @Index()
  created_by?: number;

  @Column({ type: 'int', nullable: true })
  @Index()
  updated_by?: number | null;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  @ManyToOne(() => Masterlist, masterlist => masterlist.assets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'masterlist_id' })
  masterlist!: Masterlist;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  creator?: User;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'updated_by' })
  updater?: User;

  @ManyToOne(() => AssetCategoryOption, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'category_id' })
  categoryOption?: AssetCategoryOption;

  @ManyToOne(() => AssetBrandOption, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'brand_id' })
  brandOption?: AssetBrandOption;

  @OneToMany(() => AssetUser, assetUser => assetUser.asset, { cascade: true, onDelete: 'CASCADE' })
  assetUsers?: AssetUser[];

  @OneToMany('AssetAccessory', (accessory: AssetAccessory) => (accessory as any).asset, { cascade: true, onDelete: 'CASCADE' })
  accessories?: AssetAccessory[];

  @OneToOne('AssetAccessory', 'accessoryAsset')
  parentAccessoryLink?: AssetAccessory;

  @OneToMany('AssetAttachment', (attachment: AssetAttachment) => (attachment as any).asset, { cascade: true, onDelete: 'CASCADE' })
  attachments?: AssetAttachment[];
}
