import { Entity, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Match } from './Match';

@Entity('match_videos')
export class MatchVideo {
    @PrimaryColumn({ name: 'match_id', type: 'bigint' })
    matchId!: number;

    @PrimaryColumn({ name: 'video_url', length: 500 })
    videoUrl!: string;

    @ManyToOne(() => Match, (match) => match.videos, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'match_id' })
    match!: Match;
}
