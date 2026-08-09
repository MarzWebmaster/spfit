
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './User.js';

@Entity('audit_trails')
export class AuditTrail {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int', name: 'user_id', nullable: true })
  user_id!: number | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'varchar', length: 50, name: 'action_type' })
  action_type!: string; // CREATE, UPDATE, DELETE, VIEW

  @Column({ type: 'varchar', length: 100, name: 'table_name' })
  table_name!: string;

  @Column({ type: 'int', name: 'record_id', nullable: true })
  record_id!: number;

  @Column({ type: 'json', name: 'old_values', nullable: true })
  old_values!: any;

  @Column({ type: 'json', name: 'new_values', nullable: true })
  new_values!: any;

  @Column({ type: 'varchar', length: 45, name: 'ip_address', nullable: true })
  ip_address!: string;

  @Column({ type: 'varchar', length: 255, name: 'user_agent', nullable: true })
  user_agent!: string;

  @Column({ type: 'text', nullable: true })
  description!: string;

  @CreateDateColumn()
  timestamp!: Date;
}
