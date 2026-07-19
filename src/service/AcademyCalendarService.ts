import { AppDataSource } from '../config/database';
import { Session } from '../model/Session';
import { Term } from '../model/Term';
import { financialAuditService } from './FinancialAuditService';

export class AcademyCalendarService {
    async fetchSessionsFromCurrentForward() {
        const sessionRepository = AppDataSource.getRepository(Session);
        const allSessions = await sessionRepository.find({
            order: { startDate: 'ASC' },
            relations: ['terms']
        });

        const activeIndex = allSessions.findIndex((s) => s.isActive);
        let segments: Session[];

        if (activeIndex !== -1) {
            segments = allSessions.slice(activeIndex);
        } else {
            const today = new Date().toISOString().split('T')[0];
            segments = allSessions.filter((s) => s.endDate && s.endDate >= today);
        }

        return segments.map((s) => this.convertToDto(s));
    }

    async fetchLastFiveSessions() {
        const sessionRepository = AppDataSource.getRepository(Session);
        const allSessions = await sessionRepository.find({
            order: { startDate: 'DESC' },
            relations: ['terms']
        });

        const sliceEnd = Math.min(5, allSessions.length);
        const segments = allSessions.slice(0, sliceEnd);
        return segments.map((s) => this.convertToDto(s));
    }

    async initializeNewSession(sessionName: string, startDate: string, endDate: string, activities?: string) {
        const sessionRepository = AppDataSource.getRepository(Session);
        const termRepository = AppDataSource.getRepository(Term);

        const existing = await sessionRepository.findOne({ where: { name: sessionName } });
        if (existing) {
            throw new Error(`Session ${sessionName} has already been created.`);
        }

        const session = sessionRepository.create({
            name: sessionName,
            startDate,
            endDate,
            activitiesDescription: activities,
            isActive: false
        });

        await sessionRepository.save(session);

        const firstTerm = termRepository.create({ name: 'FIRST', isCurrentActive: false, session, startDate, endDate });
        const secondTerm = termRepository.create({ name: 'SECOND', isCurrentActive: false, session, startDate, endDate });
        const thirdTerm = termRepository.create({ name: 'THIRD', isCurrentActive: false, session, startDate, endDate });

        session.terms = [firstTerm, secondTerm, thirdTerm];
        await termRepository.save([firstTerm, secondTerm, thirdTerm]);

        return session;
    }

    async activateSessionFramework(sessionId: number) {
        const sessionRepository = AppDataSource.getRepository(Session);
        const termRepository = AppDataSource.getRepository(Term);

        const targetSession = await sessionRepository.findOne({
            where: { id: sessionId },
            relations: ['terms']
        });
        if (!targetSession) {
            throw new Error(`Session framework not found with ID: ${sessionId}`);
        }

        const activeSessions = await sessionRepository.find({ where: { isActive: true }, relations: ['terms'] });
        for (const session of activeSessions) {
            if (Number(session.id) !== sessionId) {
                session.isActive = false;
                if (session.terms) {
                    for (const t of session.terms) {
                        t.isCurrentActive = false;
                        await termRepository.save(t);
                    }
                }
                await sessionRepository.save(session);
            }
        }

        targetSession.isActive = true;
        await sessionRepository.save(targetSession);

        const firstTerm = targetSession.terms.find((t) => t.name.toLowerCase() === 'first');
        if (firstTerm) {
            firstTerm.isCurrentActive = true;
            await termRepository.save(firstTerm);
            await financialAuditService.generateTuitionInvoicesForTerm(firstTerm);
        }
    }

    async deactivateSessionFramework(sessionId: number) {
        const sessionRepository = AppDataSource.getRepository(Session);
        const termRepository = AppDataSource.getRepository(Term);

        const targetSession = await sessionRepository.findOne({
            where: { id: sessionId },
            relations: ['terms']
        });
        if (!targetSession) {
            throw new Error(`Session framework not found with ID: ${sessionId}`);
        }

        targetSession.isActive = false;
        if (targetSession.terms) {
            for (const t of targetSession.terms) {
                t.isCurrentActive = false;
                await termRepository.save(t);
            }
        }
        await sessionRepository.save(targetSession);
    }

    async activateTermWindow(termId: number) {
        const termRepository = AppDataSource.getRepository(Term);

        const targetTerm = await termRepository.findOne({ where: { id: termId } });
        if (!targetTerm) {
            throw new Error(`Term index context not found with ID: ${termId}`);
        }

        const activeTerm = await termRepository.findOne({ where: { isCurrentActive: true } });
        if (activeTerm) {
            activeTerm.isCurrentActive = false;
            await termRepository.save(activeTerm);
        }

        targetTerm.isCurrentActive = true;
        const newTerm = await termRepository.save(targetTerm);

        await financialAuditService.generateTuitionInvoicesForTerm(newTerm);
    }

    async deactivateTermWindow(termId: number) {
        const termRepository = AppDataSource.getRepository(Term);

        const targetTerm = await termRepository.findOne({ where: { id: termId } });
        if (!targetTerm) {
            throw new Error(`Term index context not found with ID: ${termId}`);
        }

        targetTerm.isCurrentActive = false;
        await termRepository.save(targetTerm);
    }

    async updateTermTimelineBounds(termId: number, startDate: string, endDate: string) {
        const termRepository = AppDataSource.getRepository(Term);

        const targetTerm = await termRepository.findOne({ where: { id: termId } });
        if (!targetTerm) {
            throw new Error(`Term target context not found with ID: ${termId}`);
        }

        if (startDate > endDate) {
            throw new Error('Start date boundaries cannot exceed terminal end date values.');
        }

        targetTerm.startDate = startDate;
        targetTerm.endDate = endDate;
        await termRepository.save(targetTerm);
    }

    private convertToDto(session: Session) {
        const terms = (session.terms || []).map((term) => ({
            id: Number(term.id),
            name: term.name,
            isCurrentActive: term.isCurrentActive,
            startDate: term.startDate,
            endDate: term.endDate
        }));

        return {
            id: Number(session.id),
            name: session.name,
            startDate: session.startDate,
            endDate: session.endDate,
            isActive: session.isActive,
            activitiesDescription: session.activitiesDescription || null,
            terms
        };
    }
}

export const academyCalendarService = new AcademyCalendarService();
