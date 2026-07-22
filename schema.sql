-- PFA Database Consolidated Schema (V1 - V9 Migration Baseline)

-- ========================================================
-- Migration: V1__baseline_academy_schema.sql
-- ========================================================
-- =============================================================================
-- FLYWAY MAIN DATABASE MIGRATION SCRIPT
-- Platform Target: PostgreSQL
-- Focus: Unified Enterprise Schema (Security, Financials, Metrics)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- SECTION 1: CORE SECURITY, STRUCTURAL, AND IDENTITY DOMAINS
-- -----------------------------------------------------------------------------
CREATE SEQUENCE admin_id_seq START WITH 1 INCREMENT BY 1;

CREATE TABLE roles (
                       id BIGSERIAL PRIMARY KEY,
                       name VARCHAR(255) NOT NULL UNIQUE
);

insert into roles values(1, 'ROLE_ADMIN');

CREATE TABLE users (
                       id BIGSERIAL PRIMARY KEY,
                       username VARCHAR(255) NOT NULL UNIQUE,
                       password VARCHAR(255) NOT NULL,
                       enabled BOOLEAN NOT NULL DEFAULT TRUE,
                       require_password_change BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE user_roles (
                            user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                            role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
                            PRIMARY KEY (user_id, role_id)
);

CREATE TABLE parents (
                         id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, -- Normalised to id for Hibernate MapsId compatibility
                         title VARCHAR(20),
                         first_name VARCHAR(50) NOT NULL,
                         last_name VARCHAR(50) NOT NULL,
                         phone VARCHAR(20) NOT NULL,
                         email VARCHAR(100) NOT NULL UNIQUE,
                         address TEXT NOT NULL,
                         registration_date TIMESTAMP WITHOUT TIME ZONE NOT NULL
);

CREATE TABLE players (
                         id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                         player_id VARCHAR(255) NOT NULL,
                         first_name VARCHAR(50) NOT NULL,
                         middle_name VARCHAR(50) NOT NULL,
                         last_name VARCHAR(50) NOT NULL,
                         email VARCHAR(100) UNIQUE,
                         phone_number VARCHAR(50),
                         date_of_birth DATE NOT NULL,
                         address VARCHAR(100),
                         state_of_origin VARCHAR(255),
                         country VARCHAR(255),
                         healthy BOOLEAN NOT NULL,
                         health_concerns TEXT,
                         passport_url VARCHAR(500),
                         parent_id BIGINT REFERENCES parents(id) ON DELETE SET NULL,
                         registration_date DATE NOT NULL
);

CREATE TABLE player_profiles (
                                 player_id BIGINT PRIMARY KEY,
                                 height_cm DOUBLE PRECISION NOT NULL,
                                 weight_kg DOUBLE PRECISION NOT NULL,
                                 dominant_foot VARCHAR(15) NOT NULL,
                                 position VARCHAR(30) NOT NULL,
                                 preferred_jersey_number INT,
                                 biography TEXT,
                                 category VARCHAR(255),
                                 active BOOLEAN NOT NULL DEFAULT TRUE,

                                 CONSTRAINT fk_player_profiles_player FOREIGN KEY (player_id)
                                     REFERENCES players(id) ON DELETE CASCADE
);

CREATE TABLE categories (
                            id BIGSERIAL PRIMARY KEY,
                            name VARCHAR(255) NOT NULL UNIQUE,
                            description VARCHAR(255)
);

CREATE TABLE admins (
                        id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, -- Normalised to id for Hibernate MapsId compatibility
                        first_name VARCHAR(50) NOT NULL,
                        last_name VARCHAR(50) NOT NULL,
                        email VARCHAR(100) NOT NULL UNIQUE,
                        employee_id VARCHAR(30) NOT NULL UNIQUE
);

CREATE TABLE coaches (
                         id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, -- Normalised to id for Hibernate MapsId compatibility
                         first_name VARCHAR(50) NOT NULL,
                         last_name VARCHAR(50) NOT NULL,
                         email VARCHAR(100) NOT NULL UNIQUE,
                         phone VARCHAR(20) NOT NULL,
                         specialization VARCHAR(255),
                         employee_id VARCHAR(30) NOT NULL UNIQUE,
                         license_level VARCHAR(255)
);

-- -----------------------------------------------------------------------------
-- SECTION 2: ACADEMIC TIMELINE & FINANCIAL SUBSYSTEMS
-- -----------------------------------------------------------------------------
CREATE TABLE sessions (
                          id BIGSERIAL PRIMARY KEY,
                          name VARCHAR(20) NOT NULL UNIQUE,
                          start_date DATE NOT NULL,
                          end_date DATE NOT NULL,
                          is_active BOOLEAN NOT NULL DEFAULT FALSE,
                          activities_description TEXT
);

CREATE TABLE terms (
                       id BIGSERIAL PRIMARY KEY,
                       session_id BIGINT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
                       name VARCHAR(30) NOT NULL,
                       start_date DATE,
                       end_date DATE,
                       is_current_active BOOLEAN NOT NULL DEFAULT FALSE,
                       syllabus_url VARCHAR(500),
                       matches_description TEXT,
                       assessment_description TEXT,
                       results_summary TEXT,
                       opening_account_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
                       closing_account_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00
);

CREATE TABLE accounts (
                          id BIGINT PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE, -- Normalised to id for Hibernate MapsId compatibility
                          account_id VARCHAR(100) NOT NULL UNIQUE,
                          status BOOLEAN NOT NULL DEFAULT TRUE,
                          brought_forward NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
                          discounted BOOLEAN NOT NULL DEFAULT FALSE,
                          percent_discount DOUBLE PRECISION NOT NULL DEFAULT 0.0
);

CREATE TABLE invoices (
                          id BIGSERIAL PRIMARY KEY,
                          account_player_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
                          term_id BIGINT NOT NULL REFERENCES terms(id) ON DELETE RESTRICT,
                          total_amount NUMERIC(12, 2) NOT NULL,
                          amount_due NUMERIC(12, 2) NOT NULL,
                          category VARCHAR(50) NOT NULL,
                          description TEXT,
                          status VARCHAR(30) NOT NULL DEFAULT 'UNSETTLED',
                          created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE payments (
                          id BIGSERIAL PRIMARY KEY,
                          account_player_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
                          term_id BIGINT NOT NULL REFERENCES terms(id) ON DELETE RESTRICT,
                          amount_paid NUMERIC(12, 2) NOT NULL,
                          reference_number VARCHAR(100) NOT NULL UNIQUE,
                          payment_date TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE payment_allocations (
                                     id BIGSERIAL PRIMARY KEY,
                                     payment_id BIGINT NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
                                     invoice_id BIGINT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
                                     amount_allocated NUMERIC(38, 2) NOT NULL,
                                     allocated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL
);

-- -----------------------------------------------------------------------------
-- SECTION 3: MATCH CENTER AND POLYMORPHIC EVENT LAYERS
-- -----------------------------------------------------------------------------
CREATE TABLE matches (
                         id BIGSERIAL PRIMARY KEY,
                         category_id BIGINT REFERENCES categories(id) ON DELETE SET NULL,
                         opponent_name VARCHAR(255) NOT NULL,
                         date DATE NOT NULL,
                         time TIME WITHOUT TIME ZONE NOT NULL,
                         venue VARCHAR(255) NOT NULL,
                         started BOOLEAN NOT NULL DEFAULT FALSE,
                         is_live BOOLEAN NOT NULL DEFAULT FALSE,
                         ended BOOLEAN NOT NULL DEFAULT FALSE,
                         is_home_match BOOLEAN NOT NULL,
                         is_away_match BOOLEAN NOT NULL,
                         home_team_score INTEGER NOT NULL DEFAULT 0,
                         away_team_score INTEGER NOT NULL DEFAULT 0,
                         match_type VARCHAR(55) NOT NULL,
                         half_duration INTEGER NOT NULL DEFAULT 45,
                         is_extra_time BOOLEAN NOT NULL DEFAULT FALSE,
                         is_penalty_shootout BOOLEAN NOT NULL DEFAULT FALSE,
                         home_team_penalty_score INTEGER DEFAULT 0,
                         away_team_penalty_score INTEGER DEFAULT 0
);

CREATE TABLE goals (
                       id BIGSERIAL PRIMARY KEY,
                       match_id BIGINT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
                       match_time VARCHAR(255) NOT NULL,
                       scorer_id BIGINT NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
                       goal_count INTEGER,
                       is_freekick BOOLEAN NOT NULL DEFAULT FALSE,
                       is_penalty BOOLEAN NOT NULL DEFAULT FALSE,
                       is_own_goal BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE substitutions (
                               id BIGSERIAL PRIMARY KEY,
                               match_id BIGINT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
                               match_time VARCHAR(255) NOT NULL,
                               player_in_id BIGINT NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
                               player_out_id BIGINT NOT NULL REFERENCES players(id) ON DELETE RESTRICT
);

-- Polymorphic Root Base Table (JOINED Strategy)
CREATE TABLE match_events (
                              id BIGSERIAL PRIMARY KEY,
                              match_id BIGINT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
                              match_time VARCHAR(255) NOT NULL,
                              event_type VARCHAR(255) NOT NULL
);

-- Sub-Class Extension Table: State Mutations
CREATE TABLE events_generic (
                                id BIGINT PRIMARY KEY REFERENCES match_events(id) ON DELETE CASCADE,
                                state_name VARCHAR(255) NOT NULL
);

-- Sub-Class Extension Table: Free Kick Highlights
CREATE TABLE events_freekick (
                                 id BIGINT PRIMARY KEY REFERENCES match_events(id) ON DELETE CASCADE,
                                 dangerous_position BOOLEAN NOT NULL,
                                 taker_id BIGINT REFERENCES players(id) ON DELETE SET NULL
);

-- Element Collection Mappings & Match Lineups
CREATE TABLE match_starting_lineup (
                                       match_id BIGINT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
                                       player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
                                       PRIMARY KEY (match_id, player_id)
);

CREATE TABLE match_photos (
                              match_id BIGINT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
                              photo_url VARCHAR(500) NOT NULL
);

CREATE TABLE match_videos (
                              match_id BIGINT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
                              video_url VARCHAR(500) NOT NULL
);

-- -----------------------------------------------------------------------------
-- SECTION 4: ATTENDANCE TRACKING MATRIX
-- -----------------------------------------------------------------------------
CREATE TABLE attendance_events (
                                   id BIGSERIAL PRIMARY KEY,
                                   event_date DATE NOT NULL,
                                   event_type VARCHAR(30) NOT NULL,
                                   description VARCHAR(255)
);

CREATE TABLE player_attendance_lines (
                                         id BIGSERIAL PRIMARY KEY,
                                         event_id BIGINT NOT NULL REFERENCES attendance_events(id) ON DELETE CASCADE,
                                         player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
                                         status VARCHAR(20) NOT NULL,
                                         remarks VARCHAR(255)
);

-- =========================================================================
-- INVOICE PAYMENTS (TARGETED PAYMENT ALLOCATIONS)
-- =========================================================================
CREATE TABLE invoice_payments (
                                  id BIGSERIAL PRIMARY KEY,
                                  payment_id BIGINT NOT NULL,
                                  invoice_id BIGINT NOT NULL,
                                  amount_paid NUMERIC(12, 2) NOT NULL, -- <-- Changed from amount_allocated to match your entity
                                  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

                                  CONSTRAINT fk_invoice_payments_payment FOREIGN KEY (payment_id)
                                      REFERENCES payments (id) ON DELETE CASCADE,
                                  CONSTRAINT fk_invoice_payments_invoice FOREIGN KEY (invoice_id)
                                      REFERENCES invoices (id) ON DELETE CASCADE,
                                  CONSTRAINT uq_payment_invoice UNIQUE (payment_id, invoice_id)
);

-- -----------------------------------------------------------------------------
-- SECTION 5: PERFORMANCE OPTIMIZATION INDEX REGISTRY
-- -----------------------------------------------------------------------------
CREATE INDEX idx_parents_email ON parents(email);
CREATE INDEX idx_players_parent ON players(parent_id);
CREATE INDEX idx_terms_session ON terms(session_id);
CREATE INDEX idx_invoices_account ON invoices(account_player_id);
CREATE INDEX idx_payments_reference ON payments(reference_number);
CREATE INDEX idx_allocations_payment ON payment_allocations(payment_id);
CREATE INDEX idx_allocations_invoice ON payment_allocations(invoice_id);
CREATE INDEX idx_substitutions_match ON substitutions(match_id);
CREATE INDEX idx_match_events_root ON match_events(match_id);
CREATE INDEX idx_attendance_lines_event ON player_attendance_lines(event_id);
CREATE INDEX idx_invoice_payments_payment ON invoice_payments(payment_id);
CREATE INDEX idx_invoice_payments_invoice ON invoice_payments(invoice_id);

-- ========================================================
-- Migration: V2__expense_management_schema.sql
-- ========================================================
CREATE TYPE expense_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE academy_expenses (
                                  id BIGSERIAL PRIMARY KEY,
                                  title VARCHAR(150) NOT NULL,
                                  description TEXT,
                                  amount NUMERIC(12, 2) NOT NULL,
                                  category VARCHAR(50) NOT NULL, -- e.g., 'EQUIPMENT', 'FACILITY_MAINTENANCE', 'LOGISTICS', 'SALARIES'
                                  expense_date DATE NOT NULL,
                                  status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
                                  receipt_url VARCHAR(500),
                                  term_id BIGINT NOT NULL,
                                  recorded_by_admin_id BIGINT NOT NULL,
                                  approved_by_admin_id BIGINT,
                                  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                                  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

                                  CONSTRAINT fk_expenses_term FOREIGN KEY (term_id) REFERENCES terms(id) ON DELETE RESTRICT,
                                  CONSTRAINT fk_expenses_recorder FOREIGN KEY (recorded_by_admin_id) REFERENCES users(id),
                                  CONSTRAINT fk_expenses_approver FOREIGN KEY (approved_by_admin_id) REFERENCES users(id)
);

CREATE INDEX idx_expenses_term ON academy_expenses(term_id);
CREATE INDEX idx_expenses_status ON academy_expenses(status);
CREATE INDEX idx_expenses_date ON academy_expenses(expense_date);

-- ========================================================
-- Migration: V3__create_info_hub.sql
-- ========================================================
-- =============================================================================
-- INFORMATION MANAGEMENT SERVICE REGISTRY SCHEMA
-- Focus: Unified Announcement Hub Engine with JSONB Schema Flexibility
-- =============================================================================

CREATE TYPE announcement_type AS ENUM ('UPCOMING_MATCH', 'RESUMPTION', 'SUMMER_CAMP', 'GENERAL_NOTICE');
CREATE TYPE publication_status AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

CREATE TABLE information_hub (
                                 id BIGSERIAL PRIMARY KEY,
                                 title VARCHAR(255) NOT NULL,
                                 summary TEXT,
                                 content TEXT NOT NULL,
                                 info_type announcement_type NOT NULL,
                                 status publication_status NOT NULL DEFAULT 'DRAFT',
                                 cover_image_url VARCHAR(512),
                                 publish_at TIMESTAMP WITH TIME ZONE NOT NULL,
                                 expires_at TIMESTAMP WITH TIME ZONE,
                                 created_by_admin_id BIGINT NOT NULL,
                                 attributes JSONB, -- Dynamic type-safe payload mapping
                                 created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                                 updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Performance Optimization Index Registry for Public Querying Engines
CREATE INDEX idx_info_hub_query ON information_hub(status, info_type, publish_at DESC);
CREATE INDEX idx_info_hub_jsonb ON information_hub USING gin (attributes);

-- ========================================================
-- Migration: V4__create_directors_table.sql
-- ========================================================
CREATE TABLE directors (
                           id BIGINT PRIMARY KEY,
                           first_name VARCHAR(50) NOT NULL,
                           last_name VARCHAR(50) NOT NULL,
                           email VARCHAR(100) NOT NULL UNIQUE,
                           employee_id VARCHAR(30) NOT NULL UNIQUE,

    -- Constraint ensuring the ID matches the primary key of the users table
                           CONSTRAINT fk_directors_user FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE
);

-- ========================================================
-- Migration: V5__add_live_match_events.sql
-- ========================================================
-- V5__add_live_match_events.sql
-- Create CardEvent and CornerEvent tables, and alter FreekickEvent table

CREATE TABLE events_card (
                             id BIGINT PRIMARY KEY REFERENCES match_events(id) ON DELETE CASCADE,
                             player_id BIGINT REFERENCES players(id) ON DELETE SET NULL,
                             card_type VARCHAR(50) NOT NULL,
                             team VARCHAR(50) NOT NULL
);

CREATE TABLE events_corner (
                               id BIGINT PRIMARY KEY REFERENCES match_events(id) ON DELETE CASCADE,
                               team VARCHAR(50) NOT NULL
);

ALTER TABLE events_freekick ADD COLUMN team VARCHAR(50);


-- ========================================================
-- Migration: V6__add_match_time_tracking.sql
-- ========================================================
-- V6__add_match_time_tracking.sql
-- Add status and current_half_start to matches table

ALTER TABLE matches ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT 'SCHEDULED';
ALTER TABLE matches ADD COLUMN current_half_start TIMESTAMP WITH TIME ZONE;


-- ========================================================
-- Migration: V7__redesign_player_profile_category.sql
-- ========================================================
-- Reset the sequence for categories in case of manual insert out-of-sync
SELECT setval(pg_get_serial_sequence('categories', 'id'), COALESCE(max(id), 1)) FROM categories;

-- 1. Ensure default categories from the old enum exist in the categories table
INSERT INTO categories (name, description)
VALUES ('U10', 'Under 10 Category'),
       ('U13', 'Under 13 Category'),
       ('U15', 'Under 15 Category')
ON CONFLICT (name) DO NOTHING;

-- 2. Add category_id column to player_profiles
ALTER TABLE player_profiles ADD COLUMN category_id BIGINT;

-- 3. Migrate existing category text data to category_id
UPDATE player_profiles pp
SET category_id = c.id
FROM categories c
WHERE UPPER(TRIM(pp.category)) = UPPER(TRIM(c.name));

-- 4. Add the foreign key constraint referencing the categories table
ALTER TABLE player_profiles
ADD CONSTRAINT fk_player_profiles_category FOREIGN KEY (category_id)
REFERENCES categories(id) ON DELETE SET NULL;

-- 5. Drop the old category string column
ALTER TABLE player_profiles DROP COLUMN category;


-- ========================================================
-- Migration: V8__create_training_and_attendance_schema.sql
-- ========================================================
-- Create training sessions table
CREATE TABLE training_sessions (
    id BIGSERIAL PRIMARY KEY,
    theme VARCHAR(255) NOT NULL,
    session_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    activities TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'SCHEDULED'
);

-- Create training attendance mapping table
CREATE TABLE training_attendance (
    id BIGSERIAL PRIMARY KEY,
    session_id BIGINT NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
    player_id BIGINT REFERENCES players(id) ON DELETE CASCADE,
    coach_id BIGINT REFERENCES coaches(id) ON DELETE CASCADE,
    attendee_type VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    remarks VARCHAR(255),
    CONSTRAINT chk_attendee_type CHECK (attendee_type IN ('PLAYER', 'COACH')),
    CONSTRAINT chk_status CHECK (status IN ('PRESENT', 'ABSENT', 'EXCUSED', 'INJURED')),
    CONSTRAINT chk_attendee_exclusivity CHECK (
        (player_id IS NOT NULL AND coach_id IS NULL AND attendee_type = 'PLAYER') OR
        (player_id IS NULL AND coach_id IS NOT NULL AND attendee_type = 'COACH')
    )
);


-- ========================================================
-- Migration: V9__add_player_status_column.sql
-- ========================================================
-- Add status column to players table
ALTER TABLE players ADD COLUMN status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE';


