import { AppDataSource } from '../config/database';
import { Account } from '../model/Account';
import { Term } from '../model/Term';
import { Invoice } from '../model/Invoice';
import { Payment } from '../model/Payment';
import { PaymentAllocation } from '../model/PaymentAllocation';
import { Player } from '../model/Player';
import { PlayerProfile } from '../model/PlayerProfile';
import { randomUUID } from 'crypto';
import { numberToWords } from '../utils/numberToWords';
import * as fs from 'fs';
import { appCache, CACHE_KEYS } from '../config/cache';

export class BillingService {
    async calculateActiveTermLedgerMatrix() {
        const cached = appCache.get<any[]>(CACHE_KEYS.LEDGER_SUMMARY);
        if (cached) {
            return cached;
        }

        const termRepository = AppDataSource.getRepository(Term);
        const accountRepository = AppDataSource.getRepository(Account);
        const invoiceRepository = AppDataSource.getRepository(Invoice);
        const paymentRepository = AppDataSource.getRepository(Payment);

        const currentTerm = await termRepository.findOne({ where: { isCurrentActive: true } });
        if (!currentTerm) {
            return [];
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

        appCache.set(CACHE_KEYS.LEDGER_SUMMARY, ledgerMatrix);
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

            appCache.del(CACHE_KEYS.LEDGER_SUMMARY);

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
        const saved = await invoiceRepository.save(invoice);
        appCache.del(CACHE_KEYS.LEDGER_SUMMARY);
        return saved;
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

    async getPaymentReceiptHtml(paymentId: number): Promise<string> {
        const paymentRepository = AppDataSource.getRepository(Payment);
        const payment = await paymentRepository.findOne({
            where: { id: paymentId },
            relations: [
                'account',
                'account.player',
                'account.player.parent',
                'term',
                'term.session',
                'allocations',
                'allocations.invoice'
            ]
        });

        if (!payment) {
            throw new Error(`Payment record with ID #${paymentId} not found.`);
        }

        const player = payment.account.player;
        const parent = player ? player.parent : null;
        const term = payment.term;
        const session = term ? term.session : null;

        let logoBase64 = appCache.get<string>(CACHE_KEYS.BASE64_LOGO) || '';
        if (!logoBase64) {
            try {
                const logoPath = '/home/fowobi/Pictures/pfa_logo.jpeg';
                if (fs.existsSync(logoPath)) {
                    const logoBuffer = fs.readFileSync(logoPath);
                    logoBase64 = `data:image/jpeg;base64,${logoBuffer.toString('base64')}`;
                } else {
                    const downloadPath = '/home/fowobi/Downloads/pfa_logo.jpeg';
                    if (fs.existsSync(downloadPath)) {
                        const logoBuffer = fs.readFileSync(downloadPath);
                        logoBase64 = `data:image/jpeg;base64,${logoBuffer.toString('base64')}`;
                    }
                }
                if (logoBase64) {
                    appCache.set(CACHE_KEYS.BASE64_LOGO, logoBase64);
                }
            } catch (e) {
                console.error('Failed to read logo image:', e);
            }
        }

        const amountFormatted = parseFloat(payment.amountPaid.toString()).toLocaleString('en-NG', {
            style: 'currency',
            currency: 'NGN'
        });

        const amountInWords = numberToWords(parseFloat(payment.amountPaid.toString()));
        const paymentDateStr = new Date(payment.paymentDate).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });

        let allocationRowsHtml = '';
        if (payment.allocations && payment.allocations.length > 0) {
            payment.allocations.forEach((alloc) => {
                const invoice = alloc.invoice;
                const category = invoice ? invoice.category : 'N/A';
                const desc = invoice ? invoice.description : 'Payment Allocation';
                const amt = parseFloat(alloc.amountAllocated.toString()).toLocaleString('en-NG', {
                    style: 'currency',
                    currency: 'NGN'
                });
                allocationRowsHtml += `
                    <tr>
                        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #4a5568; text-align: left;">
                            <strong>${category}</strong><br>
                            <span style="font-size: 12px; color: #718096;">${desc}</span>
                        </td>
                        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: right; color: #2d3748; font-weight: 600;">
                            ${amt}
                        </td>
                    </tr>
                `;
            });
        } else {
            allocationRowsHtml = `
                <tr>
                    <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #4a5568; text-align: left;">
                        General Tuition/Fee Payment
                    </td>
                    <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: right; color: #2d3748; font-weight: 600;">
                        ${amountFormatted}
                    </td>
                </tr>
            `;
        }

        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Payment Receipt - Pioneers Football Academy</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');
        
        body {
            font-family: 'Outfit', sans-serif;
            background-color: #f7fafc;
            margin: 0;
            padding: 40px 0;
            color: #2d3748;
            -webkit-print-color-adjust: exact;
        }

        .receipt-card {
            background-color: #ffffff;
            max-width: 800px;
            margin: 0 auto;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
            border: 1px solid #e2e8f0;
            position: relative;
        }

        .header-section {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 30px;
        }

        .academy-logo {
            max-height: 85px;
            object-fit: contain;
        }

        .academy-details {
            text-align: right;
        }

        .academy-name {
            font-size: 22px;
            font-weight: 700;
            color: #0a2240;
            margin: 0 0 4px 0;
        }

        .academy-motto {
            font-size: 12px;
            font-style: italic;
            color: #e62b1e;
            margin: 0 0 8px 0;
            font-weight: 500;
            letter-spacing: 0.5px;
        }

        .academy-contact {
            font-size: 13px;
            color: #718096;
            margin: 2px 0;
        }

        .divider {
            height: 4px;
            background: linear-gradient(90deg, #0a2240 0%, #e62b1e 100%);
            margin-bottom: 30px;
            border-radius: 2px;
        }

        .receipt-title {
            font-size: 24px;
            font-weight: 700;
            text-align: center;
            color: #0a2240;
            letter-spacing: 1px;
            margin: 0 0 30px 0;
            text-transform: uppercase;
        }

        .meta-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 30px;
            background-color: #f8fafc;
            padding: 20px;
            border-radius: 8px;
            border: 1px solid #edf2f7;
        }

        .meta-item {
            font-size: 14px;
            text-align: left;
        }

        .meta-label {
            font-weight: 600;
            color: #718096;
            text-transform: uppercase;
            font-size: 11px;
            letter-spacing: 0.5px;
            margin-bottom: 4px;
        }

        .meta-value {
            color: #2d3748;
            font-weight: 500;
            font-size: 15px;
        }

        .table-title {
            font-size: 16px;
            font-weight: 600;
            color: #0a2240;
            margin: 0 0 12px 0;
            border-bottom: 2px solid #edf2f7;
            padding-bottom: 6px;
            text-align: left;
        }

        .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
        }

