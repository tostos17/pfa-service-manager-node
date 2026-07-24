import { AppDataSource } from '../config/database';
import { Player } from '../model/Player';
import { Parent } from '../model/Parent';
import { Match } from '../model/Match';
import { TrainingSession } from '../model/TrainingSession';
import { Invoice } from '../model/Invoice';
import { Payment } from '../model/Payment';
import { AppError } from '../error/AppError';

export class PortalService {
    // 1. Get Player Dashboard Data
    async getPlayerDashboard(userId: number) {
        const playerRepository = AppDataSource.getRepository(Player);
        const matchRepository = AppDataSource.getRepository(Match);
        const trainingRepository = AppDataSource.getRepository(TrainingSession);

        const player = await playerRepository.findOne({
            where: { id: userId },
            relations: ['playerProfile', 'playerProfile.category']
        });

        if (!player) {
            throw new AppError('Player profile not found', 404, 'Not Found');
        }

        // Fetch upcoming training sessions
        const upcomingTrainings = await trainingRepository.find({
            order: { date: 'ASC', startTime: 'ASC' },
            take: 5
        });

        // Fetch matches in player's category, or all matches if category is null
        const categoryId = player.playerProfile?.category?.id;
        const matchQuery: any = {
            relations: ['category'],
            where: { ended: false },
            order: { date: 'ASC', time: 'ASC' },
            take: 5
        };
        if (categoryId) {
            matchQuery.where = { ended: false, category: { id: categoryId } };
        }
        const upcomingMatches = await matchRepository.find(matchQuery);

        return {
            player: {
                id: player.id,
                playerId: player.playerId,
                firstName: player.firstName,
                lastName: player.lastName,
                email: player.email,
                phone: player.phone,
                dateOfBirth: player.dateOfBirth,
                status: player.status,
                registrationDate: player.registrationDate,
                passportUrl: player.passportUrl || null,
                profile: player.playerProfile ? {
                    heightCm: player.playerProfile.heightCm,
                    weightKg: player.playerProfile.weightKg,
                    dominantFoot: player.playerProfile.dominantFoot,
                    position: player.playerProfile.position,
                    preferredJerseyNumber: player.playerProfile.preferredJerseyNumber,
                    biography: player.playerProfile.biography,
                    category: player.playerProfile.category?.name || 'GENERAL'
                } : null
            },
            upcomingTrainings,
            upcomingMatches
        };
    }

    // 2. Get Parent Dashboard Data (list of children, invoice ledger summaries)
    async getParentDashboard(userId: number) {
        const parentRepository = AppDataSource.getRepository(Parent);
        const playerRepository = AppDataSource.getRepository(Player);
        const invoiceRepository = AppDataSource.getRepository(Invoice);
        const paymentRepository = AppDataSource.getRepository(Payment);

        const parent = await parentRepository.findOne({
            where: { id: userId }
        });

        if (!parent) {
            throw new AppError('Parent profile not found', 404, 'Not Found');
        }

        // Fetch linked children
        const children = await playerRepository.find({
            where: { parent: { id: userId } },
            relations: ['playerProfile', 'playerProfile.category']
        });

        // Fetch invoices for all children
        const childrenIds = children.map(c => c.id);
        let invoices: any[] = [];
        let payments: any[] = [];

        if (childrenIds.length > 0) {
            const rawInvoices = await invoiceRepository.createQueryBuilder('invoice')
                .leftJoinAndSelect('invoice.account', 'account')
                .leftJoinAndSelect('account.player', 'player')
                .where('account.id IN (:...ids)', { ids: childrenIds })
                .orderBy('invoice.createdAt', 'DESC')
                .getMany();

            invoices = rawInvoices.map((inv) => ({
                id: Number(inv.id),
                invoiceNumber: `INV-${inv.id}`,
                player: {
                    id: inv.account?.player?.id,
                    firstName: inv.account?.player?.firstName,
                    lastName: inv.account?.player?.lastName
                },
                issueDate: inv.createdAt ? new Date(inv.createdAt).toISOString().split('T')[0] : '—',
                amount: Number(inv.totalAmount),
                status: inv.status
            }));

            const rawPayments = await paymentRepository.createQueryBuilder('payment')
                .leftJoinAndSelect('payment.account', 'account')
                .leftJoinAndSelect('account.player', 'player')
                .where('account.id IN (:...ids)', { ids: childrenIds })
                .orderBy('payment.paymentDate', 'DESC')
                .getMany();

            payments = rawPayments.map((pay) => ({
                id: Number(pay.id),
                receiptNumber: pay.referenceNumber,
                player: {
                    id: pay.account?.player?.id,
                    firstName: pay.account?.player?.firstName,
                    lastName: pay.account?.player?.lastName
                },
                paymentDate: pay.paymentDate ? new Date(pay.paymentDate).toISOString().split('T')[0] : '—',
                paymentMethod: 'Direct Payment',
                amount: Number(pay.amountPaid),
                receiptUrl: `/finance/payments/${pay.id}/receipt`
            }));
        }

        return {
            parent: {
                id: parent.id,
                firstName: parent.firstName,
                lastName: parent.lastName,
                email: parent.email,
                phone: parent.phone,
                address: parent.address
            },
            children: children.map(c => ({
                id: c.id,
                playerId: c.playerId,
                firstName: c.firstName,
                lastName: c.lastName,
                status: c.status,
                passportUrl: c.passportUrl || null,
                position: c.playerProfile?.position || null,
                category: c.playerProfile?.category?.name || 'GENERAL'
            })),
            invoices,
            payments
        };
    }

    // 3. Get Parent Child Details Data
    async getParentChildDetails(parentUserId: number, childId: number) {
        const playerRepository = AppDataSource.getRepository(Player);
        const matchRepository = AppDataSource.getRepository(Match);
        const trainingRepository = AppDataSource.getRepository(TrainingSession);

        // Verify the child belongs to this parent
        const child = await playerRepository.findOne({
            where: { id: childId, parent: { id: parentUserId } },
            relations: ['playerProfile', 'playerProfile.category']
        });

        if (!child) {
            throw new AppError('Child player profile not found or unauthorized access', 404, 'Not Found');
        }

        // Fetch upcoming training sessions
        const upcomingTrainings = await trainingRepository.find({
            order: { date: 'ASC', startTime: 'ASC' },
            take: 5
        });

        // Fetch matches in child's category
        const categoryId = child.playerProfile?.category?.id;
        const matchQuery: any = {
            relations: ['category'],
            where: { ended: false },
            order: { date: 'ASC', time: 'ASC' },
            take: 5
        };
        if (categoryId) {
            matchQuery.where = { ended: false, category: { id: categoryId } };
        }
        const upcomingMatches = await matchRepository.find(matchQuery);

        return {
            child: {
                id: child.id,
                playerId: child.playerId,
                firstName: child.firstName,
                lastName: child.lastName,
                email: child.email,
                phone: child.phone,
                dateOfBirth: child.dateOfBirth,
                status: child.status,
                passportUrl: child.passportUrl || null,
                profile: child.playerProfile ? {
                    heightCm: child.playerProfile.heightCm,
                    weightKg: child.playerProfile.weightKg,
                    dominantFoot: child.playerProfile.dominantFoot,
                    position: child.playerProfile.position,
                    preferredJerseyNumber: child.playerProfile.preferredJerseyNumber,
                    biography: child.playerProfile.biography,
                    category: child.playerProfile.category?.name || 'GENERAL'
                } : null
            },
            upcomingTrainings,
            upcomingMatches
        };
    }
}

export const portalService = new PortalService();
