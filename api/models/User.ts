import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, OneToOne, JoinColumn, Index } from 'typeorm';
import { Role } from './Role.ts';
import { Task } from './Task.ts';
import { FreelancerLocation } from './FreelancerLocation.ts';
import { FreelancerSkill } from './FreelancerSkill.ts';
import { ActivityLog } from './ActivityLog.ts';
import { Notification } from './Notification.ts';
import { UserSession } from './UserSession.ts';
import { UserProfile } from './UserProfile.ts';
import { FreelancerBankAccount } from './FreelancerBankAccount.ts';

export enum UserStatus {
  AKTIF = 'Aktif',
  TIDAK_AKTIF = 'Tidak Aktif', 
  DISEKAT = 'Disekat'
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'int' })
  role_id!: number;

  @Column({ type: 'varchar', length: 255, unique: true, nullable: true })
  @Index()
  email?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  password_hash?: string;

  @Column({ 
    type: 'enum', 
    enum: UserStatus, 
    default: UserStatus.AKTIF 
  })
  @Index()
  status!: UserStatus;

  @Column({ type: 'text', nullable: true })
  ban_reason?: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone?: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  ic_number?: string;

  @Column({ type: 'int', default: 0 })
  experience!: number;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0.00 })
  rating!: number;

  @Column({ type: 'boolean', default: true })
  is_available!: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  profile_image?: string;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  // Relations
  @ManyToOne(() => Role, role => role.users)
  @JoinColumn({ name: 'role_id' })
  role!: Role;

  @OneToMany(() => Task, task => task.creator)
  created_tasks!: Task[];

  @OneToMany(() => Task, task => task.assignee)
  assigned_tasks!: Task[];

  @OneToMany(() => FreelancerLocation, location => location.user)
  locations!: FreelancerLocation[];

  @OneToMany(() => FreelancerSkill, skill => skill.user)
  skills!: FreelancerSkill[];

  @OneToMany(() => FreelancerLocation, location => location.user)
  freelancerLocations!: FreelancerLocation[];

  @OneToMany(() => FreelancerSkill, skill => skill.user)
  freelancerSkills!: FreelancerSkill[];

  @OneToMany(() => ActivityLog, log => log.user)
  activity_logs!: ActivityLog[];

  @OneToMany(() => Notification, notification => notification.user)
  notifications!: Notification[];

  @OneToMany(() => UserSession, session => session.user)
  sessions!: UserSession[];

  @OneToOne(() => UserProfile, profile => profile.user)
  profile?: UserProfile;

  @OneToMany(() => FreelancerBankAccount, bankAccount => bankAccount.user)
  bankAccounts!: FreelancerBankAccount[];
}