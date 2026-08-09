import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export type WhatsAppStatus = 'queued' | 'sending' | 'sent' | 'delivered' | 'failed' | 'expired';

@Entity('whatsapp_messages')
export class WhatsAppMessage {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 30 })
  to!: string;

  @Column({ type: 'text', nullable: true })
  message!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  template_name!: string | null;

  @Column({ type: 'json', nullable: true })
  template_params!: any;

  @Column({ type: 'enum', enum: ['queued','sending','sent','delivered','failed','expired'], default: 'queued' })
  status!: WhatsAppStatus;

  @Column({ type: 'int', default: 0 })
  attempts!: number;

  @Column({ type: 'text', nullable: true })
  last_error!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  provider_message_id!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  correlation_id!: string | null;

  @CreateDateColumn({ name: 'queued_at' })
  queued_at!: Date;

  @Column({ type: 'datetime', nullable: true })
  sent_at!: Date | null;

  @Column({ type: 'datetime', nullable: true })
  delivered_at!: Date | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;
}
