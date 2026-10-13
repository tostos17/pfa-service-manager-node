import 'reflect-metadata';
import { AppDataSource } from './src/config/database';
import dotenv from 'dotenv';
dotenv.config();

const migration = `
CREATE TABLE IF NOT EXISTS parent_onboarding_tokens (
    id          BIGSERIAL PRIMARY KEY,
    phone       VARCHAR(20)  NOT NULL,
    access_key  VARCHAR(64)  NOT NULL UNIQUE,
    created_by  BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    used        BOOLEAN      NOT NULL DEFAULT FALSE,
    expires_at  TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    created_at  TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_pot_phone_key ON parent_onboarding_tokens(phone, access_key);
ALTER TABLE parents ADD COLUMN IF NOT EXISTS relationship VARCHAR(50);
ALTER TABLE parents ADD COLUMN IF NOT EXISTS occupation VARCHAR(100);
`;

AppDataSource.initialize()
    .then(async () => {
        console.log('Connected to database. Running V10 migration...');
        await AppDataSource.query(migration);
        console.log('V10 migration applied successfully.');
        process.exit(0);
    })
    .catch((err) => {
        console.error('Migration failed:', err.message);
        process.exit(1);
    });
