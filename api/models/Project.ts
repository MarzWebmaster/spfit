import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index, OneToMany } from 'typeorm';
import { User } from './User.ts';
import { Task } from './Task.ts';
import { MainCon } from './MainCon.ts';
import { Masterlist } from './Masterlist.ts';

export enum ProjectStatus {
  AKTIF = 'Aktif',
  SELESAI = 'Selesai',
  DIBATALKAN = 'Dibatalkan'
}

@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 50, unique: true })
  @Index()
  code!: string;

  @Column({ type: 'varchar', length: 255 })
  @Index()
  name!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  client_name?: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 20, default: ProjectStatus.AKTIF })
  @Index()
  status!: ProjectStatus;

  @Column({ type: 'date', nullable: true })
  start_date?: Date;

  @Column({ type: 'date', nullable: true })
  end_date?: Date;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  budget?: number;

  @Column({ type: 'int', nullable: true })
  @Index()
  main_con_id?: number;

  @Column({ type: 'int', nullable: true })
  @Index()
  created_by?: number;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  creator?: User;

  @ManyToOne(() => MainCon, { nullable: true })
  @JoinColumn({ name: 'main_con_id' })
  mainCon?: MainCon;

  @OneToMany(() => Task, task => task.project)
  tasks!: Task[];

  @OneToMany(() => Masterlist, masterlist => masterlist.project)
  masterlists!: Masterlist[];
}
