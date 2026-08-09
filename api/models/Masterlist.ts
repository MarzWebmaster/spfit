import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index, OneToMany } from 'typeorm';
import { Project } from './Project.ts';
import { User } from './User.ts';
import { Asset } from './Asset.ts';

export enum MasterlistStatus {
  AKTIF = 'Aktif',
  TIDAK_AKTIF = 'Tidak Aktif'
}

@Entity('masterlists')
export class Masterlist {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  @Index()
  project_id!: number;

  @Column({ type: 'varchar', length: 50 })
  code!: string;

  @Column({ type: 'varchar', length: 255 })
  @Index()
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 20, default: MasterlistStatus.AKTIF })
  @Index()
  status!: MasterlistStatus;

  @Column({ type: 'json', nullable: true })
  custom_fields_definition?: Record<string, any>;

  @Column({ type: 'json', nullable: true })
  work_links?: Array<{ title: string; url: string }>;

  @Column({ type: 'json', nullable: true })
  work_documents?: Array<{
    title: string;
    file_name: string;
    file_path: string;
    file_type?: string;
    file_size?: number;
    uploaded_at: string;
  }>;

  @Column({ type: 'int', nullable: true })
  @Index()
  created_by?: number;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  @ManyToOne(() => Project, project => project.masterlists, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project!: Project;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  creator?: User;

  @OneToMany(() => Asset, asset => asset.masterlist)
  assets!: Asset[];
}
