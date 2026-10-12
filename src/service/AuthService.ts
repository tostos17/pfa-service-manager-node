import { AppDataSource } from '../config/database';
import { User } from '../model/User';
import { Role } from '../model/Role';
import { Coach } from '../model/Coach';
import { Player } from '../model/Player';
import { PlayerProfile, DominantFoot, Position } from '../model/PlayerProfile';
import { Account } from '../model/Account';
import { AppError } from '../error/AppError';
import { Admin } from '../model/Admin';
import { Director } from '../model/Director';
import { Parent } from '../model/Parent';
import { storageService } from './StorageService';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';

export class AuthService {
    private defaultPass = 'Access123';

    async register(request: any) {
        const userRepository = AppDataSource.getRepository(User);
        const roleRepository = AppDataSource.getRepository(Role);

        const existingUser = await userRepository.findOne({ where: { username: request.username } });
        if (existingUser) {
            throw new Error('Username is already taken');
        }

        const assignedRoles: Role[] = [];
        for (const roleName of request.roles) {
            const formattedName = roleName.toUpperCase().startsWith('ROLE_')
                ? roleName.toUpperCase()
                : `ROLE_${roleName.toUpperCase()}`;

            const role = await roleRepository.findOne({ where: { name: formattedName } });
            if (!role) {
                throw new Error(`Role not found in system: ${roleName}`);
            }
            assignedRoles.push(role);
        }

        const hashedPassword = await bcrypt.hash(request.password, 10);
        const user = userRepository.create({
            username: request.username,
            password: hashedPassword,
            roles: assignedRoles,
            enabled: true,
            requirePasswordChange: false
        });

        await userRepository.save(user);

        const token = jwt.sign(
            { id: user.id, username: user.username, roles: user.roles.map((r) => r.name) },
            process.env.JWT_SECRET || 'supersecretkeyformigratedpfaapp',
            { expiresIn: '24h' }
        );

        return {
            token,
            username: user.username
        };
    }

    async login(request: any) {
        const userRepository = AppDataSource.getRepository(User);
        const user = await userRepository.findOne({
            where: { username: request.username },
            relations: ['roles']
        });

        if (!user) {
            throw new AppError('Bad credentials', 401, 'Unauthorized');
        }

        const isMatch = await bcrypt.compare(request.password, user.password);
        if (!isMatch) {
            throw new AppError('Bad credentials', 401, 'Unauthorized');
        }

        if (!user.enabled) {
            throw new AppError('User account is disabled', 401, 'Unauthorized');
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, roles: user.roles.map((r) => r.name) },
            process.env.JWT_SECRET || 'supersecretkeyformigratedpfaapp',
            { expiresIn: '24h' }
        );

