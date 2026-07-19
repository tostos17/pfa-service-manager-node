import { AppDataSource } from '../config/database';
import { Account } from '../model/Account';
import { Term } from '../model/Term';
import { Invoice } from '../model/Invoice';
import { Payment } from '../model/Payment';
import { PaymentAllocation } from '../model/PaymentAllocation';
import { Player } from '../model/Player';
import { PlayerProfile } from '../model/PlayerProfile';
import { randomUUID } from 'crypto';

export class BillingService {
    async calculateActiveTermLedgerMatrix() {
        const termRepository = AppDataSource.getRepository(Term);
        const accountRepository = AppDataSource.getRepository(Account);
        const invoiceRepository = AppDataSource.getRepository(Invoice);
        const paymentRepository = AppDataSource.getRepository(Payment);

        const currentTerm = await termRepository.findOne({ where: { isCurrentActive: true } });
        if (!currentTerm) {
            throw new Error('Active term configuration mismatch. Please check calendar properties.');
        }

        const accounts = await accountRepository.find({ relations: ['player', 'player.playerProfile', 'player.playerProfile.category'] });
        const ledgerMatrix = [];

        for (const account of accounts) {
            const player = account.player;
            if (!player) continue;

            const profile = player.playerProfile;
            const categoryLabel = (profile && profile.category) ? profile.category.name : 'General';

            const activeInvoices = await invoiceRepository.find({
                where: { account: { id: account.id }, term: { id: currentTerm.id } }
            });

            const termTuition = activeInvoices
                .filter((inv) => inv.category.toUpperCase() === 'TUITION')
                .reduce((sum, inv) => sum + parseFloat(inv.totalAmount.toString()), 0);

            const nonFeeCharges = activeInvoices
                .filter((inv) => inv.category.toUpperCase() !== 'TUITION')
                .reduce((sum, inv) => sum + parseFloat(inv.totalAmount.toString()), 0);

            const activePayments = await paymentRepository.find({
                where: { account: { id: account.id }, term: { id: currentTerm.id } }
            });

            const totalPaid = activePayments.reduce((sum, pay) => sum + parseFloat(pay.amountPaid.toString()), 0);

            const broughtForward = parseFloat(account.broughtForward.toString());
            const structuralLiability = broughtForward + termTuition + nonFeeCharges;
            let outstanding = structuralLiability - totalPaid;
            if (outstanding < 0) {
                outstanding = 0;
            }

            ledgerMatrix.push({
                accountId: account.accountId,
                playerName: `${player.firstName} ${player.lastName}`,
                category: categoryLabel,
                broughtForward,
                termTuition,
                nonFeeCharges,
                totalPaid,
                outstanding
            });
        }

        return ledgerMatrix;
    }

    async getUnsettledInvoicesByAccount(accountId: string) {
        const accountRepository = AppDataSource.getRepository(Account);
        const invoiceRepository = AppDataSource.getRepository(Invoice);

        const account = await accountRepository.findOne({
            where: { accountId },
            relations: ['player']
        });

        if (!account) {
            throw new Error(`Ledger account profile not found for identifier: ${accountId}`);
        }

        const openInvoices = await invoiceRepository
            .createQueryBuilder('invoice')
            .leftJoinAndSelect('invoice.account', 'account')
            .leftJoinAndSelect('account.player', 'player')
            .leftJoinAndSelect('invoice.term', 'term')
            .leftJoinAndSelect('term.session', 'session')
            .where('account.id = :id', { id: account.id })
            .andWhere("invoice.status IN ('UNSETTLED', 'PARTIALLY_PAID')")
            .getMany();

        return openInvoices.map((inv) => this.mapToResponse(inv, account));
    }

