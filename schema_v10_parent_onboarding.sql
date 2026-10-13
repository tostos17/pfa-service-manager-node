-- ========================================================
-- Migration: V10__parent_onboarding.sql
-- ========================================================
-- Create the parent onboarding tokens table (director-generated access keys)
CREATE TABLE parent_onboarding_tokens (
    id          BIGSERIAL PRIMARY KEY,
    phone       VARCHAR(20)  NOT NULL,
    access_key  VARCHAR(64)  NOT NULL UNIQUE,
    created_by  BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    used        BOOLEAN      NOT NULL DEFAULT FALSE,
    expires_at  TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    created_at  TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_pot_phone_key ON parent_onboarding_tokens(phone, access_key);

-- Extend parents table with new required fields
ALTER TABLE parents ADD COLUMN relationship  VARCHAR(50);
ALTER TABLE parents ADD COLUMN occupation    VARCHAR(100);
