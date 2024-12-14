import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('channel')
export class Channel {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ type: "varchar", unique: true })
  channel_id!: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at!: Date;

  @Column({ type: "boolean", default: false })
  is_archived!: boolean;

  @Column({ type: "varchar" })
  user_id!: string;

  @Column({ type: "boolean", default: false })
  is_im!: boolean;

  @Column({ type: "varchar" })
  context_team_id!: string;

  @Column({ type: "boolean", default: false })
  is_user_deleted!: boolean;
}
