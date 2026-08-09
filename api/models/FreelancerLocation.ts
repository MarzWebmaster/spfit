import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from './User.ts';

@Entity('freelancer_locations')
export class FreelancerLocation {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  @Index()
  user_id!: number;

  @Column({ type: 'varchar', length: 100 })
  district!: string;

  @Column({ type: 'varchar', length: 50 })
  @Index()
  state!: string;

  @CreateDateColumn()
  created_at!: Date;

  // Relations
  @ManyToOne(() => User, user => user.locations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;
}