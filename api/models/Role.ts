import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './User.ts';
import { RolePermission } from './RolePermission.ts';
import { RoleType } from './RoleType.ts';

@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 50, unique: true })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'int', name: 'role_type_id', nullable: true })
  role_type_id!: number;

  @ManyToOne(() => RoleType, roleType => roleType.roles)
  @JoinColumn({ name: 'role_type_id' })
  roleType!: RoleType;

  @Column({ type: 'boolean', default: false })
  is_system_role!: boolean;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  // Relations
  @OneToMany(() => User, user => user.role)
  users!: User[];

  @OneToMany(() => RolePermission, rolePermission => rolePermission.role)
  permissions!: RolePermission[];
}