import { Router } from 'express';
import { matchService } from '../service/MatchService';
import { categoryService } from '../service/CategoryService';
import { storageService } from '../service/StorageService';
import multer from 'multer';
import { authenticateJwt } from '../middleware/auth';
import { AppDataSource } from '../config/database';
import { Match } from '../model/Match';
import { MatchPhoto } from '../model/MatchPhoto';
import { MatchVideo } from '../model/MatchVideo';

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();

// Base CRUD & Queries
router.post('/', authenticateJwt, async (req, res, next) => {
    try {
        const { categoryId, ...matchData } = req.body;
        const savedMatch = await matchService.createMatch(matchData, categoryId ? parseInt(categoryId) : undefined);
        return res.json(mapToResponseDto(savedMatch));
    } catch (err) {
        next(err);
    }
});

router.get('/', async (req, res, next) => {
    try {
        const matches = await matchService.getAllMatches();
        return res.json(matches.map((m) => mapToResponseDto(m)));
    } catch (err) {
        next(err);
    }
});

router.get('/categories', async (req, res, next) => {
    try {
        const categories = await categoryService.getAllCategories();
        return res.json(categories);
    } catch (err) {
        next(err);
    }
});

router.get('/live', async (req, res, next) => {
    try {
        const matches = await matchService.getLiveMatches();
        return res.json(matches.map((m) => mapToResponseDto(m)));
    } catch (err) {
        next(err);
    }
});

router.get('/:id(\\d+)', async (req, res, next) => {
    try {
        const match = await matchService.getMatchById(parseInt(req.params.id));
        return res.json(mapToResponseDto(match));
    } catch (err) {
        next(err);
    }
});

router.put('/:id(\\d+)', authenticateJwt, async (req, res, next) => {
    try {
        const { categoryId, ...matchData } = req.body;
        const id = parseInt(req.params.id);
        const match = await matchService.createMatch({ id, ...matchData }, categoryId ? parseInt(categoryId) : undefined);
        return res.json(mapToResponseDto(match));
    } catch (err) {
        next(err);
    }
});

// Match Lifecycle Actions
router.post('/:id/start', authenticateJwt, async (req, res, next) => {
    try {
        const match = await matchService.startMatch(parseInt(req.params.id));
        return res.json(mapToResponseDto(match));
    } catch (err) {
        next(err);
    }
});

router.post('/:id/end', authenticateJwt, async (req, res, next) => {
    try {
        const match = await matchService.endMatch(parseInt(req.params.id));
        return res.json(mapToResponseDto(match));
    } catch (err) {
        next(err);
    }
});

router.post('/:id/cancel', authenticateJwt, async (req, res, next) => {
    try {
        const match = await matchService.cancelMatch(parseInt(req.params.id));
        return res.json(mapToResponseDto(match));
    } catch (err) {
        next(err);
    }
});

// Lineup and Match Events Management
router.put('/:id/lineup', authenticateJwt, async (req, res, next) => {
    try {
        const playerIds = (req.body || []).map((pid: any) => parseInt(pid));
        const match = await matchService.updateStartingLineup(parseInt(req.params.id), playerIds);
        return res.json(mapToResponseDto(match));
    } catch (err) {
        next(err);
    }
});

router.post('/:id/goals', authenticateJwt, async (req, res, next) => {
    try {
        const scorerPlayerId = parseInt(req.query.scorerPlayerId as string);
        await matchService.recordGoal(parseInt(req.params.id), req.body, scorerPlayerId);
        return res.sendStatus(200);
    } catch (err) {
        next(err);
    }
});

router.post('/:id/substitutions', authenticateJwt, async (req, res, next) => {
    try {
        const playerInId = parseInt(req.query.playerInId as string);
        const playerOutId = parseInt(req.query.playerOutId as string);
        await matchService.recordSubstitution(parseInt(req.params.id), req.body, playerInId, playerOutId);
        return res.sendStatus(200);
    } catch (err) {
        next(err);
    }
});

router.post('/:id/generic-events', authenticateJwt, async (req, res, next) => {
    try {
        await matchService.recordGenericEvent(parseInt(req.params.id), req.body);
        return res.sendStatus(200);
    } catch (err) {
        next(err);
    }
});

router.post('/:id/penalty-shootout', authenticateJwt, async (req, res, next) => {
    try {
        const homePenalties = parseInt(req.query.homePenalties as string);
        const awayPenalties = parseInt(req.query.awayPenalties as string);
        const match = await matchService.recordPenaltyScore(parseInt(req.params.id), homePenalties, awayPenalties);
        return res.json(mapToResponseDto(match));
    } catch (err) {
        next(err);
    }
});