        .table-header {
            background-color: #0a2240;
            color: #ffffff;
            text-transform: uppercase;
            font-size: 11px;
            letter-spacing: 0.5px;
        }

        .table-header th {
            padding: 12px;
            font-weight: 600;
            text-align: left;
        }

        .words-section {
            background-color: #f8fafc;
            border-left: 4px solid #e62b1e;
            padding: 15px 20px;
            border-radius: 0 8px 8px 0;
            margin-bottom: 40px;
            text-align: left;
        }

        .words-label {
            font-size: 11px;
            font-weight: 600;
            color: #718096;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 4px;
        }

        .words-value {
            font-size: 15px;
            font-weight: 500;
            color: #0a2240;
            font-style: italic;
        }

        .total-box {
            display: flex;
            justify-content: flex-end;
            margin-bottom: 30px;
        }

        .total-card {
            background-color: #0a2240;
            color: #ffffff;
            padding: 15px 25px;
            border-radius: 8px;
            text-align: right;
            min-width: 200px;
        }

        .total-label {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 4px;
            opacity: 0.8;
        }

        .total-amount {
            font-size: 22px;
            font-weight: 700;
        }

        .footer-section {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            margin-top: 50px;
            border-top: 1px solid #edf2f7;
            padding-top: 30px;
            text-align: left;
        }

        .footer-note {
            max-width: 450px;
            font-size: 13px;
            color: #718096;
            line-height: 1.5;
        }

        .signature-box {
            text-align: center;
            width: 200px;
        }

        .signature-line {
            border-bottom: 1px dashed #718096;
            height: 40px;
            margin-bottom: 8px;
        }

