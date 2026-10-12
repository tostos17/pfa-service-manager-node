import { AppDataSource } from '../config/database';
import { User } from '../model/User';
import { Coach } from '../model/Coach';
import { Director } from '../model/Director';
import { Admin } from '../model/Admin';
import { authService } from './AuthService';
import { AppError } from '../error/AppError';

export interface StaffDTO {
    id: number;
    username: string;
    role: 'COACH' | 'DIRECTOR' | 'ADMIN';
    roles: string[];
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    employeeId: string;
    specialization: string | null;
    licenseLevel: string | null;
    enabled: boolean;
    requirePasswordChange: boolean;
}

export class StaffService {
    async getAllStaff(filter?: { role?: string; search?: string }): Promise<StaffDTO[]> {
        const userRepository = AppDataSource.getRepository(User);

        // Fetch users who have roles associated with staff: ADMIN, DIRECTOR, COACH
        const users = await userRepository.find({
            relations: ['roles', 'coach', 'director', 'admin'],
            order: { id: 'DESC' }
        });

        const staffUsers = users.filter((u) => {
            const roleNames = (u.roles || []).map((r) => r.name.toUpperCase());
            return (
                roleNames.includes('ROLE_COACH') ||
                roleNames.includes('ROLE_DIRECTOR') ||
                roleNames.includes('ROLE_ADMIN') ||
                roleNames.includes('COACH') ||
                roleNames.includes('DIRECTOR') ||
                roleNames.includes('ADMIN')
            );
        });

        let staffList: StaffDTO[] = staffUsers.map((u) => {
            const roleNames = (u.roles || []).map((r) => r.name.toUpperCase());
            let primaryRole: 'COACH' | 'DIRECTOR' | 'ADMIN' = 'COACH';
            if (roleNames.includes('ROLE_DIRECTOR') || roleNames.includes('DIRECTOR')) {
                primaryRole = 'DIRECTOR';
            } else if (roleNames.includes('ROLE_ADMIN') || roleNames.includes('ADMIN')) {
                primaryRole = 'ADMIN';
            } else if (roleNames.includes('ROLE_COACH') || roleNames.includes('COACH')) {
                primaryRole = 'COACH';
            }

            const firstName = u.coach?.firstName || u.director?.firstName || u.admin?.firstName || '';
            const lastName = u.coach?.lastName || u.director?.lastName || u.admin?.lastName || '';
            const email = u.coach?.email || u.director?.email || u.admin?.email || '';
            const phone = u.coach?.phone || '';
            const employeeId = u.coach?.employeeId || u.director?.employeeId || u.admin?.employeeId || `STF-${u.id}`;
            const specialization = u.coach?.specialization || null;
            const licenseLevel = u.coach?.licenseLevel || null;

            return {
                id: Number(u.id),
                username: u.username,
                role: primaryRole,
                roles: roleNames,
                firstName,
                lastName,
                email,
                phone,
                employeeId,
                specialization,
                licenseLevel,
                enabled: u.enabled,
                requirePasswordChange: u.requirePasswordChange
            };
        });

        if (filter?.role) {
            const targetRole = filter.role.toUpperCase().replace('ROLE_', '');
            staffList = staffList.filter((s) => s.role === targetRole);
        }

        if (filter?.search) {
            const q = filter.search.toLowerCase();
            staffList = staffList.filter((s) =>
                `${s.firstName} ${s.lastName} ${s.username} ${s.email} ${s.employeeId} ${s.specialization || ''}`
                    .toLowerCase()
                    .includes(q)
            );
        }

        return staffList;
    }

    async getStaffById(id: number): Promise<StaffDTO> {
        const userRepository = AppDataSource.getRepository(User);
        const user = await userRepository.findOne({
            where: { id },
            relations: ['roles', 'coach', 'director', 'admin']
        });

        if (!user) {
            throw new AppError(`Staff member with ID ${id} not found`, 404, 'Not Found');
        }

        const roleNames = (user.roles || []).map((r) => r.name.toUpperCase());
        let primaryRole: 'COACH' | 'DIRECTOR' | 'ADMIN' = 'COACH';
        if (roleNames.includes('ROLE_DIRECTOR') || roleNames.includes('DIRECTOR')) {
            primaryRole = 'DIRECTOR';
        } else if (roleNames.includes('ROLE_ADMIN') || roleNames.includes('ADMIN')) {
            primaryRole = 'ADMIN';
        }

        return {
            id: Number(user.id),
            username: user.username,
            role: primaryRole,
            roles: roleNames,
            firstName: user.coach?.firstName || user.director?.firstName || user.admin?.firstName || '',
            lastName: user.coach?.lastName || user.director?.lastName || user.admin?.lastName || '',
            email: user.coach?.email || user.director?.email || user.admin?.email || '',
            phone: user.coach?.phone || '',
            employeeId: user.coach?.employeeId || user.director?.employeeId || user.admin?.employeeId || `STF-${user.id}`,
            specialization: user.coach?.specialization || null,
            licenseLevel: user.coach?.licenseLevel || null,
            enabled: user.enabled,
            requirePasswordChange: user.requirePasswordChange
        };
    }

