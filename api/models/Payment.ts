import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Task } from './Task.ts';
import { TaskDone } from './TaskDone.ts';
import { User } from './User.ts';

export enum PaymentStatus {
  MENUNGGU_KELULUSAN = 'Menunggu Kelulusan',
  DILULUSKAN = 'Diluluskan',
  TELAH_DIBAYAR = 'Telah Dibayar'
}

@Entity('payments')
@Index(['status', 'created_at'])
export class Payment {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  @Index()
  task_id!: number;

  @Column({ type: 'int', unique: true })
  @Index()
  task_done_id!: number;

  @Column({ type: 'int' })
  @Index()
  freelancer_id!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount!: number;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.MENUNGGU_KELULUSAN
  })
  status!: PaymentStatus;

  @Column({ type: 'text', nullable: true })
  remarks?: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  recipient_name?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  recipient_account_number?: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  recipient_bank_name?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  recipient_email?: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  payment_reference?: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  payment_slip_url?: string;

  @Column({ type: 'int', nullable: true })
  approved_by?: number;

  @Column({ type: 'datetime', nullable: true })
  approved_at?: Date;

  @Column({ type: 'int', nullable: true })
  paid_by?: number;

  @Column({ type: 'datetime', nullable: true })
  paid_at?: Date;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  @ManyToOne(() => Task)
  @JoinColumn({ name: 'task_id' })
  task!: Task;

  @ManyToOne(() => TaskDone)
  @JoinColumn({ name: 'task_done_id' })
  taskDone!: TaskDone;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'freelancer_id' })
  freelancer!: User;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'approved_by' })
  approver?: User;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'paid_by' })
  payer?: User;
}
