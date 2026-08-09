import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('task_equipment_codes')
export class EquipmentCode {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 100, unique: true })
  code!: string;

  @Column({ type: 'tinyint', width: 1, default: () => '1' })
  is_active!: boolean;

  @Column({ type: 'int', default: () => '0' })
  sort_order!: number;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}