    async issueInvoiceToPlayer(playerId: string | undefined, request: any) {
        const termRepository = AppDataSource.getRepository(Term);
        const accountRepository = AppDataSource.getRepository(Account);
        const invoiceRepository = AppDataSource.getRepository(Invoice);

        const activeTerm = await termRepository.findOne({ where: { isCurrentActive: true } });
        if (!activeTerm) {
            throw new Error('Active academic calendar tracking term is not configured.');
        }

        if (!request.accountId) {
            const activeAccounts = await accountRepository.find();
            for (const account of activeAccounts) {
                if (account.status) {
                    await this.createInvoiceRecord(account, activeTerm, request);
                }
            }
            return {
                description: 'Batch Global Tuition/Fee Invoice generation execution finished successfully.'
            };
        }

        const account = await accountRepository.findOne({
            where: { accountId: request.accountId },
            relations: ['player']
        });

        if (!account) {
            throw new Error(`Account not found with ID: ${request.accountId}`);
        }

        const savedInvoice = await this.createInvoiceRecord(account, activeTerm, request);
        return this.mapToResponse(savedInvoice, account);
    }

    async getAllInvoices(status: string | undefined, session: string | undefined, term: string | undefined) {
        const invoiceRepository = AppDataSource.getRepository(Invoice);
        const queryBuilder = invoiceRepository
            .createQueryBuilder('invoice')
            .leftJoinAndSelect('invoice.account', 'account')
            .leftJoinAndSelect('account.player', 'player')
            .leftJoinAndSelect('invoice.term', 'term')
            .leftJoinAndSelect('term.session', 'session');

        if (status && status.trim() !== '') {
            queryBuilder.andWhere('UPPER(invoice.status) = :status', { status: status.trim().toUpperCase() });
        }
        if (session && session.trim() !== '') {
            queryBuilder.andWhere('UPPER(session.name) = :session', { session: session.trim().toUpperCase() });
        }
        if (term && term.trim() !== '') {
            queryBuilder.andWhere('UPPER(term.name) = :term', { term: term.trim().toUpperCase() });
        }

        queryBuilder.orderBy('invoice.amountDue', 'DESC');

        const invoices = await queryBuilder.getMany();
        return invoices.map((inv) => this.mapToInvoiceResponse(inv));
    }

    async getPartPaymentsByInvoice(invoiceId: number) {
        const invoiceRepository = AppDataSource.getRepository(Invoice);
        const allocationRepository = AppDataSource.getRepository(PaymentAllocation);

        const exists = await invoiceRepository.findOne({ where: { id: invoiceId } });
        if (!exists) {
            throw new Error(`Invoice record with ID #${invoiceId} does not exist.`);
        }

        const allocations = await allocationRepository.find({
            where: { invoice: { id: invoiceId } },
            relations: ['payment']
        });

        return allocations.map((alloc) => ({
            allocationId: Number(alloc.id),
            paymentId: Number(alloc.payment.id),
            referenceNumber: alloc.payment.referenceNumber,
            amountPaid: parseFloat(alloc.amountAllocated.toString()),
            paymentDate: alloc.allocatedAt
        }));
    }

