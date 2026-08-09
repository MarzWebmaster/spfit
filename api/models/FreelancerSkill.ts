import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from './User.ts';

@Entity('freelancer_skills')
export class FreelancerSkill {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  @Index()
  user_id!: number;

  @Column({ type: 'varchar', length: 100 })
  @Index()
  skill!: string;

  @CreateDateColumn()
  created_at!: Date;

  // Relations
  @ManyToOne(() => User, user => user.skills, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;
}