import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('asset_model_intel')
export class AssetModelIntel {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  model_raw?: string | null;

  @Column({ type: 'varchar', length: 255 })
  @Index('uq_asset_model_intel_model_norm', { unique: true })
  model_norm!: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  @Index('idx_asset_model_intel_serial_norm')
  serial_norm?: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  detected_brand?: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  detected_category?: string | null;

  @Column({ type: 'int', nullable: true })
  @Index('idx_asset_model_intel_brand_id')
  detected_brand_id?: number | null;

  @Column({ type: 'int', nullable: true })
  @Index('idx_asset_model_intel_category_id')
  detected_category_id?: number | null;

  @Column({ type: 'decimal', precision: 5, scale: 4, default: 0 })
  confidence_brand!: number;

  @Column({ type: 'decimal', precision: 5, scale: 4, default: 0 })
  confidence_category!: number;

  @Column({ type: 'decimal', precision: 5, scale: 4, default: 0 })
  confidence_overall!: number;

  @Column({ type: 'varchar', length: 10, nullable: true })
  language?: string | null;

  @Column({ type: 'json', nullable: true })
  sources_json?: any;

  @Column({ type: 'json', nullable: true })
  evidence_json?: any;

  @Column({ type: 'int', default: 1 })
  hit_count!: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  last_seen_at!: Date;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}