// Media Management
router.post('/:matchId/media', authenticateJwt, upload.single('file'), async (req, res, next) => {
    try {
        const matchId = parseInt(req.params.matchId);
        const mediaType = req.body.type || req.query.type;
        const file = req.file;

        if (!file) {
            throw new Error('No file uploaded.');
        }

        const match = await matchService.getMatchById(matchId);
        const s3Url = await storageService.uploadFile(file.buffer, file.originalname, file.mimetype, `matches/${matchId}`);

        const photoRepo = AppDataSource.getRepository(MatchPhoto);
        const videoRepo = AppDataSource.getRepository(MatchVideo);

        if ('video' === String(mediaType).toLowerCase()) {
            const video = videoRepo.create({ matchId, videoUrl: s3Url, match });
            await videoRepo.save(video);
        } else {
            const photo = photoRepo.create({ matchId, photoUrl: s3Url, match });
            await photoRepo.save(photo);
        }

        const updatedMatch = await matchService.getMatchById(matchId);
        return res.json(mapToResponseDto(updatedMatch));
    } catch (err) {
        next(err);
    }
});

router.get('/:id/timeline', async (req, res, next) => {
    try {
        const result = await matchService.getMatchTimeline(parseInt(req.params.id));
        return res.json(result);
    } catch (err) {
        next(err);
    }
});

router.get('/:id/lineup/details', async (req, res, next) => {
    try {
        const result = await matchService.getMatchLineupDetails(parseInt(req.params.id));
        return res.json(result);
    } catch (err) {
        next(err);
    }
});

router.post('/:id/cards', authenticateJwt, async (req, res, next) => {
    try {
        const cardType = (req.body.cardType || req.query.cardType) as string;
        const playerId = req.query.playerId ? parseInt(req.query.playerId as string) : undefined;
        const team = (req.body.team || req.query.team) as string;
        const matchTime = (req.body.matchTime || req.query.matchTime) as string;

        await matchService.recordCard(parseInt(req.params.id), cardType, playerId, team, matchTime);
        return res.sendStatus(200);
    } catch (err) {
        next(err);
    }
});

router.post('/:id/corners', authenticateJwt, async (req, res, next) => {
    try {
        const team = (req.body.team || req.query.team) as string;
        const matchTime = (req.body.matchTime || req.query.matchTime) as string;

        await matchService.recordCorner(parseInt(req.params.id), team, matchTime);
        return res.sendStatus(200);
    } catch (err) {
        next(err);
    }
});

router.post('/:id/freekicks', authenticateJwt, async (req, res, next) => {
    try {
        const team = (req.body.team || req.query.team) as string;
        const matchTime = (req.body.matchTime || req.query.matchTime) as string;
        const takerPlayerId = req.query.takerPlayerId ? parseInt(req.query.takerPlayerId as string) : undefined;

        await matchService.recordFreekick(parseInt(req.params.id), team, matchTime, takerPlayerId);
        return res.sendStatus(200);
    } catch (err) {
        next(err);
    }
});

router.put('/:id/half-duration', authenticateJwt, async (req, res, next) => {
    try {
        const duration = parseInt((req.body.duration || req.query.duration) as string);
        const match = await matchService.updateHalfDuration(parseInt(req.params.id), duration);
        return res.json(mapToResponseDto(match));
    } catch (err) {
        next(err);
    }
});

router.post('/:id/halftime', authenticateJwt, async (req, res, next) => {
    try {
        const match = await matchService.transitionToHalftime(parseInt(req.params.id));
        return res.json(mapToResponseDto(match));
    } catch (err) {
        next(err);
    }
});

router.post('/:id/start-second-half', authenticateJwt, async (req, res, next) => {
    try {
        const match = await matchService.startSecondHalf(parseInt(req.params.id));
        return res.json(mapToResponseDto(match));
    } catch (err) {
        next(err);
    }
});

router.put('/:id/score', authenticateJwt, async (req, res, next) => {
    try {
        const { homeTeamScore, awayTeamScore, matchTime } = req.body;
        const match = await matchService.updateMatchScore(
            parseInt(req.params.id), 
            parseInt(homeTeamScore), 
            parseInt(awayTeamScore),
            matchTime
        );
        return res.json(mapToResponseDto(match));
    } catch (err) {
        next(err);
    }
});

const mapToResponseDto = (match: Match) => {
    return {
        id: Number(match.id),
        opponentName: match.opponentName,
        date: match.date,
        time: match.time,
        venue: match.venue,
        started: match.started,
        isLive: match.isLive,
        ended: match.ended,
        isHomeMatch: match.isHomeMatch,
        isAwayMatch: match.isAwayMatch,
        homeTeamScore: match.homeTeamScore,
        awayTeamScore: match.awayTeamScore,
        type: match.type,
        halfDuration: match.halfDuration,
        isExtraTime: match.isExtraTime,
        isPenaltyShootout: match.isPenaltyShootout,
        homeTeamPenaltyScore: match.homeTeamPenaltyScore,
        awayTeamPenaltyScore: match.awayTeamPenaltyScore,
        status: match.status,
        currentHalfStart: match.currentHalfStart || null,
        categoryId: match.category ? Number(match.category.id) : null,
        categoryName: match.category ? match.category.name : null,
        photoUrls: match.photos ? match.photos.map((p) => p.photoUrl) : [],
        videoUrls: match.videos ? match.videos.map((v) => v.videoUrl) : []
    };
};

export default router;
