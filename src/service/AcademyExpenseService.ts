import { AppDataSource } from '../config/database';
import { AcademyExpense } from '../model/AcademyExpense';
import { Term } from '../model/Term';
import { Invoice } from '../model/Invoice';

export class AcademyExpenseService {
    async recordExpense(request: any, adminId: number) {
        const termRepository = AppDataSource.getRepository(Term);
        const expenseRepository = AppDataSource.getRepository(AcademyExpense);

        const term = await termRepository.findOne({ where: { id: parseInt(request.termId) } });
        if (!term) {
            throw new Error('Target term context sequence not found.');
        }

        const expense = expenseRepository.create({
            title: request.title,
            description: request.description,
            amount: parseFloat(request.amount),
            category: request.category.toUpperCase(),
            expenseDate: request.expenseDate,
            receiptUrl: request.receiptUrl || undefined,
            term: term,
            recordedByAdminId: adminId,
            status: 'PENDING'
        });

        await expenseRepository.save(expense);
        return this.mapToResponse(expense);
    }

    async evaluateExpenseStatus(expenseId: number, targetStatus: string, reviewerAdminId: number) {
        const expenseRepository = AppDataSource.getRepository(AcademyExpense);
        const expense = await expenseRepository.findOne({ where: { id: expenseId }, relations: ['term', 'term.session'] });
        if (!expense) {
            throw new Error('Expense record not found.');
        }

        if (!['APPROVED', 'REJECTED'].includes(targetStatus.toUpperCase())) {
            throw new Error('Invalid state processing context assigned.');
        }

        expense.status = targetStatus.toUpperCase();
        expense.approvedByAdminId = reviewerAdminId;

        await expenseRepository.save(expense);
        return this.mapToResponse(expense);
    }

    async fetchFilteredLedger(status: string | undefined, category: string | undefined, start: string | undefined, end: string | undefined) {
        const expenseRepository = AppDataSource.getRepository(AcademyExpense);
        const fromDate = start || '2000-01-01';
        const toDate = end || '2099-12-31';

        const queryBuilder = expenseRepository
            .createQueryBuilder('e')
            .leftJoinAndSelect('e.term', 'term')
            .leftJoinAndSelect('term.session', 'session')
            .where('e.expenseDate BETWEEN :fromDate AND :toDate', { fromDate, toDate });

        if (status && status.trim() !== '') {
            queryBuilder.andWhere('e.status = :status', { status: status.toUpperCase() });
        }
        if (category && category.trim() !== '') {
            queryBuilder.andWhere('e.category = :category', { category: category.toUpperCase() });
        }

        const expenses = await queryBuilder.getMany();
        return expenses.map((e) => this.mapToResponse(e));
    }

    async computeTermFinancialAudit(termId: number) {
        const termRepository = AppDataSource.getRepository(Term);
        const expenseRepository = AppDataSource.getRepository(AcademyExpense);
        const invoiceRepository = AppDataSource.getRepository(Invoice);

        const term = await termRepository.findOne({ where: { id: termId }, relations: ['session'] });
        if (!term) {
            throw new Error('Term index records missing.');
        }

        const expenses = await expenseRepository.find({ where: { term: { id: termId } } });

        const totalExpenses = expenses
            .filter((e) => e.status === 'APPROVED')
            .reduce((sum, e) => sum + parseFloat(e.amount.toString()), 0);

        const allInvoices = await invoiceRepository.find({ relations: ['term', 'term.session'] });
        const termInvoices = allInvoices.filter((i) => {
            const termDisplayName = i.term ? `${i.term.session.name} - ${i.term.name} TERM` : '';
            return termDisplayName.includes(term.name);
        });

        const totalInvoiced = termInvoices.reduce((sum, i) => sum + parseFloat(i.totalAmount.toString()), 0);

        const breakdown: Record<string, number> = {};
        for (const e of expenses) {
            if (e.status === 'APPROVED') {
                const cat = e.category;
                const amt = parseFloat(e.amount.toString());
                breakdown[cat] = (breakdown[cat] || 0) + amt;
            }
        }

        return {
            termId: Number(term.id),
            termName: term.name,
            sessionName: term.session ? term.session.name : 'UNASSIGNED',
            totalInvoicedRevenue: totalInvoiced,
            totalApprovedExpenses: totalExpenses,
            netProfitMargin: totalInvoiced - totalExpenses,
            breakdownByCategory: breakdown
        };
    }

    private mapToResponse(expense: AcademyExpense) {
        return {
            id: Number(expense.id),
            title: expense.title,
            description: expense.description || null,
            amount: parseFloat(expense.amount.toString()),
            category: expense.category,
            expenseDate: expense.expenseDate,
            status: expense.status,
            receiptUrl: expense.receiptUrl || null,
            termId: expense.term ? Number(expense.term.id) : null,
            termName: expense.term ? expense.term.name : 'N/A',
            sessionName: (expense.term && expense.term.session) ? expense.term.session.name : 'N/A'
        };
    }
}

export const academyExpenseService = new AcademyExpenseService();