    async processPlayerPayment(playerId: string | undefined, request: any) {
        return await AppDataSource.transaction(async (transactionManager) => {
            const accountRepository = transactionManager.getRepository(Account);
            const termRepository = transactionManager.getRepository(Term);
            const invoiceRepository = transactionManager.getRepository(Invoice);
            const paymentRepository = transactionManager.getRepository(Payment);
            const allocationRepository = transactionManager.getRepository(PaymentAllocation);

            let account = await accountRepository.findOne({
                where: { accountId: request.accountId },
                relations: ['player']
            });

            if (!account) {
                account = await accountRepository.findOne({
                    where: { player: { playerId: request.accountId } },
                    relations: ['player']
                });
            }

            if (!account) {
                const dbId = parseInt(request.accountId);
                if (!isNaN(dbId)) {
                    account = await accountRepository.findOne({
                        where: { id: dbId },
                        relations: ['player']
                    });
                }
            }

            if (!account) {
                throw new Error(`Account profile not found for identifier: ${request.accountId}`);
            }

            const activeTerm = await termRepository.findOne({ where: { isCurrentActive: true } });
            if (!activeTerm) {
                throw new Error('Active academic tracking term is not configured.');
            }

            const invoiceIds = (request.invoiceIds || []).map((id: any) => parseInt(id));
            if (invoiceIds.length === 0) {
                throw new Error('No invoices selected for payment.');
            }

            const selectedInvoices = [];
            for (const invId of invoiceIds) {
                const inv = await invoiceRepository.findOne({ where: { id: invId } });
                if (!inv) {
                    throw new Error('One or more targeted selected invoice objects could not be resolved.');
                }
                selectedInvoices.push(inv);
            }

            const collectiveSum = selectedInvoices.reduce((sum, inv) => sum + parseFloat(inv.amountDue.toString()), 0);
            const remittance = parseFloat(request.amountPaid);

            if (remittance > collectiveSum) {
                throw new Error('Overpayment rejected. Remittance amount exceeds the cumulative collective balance of selected invoices.');
            }

            const fullyCoveredCount = selectedInvoices.filter((inv) => remittance >= parseFloat(inv.amountDue.toString())).length;
            const requiredFullSettlements = selectedInvoices.length - 1;

            if (fullyCoveredCount < requiredFullSettlements) {
                throw new Error('Invalid allocation distribution. Remittance is insufficient to pay required invoices fully.');
            }

            const generatedRef = `PAY-TXN-${randomUUID().substring(0, 8).toUpperCase()}`;

            const payment = paymentRepository.create({
                account,
                term: activeTerm,
                amountPaid: remittance,
                referenceNumber: generatedRef,
                paymentDate: new Date()
            });

            const savedPayment = await paymentRepository.save(payment);
            let cashPool = remittance;

            for (const invoice of selectedInvoices) {
                if (cashPool <= 0) break;

                const due = parseFloat(invoice.amountDue.toString());
                const allocationAmount = Math.min(cashPool, due);

                invoice.amountDue = due - allocationAmount;
                invoice.status = invoice.amountDue === 0 ? 'SETTLED' : 'PARTIALLY_PAID';
                await invoiceRepository.save(invoice);

                const allocation = allocationRepository.create({
                    payment: savedPayment,
                    invoice,
                    amountAllocated: allocationAmount,
                    allocatedAt: new Date()
                });
                await allocationRepository.save(allocation);

                cashPool -= allocationAmount;
            }

            return {
                id: Number(savedPayment.id),
                amountPaid: savedPayment.amountPaid,
                referenceNumber: savedPayment.referenceNumber,
                paymentDate: savedPayment.paymentDate
            };
        });
    }

    private async createInvoiceRecord(account: Account, term: Term, request: any): Promise<Invoice> {
        const invoiceRepository = AppDataSource.getRepository(Invoice);
        const invoice = invoiceRepository.create({
            account,
            term,
            totalAmount: parseFloat(request.amount),
            amountDue: parseFloat(request.amount),
            category: request.itemType.toUpperCase(),
            description: request.description,
            status: 'UNSETTLED',
            createdAt: new Date()
        });
        return await invoiceRepository.save(invoice);
    }

    private mapToResponse(savedInvoice: Invoice, account: Account) {
        const termName = savedInvoice.term ? `${savedInvoice.term.session.name} - ${savedInvoice.term.name} TERM` : 'N/A';
        return {
            invoiceId: Number(savedInvoice.id),
            playerId: account.player ? account.player.playerId : null,
            playerName: account.player ? `${account.player.firstName} ${account.player.lastName}` : 'Unknown',
            termDisplayName: termName,
            totalAmount: parseFloat(savedInvoice.totalAmount.toString()),
            amountDue: parseFloat(savedInvoice.amountDue.toString()),
            category: savedInvoice.category,
            description: savedInvoice.description,
            status: savedInvoice.status,
            createdAt: savedInvoice.createdAt
        };
    }

    private mapToInvoiceResponse(invoice: Invoice) {
        const account = invoice.account;
        const player = account ? account.player : null;
        const termName = invoice.term ? `${invoice.term.session.name} - ${invoice.term.name} TERM` : 'N/A';
        return {
            invoiceId: Number(invoice.id),
            playerId: player ? player.playerId : null,
            playerName: player ? `${player.firstName} ${player.lastName}` : 'Unknown',
            termDisplayName: termName,
            totalAmount: parseFloat(invoice.totalAmount.toString()),
            amountDue: parseFloat(invoice.amountDue.toString()),
            category: invoice.category,
            description: invoice.description,
            status: invoice.status,
            createdAt: invoice.createdAt,
            accountId: account ? Number(account.id) : null
        };
    }
}

export const billingService = new BillingService();
