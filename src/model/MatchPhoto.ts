import { Entity, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Match } from './Match';

@Entity('match_photos')
export class MatchPhoto {
    @PrimaryColumn({ name: 'match_id', type: 'bigint' })
    matchId!: number;

    @PrimaryColumn({ name: 'photo_url', length: 500 })
    photoUrl!: string;

    @ManyToOne(() => Match, (match) => match.photos, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'match_id' })
    match!: Match;
}
