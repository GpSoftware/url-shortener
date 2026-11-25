import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  JoinColumn,
  ManyToOne,
  type Relation,
} from "typeorm";
import { UrlEntity } from "../../modules/urls/url.entity.js";

@Entity("analytics")
export class AnalyticsEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: 'inet' })
  ip_address!: string;

  @Column({ type: 'jsonb', nullable: true })
  user_agent_details!: Record<string, string>;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  clicked_at!: Date;

  @ManyToOne(() => UrlEntity, (url) => url.analytics)
  @JoinColumn({ name: "url_id" })
  url!: Relation<UrlEntity>;
}
