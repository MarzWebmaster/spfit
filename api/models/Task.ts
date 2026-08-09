import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, OneToOne, JoinColumn, Index } from 'typeorm';
import { User } from './User.ts';
import { TaskAttachment } from './TaskAttachment.ts';
import { TaskLink } from './TaskLink.ts';
import { TaskReport } from './TaskReport.ts';
import { TaskFeedback } from './TaskFeedback.ts';
import { Notification } from './Notification.ts';
import { MainCon } from './MainCon.ts';
import { TaskPart } from './TaskPart.ts';
import { TaskStatusOption } from './TaskStatusOption.ts';
import { SupportTypeOption } from './SupportTypeOption.ts';
import { Project } from './Project.ts';
import { TaskReminder } from './TaskReminder.ts';

export enum TaskStatus {
  BARU = 'Baru',
  TAWARAN_DIHANTAR = 'Tawaran Dihantar',
  TELAH_DIAMBIL = 'Telah Diambil',
  SELESAI = 'Selesai',
  BORANG_DISEMAK_PEMBAYARAN_TERTUNGGAK = 'Borang Disemak & Pembayaran Tertunggak',
  TELAH_DIBAYAR = 'Telah Dibayar',
  DIBATALKAN = 'Dibatalkan',
  SELESAI_PENUH = 'Selesai Penuh'
}

@Entity('tasks')
export class Task {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  log_number!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'varchar', length: 100 })
  @Index()
  support_type!: string;

  @Column({ type: 'int', nullable: true })
  @Index()
  support_type_id?: number;

  @Column({ type: 'varchar', length: 255 })
  client_location!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  bandar_daerah?: string;

  @Column({ type: 'varchar', length: 50 })
  @Index()
  state!: string;

  @Column({ type: 'date' })
  deadline!: Date;

  @Column({ type: 'time', nullable: true })
  deadline_time?: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  offer_price!: number;

  @Column({ type: 'int', nullable: true })
  @Index()
  status_id?: number;

  @Column({ type: 'int' })
  @Index()
  created_by!: number;

  @Column({ type: 'int', nullable: true })
  @Index()
  assigned_to?: number;

  @Column({ type: 'text', nullable: true })
  remarks?: string;

  @Column({ type: 'date', nullable: true })
  payment_date?: Date;

  // New Fields
  @Column({ type: 'int', nullable: true })
  main_con_id?: number;

  @Column({ type: 'int', nullable: true })
  @Index()
  project_id?: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  pic_name?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  pic_phone?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  client_name?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  asset_tag_id?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  asset_brand?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  asset_model?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  asset_serial_number?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  branch_name?: string;

  @Column({ type: 'json', nullable: true })
  equipment_types_id?: number[];

  @Column({ type: 'date', nullable: true })
  received_date?: Date;

  @Column({ type: 'time', nullable: true })
  received_time?: string;

  @Column({ type: 'date', nullable: true })
  irt_date?: Date;

  @Column({ type: 'time', nullable: true })
  irt_time?: string;

  @Column({ type: 'date', nullable: true })
  service_start_date?: Date;

  @Column({ type: 'time', nullable: true })
  service_start_time?: string;



    @Column({ type: 'date', nullable: true })
  service_stop_date?: Date;

  @Column({ type: 'time', nullable: true })
  service_stop_time?: string;

  @Column({ type: 'date', nullable: true })
  requirement_date?: Date;

  @Column({ type: 'time', nullable: true })
  requirement_time?: string;

  @Column({ type: 'datetime', nullable: true })
  arrival_confirmed_at?: Date;







  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  arrival_latitude?: number;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  arrival_longitude?: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  arrival_accuracy_meters?: number;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  // Relations
  @ManyToOne(() => User, user => user.created_tasks)
  @JoinColumn({ name: 'created_by' })
  creator!: User;

  @ManyToOne(() => User, user => user.assigned_tasks, { nullable: true })
  @JoinColumn({ name: 'assigned_to' })
  assignee?: User;

  @ManyToOne(() => MainCon, mainCon => mainCon.tasks, { nullable: true })
  @JoinColumn({ name: 'main_con_id' })
  mainCon?: MainCon;

  @ManyToOne(() => Project, project => project.tasks, { nullable: true })
  @JoinColumn({ name: 'project_id' })
  project?: Project;

  @ManyToOne(() => TaskStatusOption, setting => setting.tasks, { nullable: true })
  @JoinColumn({ name: 'status_id' })
  statusSetting?: TaskStatusOption;

  @ManyToOne(() => SupportTypeOption, setting => setting.tasks, { nullable: true })
  @JoinColumn({ name: 'support_type_id' })
  supportTypeSetting?: SupportTypeOption;

  @OneToMany(() => TaskAttachment, attachment => attachment.task)
  attachments!: TaskAttachment[];

  @OneToMany(() => TaskLink, link => link.task)
  links!: TaskLink[];

  @OneToMany(() => TaskPart, part => part.task)
  parts!: TaskPart[];

  @OneToOne(() => TaskReport, report => report.task)
  report?: TaskReport;

  @OneToOne(() => TaskFeedback, feedback => feedback.task)
  feedback?: TaskFeedback;

  @OneToMany(() => Notification, notification => notification.task)
  notifications!: Notification[];

  @OneToMany(() => TaskReminder, reminder => reminder.task)
  reminders!: TaskReminder[];
}
