import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('build_record')
export class BuildRecord {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at!: Date;

  @Column({ type: 'text', nullable: true })
  text!: string;

  @Column({ type: 'varchar', nullable: true })
  result!: string;

  @Column({ type: 'varchar', nullable: true })
  repository!: string;

  @Column({ type: 'varchar', nullable: true })
  branch!: string;

  @Column({ type: 'varchar' })
  email!: string;

  @Column({ type: 'varchar' })
  user_id!: string;

  @Column({ type: 'varchar', nullable: true })
  sequence!: string;

  @Column({ type: 'varchar', nullable: true })
  duration!: string;

}
