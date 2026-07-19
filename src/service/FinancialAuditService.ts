import { AppDataSource } from '../config/database';
import { Term } from '../model/Term';
import { Account } from '../model/Account';
import { Invoice } from '../model/Invoice';
import { Payment } from '../model/Payment';
import { InvoicePayment } from '../model/InvoicePayment';
import { PaymentAllocation } from '../model/PaymentAllocation';
import { PlayerProfile } from '../model/PlayerProfile';

export class FinancialAuditService {
    private baseTuitionFee = 35000.00;

    async getSettlementHistory(invoiceId: number) {
        const invoiceRepository = AppDataSource.getRepository(Invoice);
        const exists = await invoiceRepository.findOne({ where: { id: invoiceId } });
        if (!exists) {
            throw new Error(`Invoice record with ID #${invoiceId} does not exist.`);
        }

        const history = await AppDataSource.getRepository(InvoicePayment).find({
            where: { invoice: { id: invoiceId } },
            relations: ['payment']
        });

        return history.map((ip) => ({
            id: Number(ip.id),
            paymentId: Number(ip.payment.id),
            amountPaid: parseFloat(ip.amountPaid.toString()),
            referenceNumber: ip.payment.referenceNumber,
            paymentDate: ip.payment.paymentDate,
            createdAt: ip.createdAt
        }));
    }

    async getInvoiceSettlementHistory(invoiceId: number) {
        const invoiceRepository = AppDataSource.getRepository(Invoice);
        const exists = await invoiceRepository.findOne({ where: { id: invoiceId } });
        if (!exists) {
            throw new Error(`Invoice record with ID #${invoiceId} does not exist.`);
        }

        const allocations = await AppDataSource.getRepository(PaymentAllocation).find({
            where: { invoice: { id: invoiceId } },
            relations: ['payment']
        });

        return allocations.map((a) => ({
            allocationId: Number(a.id),
            paymentId: Number(a.payment.id),
            invoiceId: invoiceId,
            amountAllocated: parseFloat(a.amountAllocated.toString()),
            referenceNumber: a.payment.referenceNumber,
            allocatedAt: a.allocatedAt
        }));
    }

    async executeTermRolloverAudit(request: any) {
        const termRepository = AppDataSource.getRepository(Term);
        const accountRepository = AppDataSource.getRepository(Account);
        const invoiceRepository = AppDataSource.getRepository(Invoice);
        const paymentRepository = AppDataSource.getRepository(Payment);

        const closingTerm = await termRepository.findOne({ where: { id: parseInt(request.termId) } });
        if (!closingTerm) {
            throw new Error('Target term reference key invalid.');
        }

        if (!closingTerm.isCurrentActive) {
            throw new Error('Target audit term is already historical or inactive.');
        }

        const accounts = await accountRepository.find();

        for (const account of accounts) {
            const invoices = await invoiceRepository.find({
                where: { account: { id: account.id }, term: { id: closingTerm.id } }
            });

            const payments = await paymentRepository.find({
                where: { account: { id: account.id }, term: { id: closingTerm.id } }
            });

            const invoicesSum = invoices.reduce((sum, inv) => sum + parseFloat(inv.totalAmount.toString()), 0);
            const paymentsSum = payments.reduce((sum, pay) => sum + parseFloat(pay.amountPaid.toString()), 0);

            const periodDebit = parseFloat(account.broughtForward.toString()) + invoicesSum;
            let carryForwardDebt = periodDebit - paymentsSum;

            if (carryForwardDebt < 0) {
                carryForwardDebt = 0;
            }

            closingTerm.openingAccountBalance = parseFloat(closingTerm.openingAccountBalance.toString()) + parseFloat(account.broughtForward.toString());
            closingTerm.closingAccountBalance = parseFloat(closingTerm.closingAccountBalance.toString()) + carryForwardDebt;

            account.broughtForward = carryForwardDebt;
            await accountRepository.save(account);
        }

        closingTerm.isCurrentActive = false;
        await termRepository.save(closingTerm);
    }

    async generateTuitionInvoicesForTerm(term: Term) {
        console.log(`Starting tuition invoice generation for Term: ${term.name} - Base Fee: ${this.baseTuitionFee}`);

        if (this.baseTuitionFee <= 0) {
            console.log('Base tuition fee is set to zero or missing in configuration. Skipping generation.');
            return;
        }

        const activeProfiles = await AppDataSource.getRepository(PlayerProfile).find({
            where: { active: true },
            relations: ['player', 'player.account']
        });

        console.log(`Active profiles found: ${activeProfiles.length}`);
        const batchInvoices: Invoice[] = [];
        const invoiceRepository = AppDataSource.getRepository(Invoice);

        for (const profile of activeProfiles) {
            const player = profile.player;
            if (!player) continue;

            const account = player.account;
            if (!account) {
                console.log(`Skipping player ID: ${profile.player_id} because no financial account structure exists.`);
                continue;
            }

            if (!account.status) {
                console.log(`Skipping invoice generation for Account ID: ${account.accountId} as it is explicitly deactivated.`);
                continue;
            }

            const totalInvoiceAmount = this.calculateInvoiceAmount(account);

            const tuitionInvoice = invoiceRepository.create({
                account,
                term,
                totalAmount: totalInvoiceAmount,
                amountDue: totalInvoiceAmount,
                category: 'TUITION',
                description: `Tuition fees allocation for ${term.name} Term`,
                status: 'UNSETTLED',
                createdAt: new Date()
            });

            batchInvoices.push(tuitionInvoice);
        }

        if (batchInvoices.length > 0) {
            await invoiceRepository.save(batchInvoices);
            console.log(`Successfully generated and posted ${batchInvoices.length} tuition invoices for the term.`);
        }
    }

    private calculateInvoiceAmount(account: Account): number {
        if (!account.discounted || account.percentDiscount <= 0) {
            return this.baseTuitionFee;
        }

        const percentFactor = account.percentDiscount / 100;
        const deductible = this.baseTuitionFee * percentFactor;
        const netAmount = this.baseTuitionFee - deductible;

        return Math.round(netAmount * 100) / 100;
    }
}

export const financialAuditService = new FinancialAuditService();
