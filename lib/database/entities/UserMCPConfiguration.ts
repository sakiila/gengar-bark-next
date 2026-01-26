import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('user_mcp_configurations')
@Index(['user_id', 'server_name'], { unique: true })
@Index(['user_id'])
@Index(['user_id', 'enabled'])
export class UserMCPConfiguration {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  user_id!: string;

  @Column({ type: 'varchar', length: 255 })
  server_name!: string;

  @Column({ type: 'varchar', length: 20 })
  transport_type!: 'http';

  @Column({ type: 'text' })
  url!: string;

  @Column({ type: 'text', nullable: true })
  encrypted_auth_token!: string | null;

  @Column({ type: 'boolean', default: true })
  enabled!: boolean;

  @Column({ type: 'jsonb', nullable: true })
  capabilities!: Record<string, any> | null;

  @Column({ type: 'varchar', length: 20 })
  verification_status!: 'verified' | 'unverified' | 'failed';

  @Column({ type: 'text', nullable: true })
  verification_error!: string | null;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at!: Date;
}
