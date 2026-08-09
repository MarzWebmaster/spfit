import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Role } from './Role.ts';

@Entity('role_permissions')
@Index(['role_id', 'permission'], { unique: true })
export class RolePermission {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  role_id!: number;

  @Column({ type: 'varchar', length: 100 })
  permission!: string;

  @CreateDateColumn()
  created_at!: Date;

  // Relations
  @ManyToOne(() => Role, role => role.permissions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'role_id' })
  role!: Role;
}