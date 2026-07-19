import { AppDataSource } from '../config/database';
import { InformationHub, AnnouncementType, PublicationStatus } from '../model/InformationHub';

export class InformationHubService {
    async createAnnouncement(request: any, adminId: number) {
        this.validateMetadataAttributes(request.infoType as AnnouncementType, request.attributes);

        const infoHubRepository = AppDataSource.getRepository(InformationHub);
        const entry = infoHubRepository.create({
            title: request.title,
            summary: request.summary,
            content: request.content,
            infoType: request.infoType as AnnouncementType,
            status: PublicationStatus.DRAFT,
            coverImageUrl: request.coverImageUrl,
            publishAt: new Date(request.publishAt),
            expiresAt: request.expiresAt ? new Date(request.expiresAt) : undefined,
            createdByAdminId: adminId,
            attributes: request.attributes || {}
        });

        await infoHubRepository.save(entry);
        return this.mapToResponse(entry);
    }

    async updateStatus(id: number, status: PublicationStatus) {
        const infoHubRepository = AppDataSource.getRepository(InformationHub);
        const entity = await infoHubRepository.findOne({ where: { id } });
        if (!entity) {
            throw new Error(`Announcement context not found with identifier ID: ${id}`);
        }
        entity.status = status;
        await infoHubRepository.save(entity);
        return this.mapToResponse(entity);
    }

    async getPublicFeed(type: AnnouncementType | undefined, pageNumber: number = 0, pageSize: number = 10) {
        const infoHubRepository = AppDataSource.getRepository(InformationHub);
        const now = new Date();

        const queryBuilder = infoHubRepository
            .createQueryBuilder('i')
            .where("i.status = 'PUBLISHED'")
            .andWhere('i.publishAt <= :now', { now })
            .andWhere('(i.expiresAt IS NULL OR i.expiresAt > :now)', { now });

        if (type) {
            queryBuilder.andWhere('i.infoType = :type', { type });
        }

        queryBuilder
            .orderBy('i.publishAt', 'DESC')
            .skip(pageNumber * pageSize)
            .take(pageSize);

        const [feed, total] = await queryBuilder.getManyAndCount();

        const content = feed.map((item) => this.mapToResponse(item));
        return {
            content,
            pageable: {
                pageNumber,
                pageSize
            },
            totalElements: total,
            totalPages: Math.ceil(total / pageSize)
        };
    }

    async getAdminControlListing(type: AnnouncementType | undefined, status: PublicationStatus | undefined, pageNumber: number = 0, pageSize: number = 15) {
        const infoHubRepository = AppDataSource.getRepository(InformationHub);
        const queryBuilder = infoHubRepository.createQueryBuilder('i');

        if (type && status) {
            queryBuilder.where('i.infoType = :type AND i.status = :status', { type, status });
        }

        queryBuilder
            .orderBy('i.createdAt', 'DESC')
            .skip(pageNumber * pageSize)
            .take(pageSize);

        const [data, total] = await queryBuilder.getManyAndCount();

        const content = data.map((item) => this.mapToResponse(item));
        return {
            content,
            pageable: {
                pageNumber,
                pageSize
            },
            totalElements: total,
            totalPages: Math.ceil(total / pageSize)
        };
    }

    async deleteAnnouncement(id: number) {
        const infoHubRepository = AppDataSource.getRepository(InformationHub);
        const exists = await infoHubRepository.findOne({ where: { id } });
        if (!exists) {
            throw new Error(`Resource row doesn't exist under lookup code: ${id}`);
        }
        await infoHubRepository.remove(exists);
    }

    private validateMetadataAttributes(type: AnnouncementType, attrs: any) {
        if (!attrs) return;
        switch (type) {
            case AnnouncementType.UPCOMING_MATCH: {
                if (!attrs.opponent || !attrs.venue || !attrs.kickoffTime) {
                    throw new Error('Missing parameter metrics specs for structural matching components.');
                }
                break;
            }
            case AnnouncementType.RESUMPTION: {
                if (!attrs.openingDate || !attrs.targetTermId) {
                    throw new Error('Resumption statements require structural alignment terms.');
                }
                break;
            }
            case AnnouncementType.SUMMER_CAMP: {
                if (!attrs.registrationFee || !attrs.deadlineDate) {
                    throw new Error('Summer camps tracking configurations require financial registration bounding elements.');
                }
                break;
            }
        }
    }

    private mapToResponse(model: InformationHub) {
        return {
            id: Number(model.id),
            title: model.title,
            summary: model.summary || null,
            content: model.content,
            infoType: model.infoType,
            status: model.status,
            coverImageUrl: model.coverImageUrl || null,
            publishAt: model.publishAt,
            expiresAt: model.expiresAt || null,
            attributes: model.attributes,
            createdAt: model.createdAt
        };
    }
}

export const informationHubService = new InformationHubService();
