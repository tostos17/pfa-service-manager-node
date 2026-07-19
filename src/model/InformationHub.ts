import { Entity, PrimaryGeneratedColumn, Column, BeforeInsert, BeforeUpdate } from 'typeorm';

export enum AnnouncementType {
    UPCOMING_MATCH = 'UPCOMING_MATCH',
    RESUMPTION = 'RESUMPTION',
    SUMMER_CAMP = 'SUMMER_CAMP',
    GENERAL_NOTICE = 'GENERAL_NOTICE'
}

export enum PublicationStatus {
    DRAFT = 'DRAFT',
    PUBLISHED = 'PUBLISHED',
    ARCHIVED = 'ARCHIVED'
}

@Entity('information_hub')
export class InformationHub {
    @PrimaryGeneratedColumn({ type: 'bigint' })
    id!: number;

    @Column({ nullable: false })
    title!: string;

    @Column({ type: 'text', nullable: true })
    summary?: string;

    @Column({ type: 'text', nullable: false })
    content!: string;

    @Column({ name: 'info_type', type: 'varchar', nullable: false })
    infoType!: AnnouncementType;

    @Column({ type: 'varchar', default: 'DRAFT' })
    status!: PublicationStatus;

    @Column({ name: 'cover_image_url', length: 512, nullable: true })
    coverImageUrl?: string;

    @Column({ name: 'publish_at', type: 'timestamp with time zone', nullable: false })
    publishAt!: Date;

    @Column({ name: 'expires_at', type: 'timestamp with time zone', nullable: true })
    expiresAt?: Date;

    @Column({ name: 'created_by_admin_id', type: 'bigint', nullable: false })
    createdByAdminId!: number;

    @Column({ type: 'jsonb', nullable: true })
    attributes!: Record<string, unknown>;

    @Column({ name: 'created_at', type: 'timestamp with time zone', nullable: false })
    createdAt!: Date;

    @Column({ name: 'updated_at', type: 'timestamp with time zone', nullable: false })
    updatedAt!: Date;

    @BeforeInsert()
    onCreate() {
        this.createdAt = new Date();
        this.updatedAt = new Date();
        if (!this.status) this.status = PublicationStatus.DRAFT;
    }

    @BeforeUpdate()
    onUpdate() {
        this.updatedAt = new Date();
    }
}
