import { AppDataSource } from '../config/database';
import { Player } from '../model/Player';
import { Parent } from '../model/Parent';
import { Invoice } from '../model/Invoice';
import { Payment } from '../model/Payment';

export class ParentProfileService {
    async getChildrenRoster(parentUsername: string) {
        const playerRepository = AppDataSource.getRepository(Player);
        const children = await playerRepository.find({
            where: { parent: { user: { username: parentUsername } } }
        });

        return children.map((player) => this.mapToPlayerDataResponse(player));
    }

    async getChildrenRosterById(parentId: number) {
        const playerRepository = AppDataSource.getRepository(Player);
        const children = await playerRepository.find({
            where: { parent: { id: parentId } }
        });

        return children.map((player) => this.mapToPlayerDataResponse(player));
    }

    async getParents(search: string | undefined, pageNumber: number = 0, pageSize: number = 20) {
        const parentRepository = AppDataSource.getRepository(Parent);
        const queryBuilder = parentRepository
            .createQueryBuilder('parent')
            .leftJoinAndSelect('parent.user', 'user');

        if (search && search.trim() !== '') {
            queryBuilder.where(
                'LOWER(parent.firstName) LIKE :search OR LOWER(parent.lastName) LIKE :search OR LOWER(parent.email) LIKE :search',
                { search: `%${search.toLowerCase()}%` }
            );
        }

        queryBuilder
            .orderBy('parent.registrationDate', 'DESC')
            .skip(pageNumber * pageSize)
            .take(pageSize);

        const [parents, total] = await queryBuilder.getManyAndCount();

        const content = parents.map((p) => this.mapToParentResponseDto(p));

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

    async getParentById(id: number) {
        const parentRepository = AppDataSource.getRepository(Parent);
        const parent = await parentRepository.findOne({
            where: { id },
            relations: ['user']
        });

        if (!parent) {
            throw new Error(`Parent profile not found for ID: ${id}`);
        }

        return this.mapToParentResponseDto(parent);
    }

    async getChildrenUnsettledInvoices(username: string) {
        const parentRepository = AppDataSource.getRepository(Parent);
        const parent = await parentRepository.findOne({
            where: { user: { username } }
        });

        if (!parent) {
            throw new Error(`Parent not found for username: ${username}`);
        }

        const invoices = await AppDataSource.getRepository(Invoice)
            .createQueryBuilder('invoice')
            .leftJoinAndSelect('invoice.account', 'account')
            .leftJoinAndSelect('account.player', 'player')
            .leftJoinAndSelect('player.parent', 'parent')
            .leftJoinAndSelect('invoice.term', 'term')
            .leftJoinAndSelect('term.session', 'session')
            .where('parent.id = :parentId', { parentId: parent.id })
            .andWhere("invoice.status IN ('UNSETTLED', 'PARTIALLY_PAID')")
            .getMany();

        const aggregateSum = invoices.reduce((sum, inv) => sum + parseFloat(inv.amountDue.toString()), 0);

        const mappedInvoices = invoices.map((inv) => this.mapToInvoiceResponse(inv));

        return {
            invoices: mappedInvoices,
            aggregateSum
        };
    }

    async getParentPaymentHistory(username: string) {
        const parentRepository = AppDataSource.getRepository(Parent);
        const parent = await parentRepository.findOne({
            where: { user: { username } }
        });

        if (!parent) {
            throw new Error(`Parent not found for username: ${username}`);
        }

        const payments = await AppDataSource.getRepository(Payment)
            .createQueryBuilder('payment')
            .leftJoinAndSelect('payment.account', 'account')
            .leftJoinAndSelect('account.player', 'player')
            .leftJoinAndSelect('player.parent', 'parent')
            .leftJoinAndSelect('payment.term', 'term')
            .leftJoinAndSelect('term.session', 'session')
            .where('parent.id = :parentId', { parentId: parent.id })
            .orderBy('payment.paymentDate', 'DESC')
            .getMany();

        return payments.map((p) => this.mapToPaymentHistoryResponse(p));
    }

    private mapToPlayerDataResponse(player: Player) {
        return {
            playerId: player.playerId,
            firstName: player.firstName,
            middleName: player.middleName,
            lastName: player.lastName,
            email: player.email,
            phone: player.phone,
            dateOfBirth: player.dateOfBirth,
            healthy: player.healthy,
            healthConcernDescription: player.healthConcernDescription,
            passportUrl: player.passportUrl || null
        };
    }

    private mapToParentResponseDto(parent: Parent) {
        return {
            id: Number(parent.id),
            username: parent.user ? parent.user.username : '',
            title: parent.title,
            firstName: parent.firstName,
            lastName: parent.lastName,
            phone: parent.phone,
            email: parent.email,
            address: parent.address,
            relationship: parent.relationship || null,
            occupation: parent.occupation || null,
            registrationDate: parent.registrationDate
        };
    }

    private mapToInvoiceResponse(invoice: Invoice) {
        const player = invoice.account ? invoice.account.player : null;
        const termName = invoice.term ? `${invoice.term.session.name} - ${invoice.term.name} TERM` : 'N/A';
        return {
            invoiceId: Number(invoice.id),
            accountId: invoice.account ? Number(invoice.account.id) : null,
            playerId: player ? player.playerId : null,
            playerName: player ? `${player.firstName} ${player.lastName}` : 'Unknown',
            termDisplayName: termName,
            totalAmount: parseFloat(invoice.totalAmount.toString()),
            amountDue: parseFloat(invoice.amountDue.toString()),
            category: invoice.category,
            description: invoice.description,
            status: invoice.status,
            createdAt: invoice.createdAt
        };
    }

    private mapToPaymentHistoryResponse(payment: Payment) {
        const player = payment.account ? payment.account.player : null;
        const termName = payment.term ? `${payment.term.session.name} - ${payment.term.name} TERM` : 'N/A';
        return {
            paymentId: Number(payment.id),
            amountPaid: parseFloat(payment.amountPaid.toString()),
            referenceNumber: payment.referenceNumber,
            paymentDate: payment.paymentDate,
            playerName: player ? `${player.firstName} ${player.lastName}` : 'Unknown',
            termDisplayName: termName,
            receiptUrl: `/finance/payments/${payment.id}/receipt`
        };
    }
}

export const parentProfileService = new ParentProfileService();