        .signature-title {
            font-size: 12px;
            color: #4a5568;
            font-weight: 600;
        }

        .no-print-bar {
            max-width: 800px;
            margin: 0 auto 20px auto;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .btn {
            padding: 10px 20px;
            font-size: 14px;
            font-weight: 600;
            border-radius: 6px;
            cursor: pointer;
            text-decoration: none;
            transition: all 0.2s ease;
            font-family: 'Outfit', sans-serif;
        }

        .btn-print {
            background-color: #0a2240;
            color: #ffffff;
            border: none;
        }

        .btn-print:hover {
            background-color: #12335c;
        }

        .btn-back {
            background-color: #edf2f7;
            color: #4a5568;
            border: 1px solid #cbd5e0;
        }

        .btn-back:hover {
            background-color: #e2e8f0;
        }

        @media print {
            body {
                background-color: #ffffff;
                padding: 0;
            }
            .receipt-card {
                border: none;
                box-shadow: none;
                padding: 0;
            }
            .no-print, .no-print-bar {
                display: none !important;
            }
        }
    </style>
</head>
<body>

    <div class="no-print-bar">
        <button onclick="window.history.back()" class="btn btn-back">Go Back</button>
        <button onclick="window.print()" class="btn btn-print">Print Receipt</button>
    </div>

    <div class="receipt-card">
        <div class="header-section">
            <div>
                ${logoBase64 ? `<img src="${logoBase64}" class="academy-logo" alt="Pioneers Football Academy Logo">` : `<div style="font-size: 24px; font-weight: 800; color: #0a2240;">PFA</div>`}
            </div>
            <div class="academy-details">
                <h1 class="academy-name">PIONEERS FOOTBALL ACADEMY</h1>
                <p class="academy-motto">Dedication and Loyalty</p>
                <p class="academy-contact">Email: info@pioneersfootballacademy.com</p>
                <p class="academy-contact">Phone: +234 (0) 803 762 9350</p>
            </div>
        </div>

        <div class="divider"></div>

        <h2 class="receipt-title">Official Payment Receipt</h2>

        <div class="meta-grid">
            <div class="meta-item">
                <div class="meta-label">Receipt Number</div>
                <div class="meta-value">${payment.referenceNumber}</div>
            </div>
            <div class="meta-item">
                <div class="meta-label">Payment Date</div>
                <div class="meta-value">${paymentDateStr}</div>
            </div>
            <div class="meta-item">
                <div class="meta-label">Player Name</div>
                <div class="meta-value">${player ? `${player.firstName} ${player.lastName}` : 'N/A'}</div>
            </div>
            <div class="meta-item">
                <div class="meta-label">Parent / Sponsor</div>
                <div class="meta-value">${parent ? `${parent.firstName} ${parent.lastName}` : 'N/A'}</div>
            </div>
            <div class="meta-item" style="grid-column: span 2;">
                <div class="meta-label">Academic Term</div>
                <div class="meta-value">${session ? session.name : 'N/A'} - ${term ? term.name : 'N/A'} TERM</div>
            </div>
        </div>

        <h3 class="table-title">Payment Allocation Breakdown</h3>
        <table class="items-table">
            <thead>
                <tr class="table-header">
                    <th style="border-radius: 4px 0 0 4px;">Description</th>
                    <th style="text-align: right; border-radius: 0 4px 4px 0; width: 180px;">Amount Allocated</th>
                </tr>
            </thead>
            <tbody>
                ${allocationRowsHtml}
            </tbody>
        </table>

        <div class="total-box">
            <div class="total-card">
                <div class="total-label">Total Amount Paid</div>
                <div class="total-amount">${amountFormatted}</div>
            </div>
        </div>

        <div class="words-section">
            <div class="words-label">Amount in Words</div>
            <div class="words-value">${amountInWords}</div>
        </div>

        <div class="footer-section">
            <div class="footer-note">
                <strong>Pioneers Football Academy Seal</strong><br>
                Thank you for your payment. This receipt is generated electronically as a valid proof of payment for services rendered by Pioneers Football Academy.
            </div>
            <div class="signature-box">
                <div class="signature-line"></div>
                <div class="signature-title">Authorized Representative</div>
            </div>
        </div>
    </div>

</body>
</html>
        `;
        return html;
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
