import { Entity, PrimaryGeneratedColumn, Column, Index, OneToMany } from "typeorm";
import { AnalyticsEntity } from "../analytics/analytics.entity.js";

@Entity("urls")
export class UrlEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  original_url!: string;

  @Column()
  @Index({ unique: true })
  url_code!: string;

  @OneToMany(() => AnalyticsEntity, (analytics) => analytics.url)
  analytics!: AnalyticsEntity[];
}