    async createCoach(payload: any) {
        return await authService.registerCoach(payload);
    }

    async createDirector(payload: any) {
        return await authService.registerDirector(payload);
    }

    async updateStaff(id: number, payload: any): Promise<StaffDTO> {
        const userRepository = AppDataSource.getRepository(User);
        const user = await userRepository.findOne({
            where: { id },
            relations: ['roles', 'coach', 'director', 'admin']
        });

        if (!user) {
            throw new AppError(`Staff member with ID ${id} not found`, 404, 'Not Found');
        }

        if (payload.username && payload.username !== user.username) {
            const existing = await userRepository.findOne({ where: { username: payload.username } });
            if (existing && Number(existing.id) !== id) {
                throw new AppError('Username is already taken by another user', 400, 'Bad Request');
            }
            user.username = payload.username;
        }

        if (payload.enabled !== undefined) {
            user.enabled = Boolean(payload.enabled);
        }

        await userRepository.save(user);

        if (user.coach) {
            const coachRepository = AppDataSource.getRepository(Coach);
            if (payload.firstName !== undefined) user.coach.firstName = payload.firstName;
            if (payload.lastName !== undefined) user.coach.lastName = payload.lastName;
            if (payload.email !== undefined) user.coach.email = payload.email;
            if (payload.phone !== undefined) user.coach.phone = payload.phone;
            if (payload.specialization !== undefined) user.coach.specialization = payload.specialization;
            if (payload.licenseLevel !== undefined) user.coach.licenseLevel = payload.licenseLevel;
            if (payload.employeeId !== undefined) user.coach.employeeId = payload.employeeId;
            await coachRepository.save(user.coach);
        } else if (user.director) {
            const directorRepository = AppDataSource.getRepository(Director);
            if (payload.firstName !== undefined) user.director.firstName = payload.firstName;
            if (payload.lastName !== undefined) user.director.lastName = payload.lastName;
            if (payload.email !== undefined) user.director.email = payload.email;
            if (payload.employeeId !== undefined) user.director.employeeId = payload.employeeId;
            await directorRepository.save(user.director);
        } else if (user.admin) {
            const adminRepository = AppDataSource.getRepository(Admin);
            if (payload.firstName !== undefined) user.admin.firstName = payload.firstName;
            if (payload.lastName !== undefined) user.admin.lastName = payload.lastName;
            if (payload.email !== undefined) user.admin.email = payload.email;
            if (payload.employeeId !== undefined) user.admin.employeeId = payload.employeeId;
            await adminRepository.save(user.admin);
        }

        return await this.getStaffById(id);
    }

    async toggleStaffStatus(id: number, enabled?: boolean): Promise<{ id: number; enabled: boolean }> {
        const userRepository = AppDataSource.getRepository(User);
        const user = await userRepository.findOne({ where: { id } });

        if (!user) {
            throw new AppError(`Staff member with ID ${id} not found`, 404, 'Not Found');
        }

        user.enabled = enabled !== undefined ? Boolean(enabled) : !user.enabled;
        await userRepository.save(user);

        return { id: Number(user.id), enabled: user.enabled };
    }

    async deleteStaff(id: number) {
        const userRepository = AppDataSource.getRepository(User);
        const user = await userRepository.findOne({ where: { id } });

        if (!user) {
            throw new AppError(`Staff member with ID ${id} not found`, 404, 'Not Found');
        }

        // Soft delete / disable account for data integrity with historical match & attendance records
        user.enabled = false;
        await userRepository.save(user);

        return { message: 'Staff member deactivated successfully', id };
    }
}

export const staffService = new StaffService();