        return {
            token,
            username: user.username,
            requirePasswordChange: user.requirePasswordChange,
            roles: user.roles.map((r) => r.name)
        };
    }

    async registerCoach(request: any) {
        const userRepository = AppDataSource.getRepository(User);
        const roleRepository = AppDataSource.getRepository(Role);

        const existingUser = await userRepository.findOne({ where: { username: request.username } });
        if (existingUser) {
            throw new Error('Username is already taken');
        }

        const coachRole = await roleRepository.findOne({ where: { name: 'ROLE_COACH' } });
        if (!coachRole) {
            throw new Error('Coach role not initialized');
        }

        let employeeId = request.employeeId;
        if (!employeeId) {
            const nextvalResult = await AppDataSource.query("SELECT nextval('admin_id_seq') as nextval");
            const sequenceNum = parseInt(nextvalResult[0].nextval);
            const currentYear = new Date().getFullYear();
            const paddedSeqNum = String(sequenceNum).padStart(4, '0');
            employeeId = `COA-${currentYear}-${paddedSeqNum}`;
        }

        const rawPassword = request.password || this.defaultPass;
        const hashedPassword = await bcrypt.hash(rawPassword, 10);
        const user = userRepository.create({
            username: request.username,
            password: hashedPassword,
            requirePasswordChange: request.password ? false : true,
            roles: [coachRole]
        });
        const savedUser = await userRepository.save(user);

        const coach = AppDataSource.getRepository(Coach).create({
            id: Number(savedUser.id),
            firstName: request.firstName,
            lastName: request.lastName,
            email: request.email,
            phone: request.phone || '',
            specialization: request.specialization || null,
            employeeId: employeeId,
            licenseLevel: request.licenseLevel || null,
            user: savedUser
        });
        await AppDataSource.getRepository(Coach).save(coach);

        const token = jwt.sign(
            { id: savedUser.id, username: savedUser.username, roles: savedUser.roles.map((r) => r.name) },
            process.env.JWT_SECRET || 'supersecretkeyformigratedpfaapp',
            { expiresIn: '24h' }
        );

        return { token, username: savedUser.username, employeeId, coach };
    }

    async registerPlayer(request: any, fileBuffer?: Buffer, fileName?: string, fileMime?: string) {
        const userRepository = AppDataSource.getRepository(User);
        const roleRepository = AppDataSource.getRepository(Role);
        const parentRepository = AppDataSource.getRepository(Parent);

        this.validateHealthEntries(request.healthy, request.healthConcernDescription);

        const existingUser = await userRepository.findOne({ where: { username: request.username } });
        if (existingUser) {
            throw new Error('Username is already taken');
        }

        const playerRole = await roleRepository.findOne({ where: { name: 'ROLE_PLAYER' } });
        if (!playerRole) {
            throw new Error('Player role not initialized');
        }

        let linkedParent;
        if (request.parentId) {
            linkedParent = await parentRepository.findOne({ where: { id: parseInt(request.parentId) } });
            if (!linkedParent) {
                throw new Error('Parent profile not found');
            }
        }

        const uniquePlayerId = randomUUID();
        let uploadedUrl = '';
        if (fileBuffer && fileName && fileMime) {
            uploadedUrl = await storageService.uploadFile(fileBuffer, fileName, fileMime, 'passports');
        }

        const hashedPassword = await bcrypt.hash(this.defaultPass, 10);
        const user = userRepository.create({
            username: request.username,
            password: hashedPassword,
            roles: [playerRole],
            requirePasswordChange: true
        });
        const savedUser = await userRepository.save(user);

        const player = AppDataSource.getRepository(Player).create({
            id: Number(savedUser.id),
            playerId: uniquePlayerId,
            firstName: request.firstName,
            middleName: request.middleName,
            lastName: request.lastName,
            email: request.email,
            phone: request.phone,
            dateOfBirth: request.dateOfBirth,
            address: request.address,
            stateOfOrigin: request.stateOfOrigin,
            country: request.country,
            healthy: request.healthy === 'true' || request.healthy === true,
            healthConcernDescription: request.healthConcernDescription,
            passportUrl: uploadedUrl || undefined,
            parent: linkedParent,
            user: savedUser,
            registrationDate: new Date().toISOString().split('T')[0]
        });
        const savedPlayer = await AppDataSource.getRepository(Player).save(player);

        const initialProfile = AppDataSource.getRepository(PlayerProfile).create({
            player_id: Number(savedPlayer.id),
            heightCm: parseFloat(request.heightCm || '0'),
            weightKg: parseFloat(request.weightKg || '0'),
            dominantFoot: (request.dominantFoot || 'RIGHT').toUpperCase() as DominantFoot,
            player: savedPlayer,
            active: true,
            position: Position.FORWARD // Default fallback
        });
        await AppDataSource.getRepository(PlayerProfile).save(initialProfile);

        const shortRandom = randomUUID().substring(0, 4).toUpperCase();
        const firstInitial = player.firstName.substring(0, 1).toUpperCase();
        const cleanedLastName = player.lastName.replace(/\s+/g, '').toUpperCase();
        const currentYear = new Date().getFullYear();
        const personalizedAccountId = `PFA-${cleanedLastName}-${firstInitial}-${currentYear}-${shortRandom}`;

        const initialAccount = AppDataSource.getRepository(Account).create({
            accountId: personalizedAccountId,
            status: true,
            player: savedPlayer,
            broughtForward: 0,
            discounted: request.discounted === 'true' || request.discounted === true,
            percentDiscount: (request.discounted === 'true' || request.discounted === true) ? parseFloat(request.percentDiscount || '0') : 0.0
        });
        await AppDataSource.getRepository(Account).save(initialAccount);

        return { message: `User ${user.username} successfully registered` };
    }

    private validateHealthEntries(healthy: any, healthConcernDescription: any) {
        if ((healthy === 'false' || healthy === false) && (!healthConcernDescription || healthConcernDescription.trim() === '')) {
            throw new Error("Kindly describe the player's health concerns");
        }
    }

    async registerAdmin(request: any) {
        const userRepository = AppDataSource.getRepository(User);
        const roleRepository = AppDataSource.getRepository(Role);

        const existingUser = await userRepository.findOne({ where: { username: request.username } });
        if (existingUser) {
            throw new Error('Username is already taken');
        }

        const adminRole = await roleRepository.findOne({ where: { name: 'ROLE_ADMIN' } });
        if (!adminRole) {
            throw new Error('Admin role not initialized');
        }

        const nextvalResult = await AppDataSource.query("SELECT nextval('admin_id_seq') as nextval");
        const sequenceNum = parseInt(nextvalResult[0].nextval);
        const currentYear = new Date().getFullYear();
        const paddedSeqNum = String(sequenceNum).padStart(4, '0');
        const employeeId = `ADM-${currentYear}-${paddedSeqNum}`;

        const hashedPassword = await bcrypt.hash(this.defaultPass, 10);
        const user = userRepository.create({
            username: request.username,
            password: hashedPassword,
            requirePasswordChange: true,
            roles: [adminRole]
        });
        const savedUser = await userRepository.save(user);

        const admin = AppDataSource.getRepository(Admin).create({
            id: Number(savedUser.id),
            firstName: request.firstName,
            lastName: request.lastName,
            email: request.email,
            employeeId: employeeId,
            user: savedUser
        });
        await AppDataSource.getRepository(Admin).save(admin);

        const token = jwt.sign(
            { id: savedUser.id, username: savedUser.username, roles: savedUser.roles.map((r) => r.name) },
            process.env.JWT_SECRET || 'supersecretkeyformigratedpfaapp',
            { expiresIn: '24h' }
        );

        return { token, username: savedUser.username };
    }

    async registerDirector(request: any) {
        const userRepository = AppDataSource.getRepository(User);
        const roleRepository = AppDataSource.getRepository(Role);

        const existingUser = await userRepository.findOne({ where: { username: request.username } });
        if (existingUser) {
            throw new Error('Username is already taken');
        }

        const directorRole = await roleRepository.findOne({ where: { name: 'ROLE_DIRECTOR' } });
        if (!directorRole) {
            throw new Error('Director role not initialized');
        }

        let employeeId = request.employeeId;
        if (!employeeId) {
            const nextvalResult = await AppDataSource.query("SELECT nextval('admin_id_seq') as nextval");
            const sequenceNum = parseInt(nextvalResult[0].nextval);
            const currentYear = new Date().getFullYear();
            const paddedSeqNum = String(sequenceNum).padStart(4, '0');
            employeeId = `DIR-${currentYear}-${paddedSeqNum}`;
        }

        const rawPassword = request.password || this.defaultPass;
        const hashedPassword = await bcrypt.hash(rawPassword, 10);
        const user = userRepository.create({
            username: request.username,
            password: hashedPassword,
            requirePasswordChange: request.password ? false : true,
            roles: [directorRole]
        });
        const savedUser = await userRepository.save(user);

        const director = AppDataSource.getRepository(Director).create({
            id: Number(savedUser.id),
            firstName: request.firstName,
            lastName: request.lastName,
            email: request.email,
            employeeId: employeeId,
            user: savedUser
        });
        await AppDataSource.getRepository(Director).save(director);

        const token = jwt.sign(
            { id: savedUser.id, username: savedUser.username, roles: savedUser.roles.map((r) => r.name) },
            process.env.JWT_SECRET || 'supersecretkeyformigratedpfaapp',
            { expiresIn: '24h' }
        );

        return { message: 'Director registered successfully', token, username: savedUser.username, employeeId, director };
    }

    async registerParent(request: any) {
        const userRepository = AppDataSource.getRepository(User);
        const roleRepository = AppDataSource.getRepository(Role);

        const existingUser = await userRepository.findOne({ where: { username: request.username } });
        if (existingUser) {
            throw new Error('Username is already taken');
        }

        const parentRole = await roleRepository.findOne({ where: { name: 'ROLE_PARENT' } });
        if (!parentRole) {
            throw new Error('Parent role structure not initialized in database');
        }

        const hashedPassword = await bcrypt.hash(this.defaultPass, 10);
        const user = userRepository.create({
            username: request.username,
            password: hashedPassword,
            requirePasswordChange: true,
            roles: [parentRole]
        });
        const savedUser = await userRepository.save(user);

        const parent = AppDataSource.getRepository(Parent).create({
            id: Number(savedUser.id),
            title: request.title,
            firstName: request.firstName,
            lastName: request.lastName,
            phone: request.phone,
            email: request.email,
            address: request.address,
            user: savedUser
        });
        await AppDataSource.getRepository(Parent).save(parent);

        return { message: `Create user ${user.username} successfully` };
    }

    async updateParent(id: number, request: any) {
        const parentRepository = AppDataSource.getRepository(Parent);
        const userRepository = AppDataSource.getRepository(User);

        const parent = await parentRepository.findOne({ where: { id }, relations: ['user'] });
        if (!parent) {
            throw new Error(`Parent profile not found for ID: ${id}`);
        }

        const user = parent.user;

        if (user.username !== request.username) {
            const existingUsername = await userRepository.findOne({ where: { username: request.username } });
            if (existingUsername) {
                throw new Error('Username is already taken');
            }
            user.username = request.username;
        }

        if (parent.email.toLowerCase() !== request.email.toLowerCase()) {
            const existingEmail = await parentRepository.findOne({
                where: { email: request.email }
            });
            if (existingEmail && existingEmail.id !== id) {
                throw new Error('Email is already taken by another profile');
            }
        }

        parent.title = request.title;
        parent.firstName = request.firstName;
        parent.lastName = request.lastName;
        parent.phone = request.phone;
        parent.email = request.email;
        parent.address = request.address;

        await userRepository.save(user);
        await parentRepository.save(parent);

        return { message: `Updated parent ${user.username} successfully` };
    }

    async forceChangePassword(userId: number, request: any) {
        const userRepository = AppDataSource.getRepository(User);
        const user = await userRepository.findOne({
            where: { id: userId }
        });

        if (!user) {
            throw new AppError('User not found', 404, 'Not Found');
        }

        const isMatch = await bcrypt.compare(request.oldPassword, user.password);
        if (!isMatch) {
            throw new AppError('Incorrect temporary password', 400, 'Bad Request');
        }

        const hashedPassword = await bcrypt.hash(request.newPassword, 10);
        user.password = hashedPassword;
        user.requirePasswordChange = false;

        await userRepository.save(user);
        return { message: 'Password updated successfully' };
    }
}

export const authService = new AuthService();
