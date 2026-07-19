import { AppDataSource } from '../config/database';
import { Player } from '../model/Player';
import { User } from '../model/User';
import { storageService } from './StorageService';

export class PlayerDataService {
    async updatePlayerPassport(playerId: string, fileBuffer: Buffer, fileName: string, fileMime: string) {
        const playerRepository = AppDataSource.getRepository(Player);
        const player = await playerRepository.findOne({ where: { playerId } });
        if (!player) {
            throw new Error(`Update failed: Player profile not found with ID: ${playerId}`);
        }

        const newPassportUrl = await storageService.uploadFile(fileBuffer, fileName, fileMime, 'passports');

        player.passportUrl = newPassportUrl;
        await playerRepository.save(player);

        return newPassportUrl;
    }

    async getPlayers(pageNumber: number = 0, pageSize: number = 20) {
        const playerRepository = AppDataSource.getRepository(Player);
        const [players, total] = await playerRepository.findAndCount({
            relations: ['parent'],
            order: { registrationDate: 'DESC' },
            skip: pageNumber * pageSize,
            take: pageSize
        });

        const content = players.map((player) => ({
            id: Number(player.id),
            playerId: player.playerId,
            firstName: player.firstName,
            middleName: player.middleName,
            lastName: player.lastName,
            email: player.email || null,
            phone: player.phone || null,
            dateOfBirth: player.dateOfBirth,
            parentName: player.parent ? `${player.parent.firstName} ${player.parent.lastName}` : null,
            healthy: player.healthy,
            healthConcernDescription: player.healthConcernDescription || null,
            passportUrl: player.passportUrl || null,
            status: player.status
        }));

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

    async updatePlayerStatus(id: number, status: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED') {
        return await AppDataSource.transaction(async (transactionManager) => {
            const playerRepository = transactionManager.getRepository(Player);
            const userRepository = transactionManager.getRepository(User);

            const player = await playerRepository.findOne({ where: { id } });
            if (!player) {
                throw new Error(`Player not found with ID: ${id}`);
            }

            player.status = status;
            await playerRepository.save(player);

            const user = await userRepository.findOne({ where: { id } });
            if (user) {
                user.enabled = (status === 'ACTIVE');
                await userRepository.save(user);
            }

            return player;
        });
    }
}

export const playerDataService = new PlayerDataService();
