import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Role } from './Role.ts';

@Entity('role_types')
export class RoleType {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 50, unique: true })
  name!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  description!: string;

  @OneToMany(() => Role, role => role.roleType)
  roles!: Role[];
}
