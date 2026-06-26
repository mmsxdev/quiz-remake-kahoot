-- =============================================================================
-- QuizDida — Supabase Schema
-- Execute no SQL Editor do Supabase: https://supabase.com/dashboard/project/_/sql
-- =============================================================================

-- Extensão para UUIDs (já disponível no Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- TABELA: quiz_sessions
-- Sessões criadas pelo coordenador
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS quiz_sessions (
  id                     uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  code                   varchar(8)  UNIQUE NOT NULL,           -- Código da sala (ex: "SENAI24")
  title                  varchar(150) NOT NULL DEFAULT 'Sessão QuizDida',
  timer_enabled          boolean     NOT NULL DEFAULT false,    -- Timer desligado por padrão
  is_active              boolean     NOT NULL DEFAULT true,     -- Ativa enquanto não encerrada
  closed_at              timestamptz,                           -- Preenchido ao encerrar
  created_at             timestamptz NOT NULL DEFAULT now(),
  current_question_index integer     NOT NULL DEFAULT 0,
  status                 varchar(20) NOT NULL DEFAULT 'lobby'
);

-- Índice para busca por código (case-insensitive)
CREATE INDEX IF NOT EXISTS idx_sessions_code ON quiz_sessions (upper(code));

-- -----------------------------------------------------------------------------
-- TABELA: quiz_players
-- Participantes de uma sessão
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS quiz_players (
  id                  uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id          uuid        NOT NULL REFERENCES quiz_sessions(id) ON DELETE CASCADE,
  name                varchar(100) NOT NULL,
  avatar_id           varchar(50),
  score               integer     NOT NULL DEFAULT 0,
  correct_answers     integer     NOT NULL DEFAULT 0,
  total_questions     integer     NOT NULL DEFAULT 18,
  max_streak          integer     NOT NULL DEFAULT 0,
  achievements        text[]      NOT NULL DEFAULT '{}',
  answers             jsonb       NOT NULL DEFAULT '[]',  -- Respostas completas para análise
  completed           boolean     NOT NULL DEFAULT false,
  completed_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  last_answered_index integer     NOT NULL DEFAULT -1
);

-- Índice para queries de ranking por sessão
CREATE INDEX IF NOT EXISTS idx_players_session ON quiz_players (session_id, score DESC);
-- Índice para verificar duplicatas de nome por sessão
CREATE INDEX IF NOT EXISTS idx_players_session_name ON quiz_players (session_id, lower(name));

-- -----------------------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS)
-- Habilita RLS e permite leitura pública (anon key) para todas as linhas
-- Escrita também permite anon para simplificar (sem autenticação de usuário)
-- -----------------------------------------------------------------------------
ALTER TABLE quiz_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_players  ENABLE ROW LEVEL SECURITY;

-- Sessions: qualquer um pode ler; só inserção anon
CREATE POLICY "sessions_select" ON quiz_sessions FOR SELECT TO anon USING (true);
CREATE POLICY "sessions_insert" ON quiz_sessions FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "sessions_update" ON quiz_sessions FOR UPDATE TO anon USING (true);

-- Players: qualquer um pode ler e escrever (sem auth de usuário)
CREATE POLICY "players_select" ON quiz_players FOR SELECT TO anon USING (true);
CREATE POLICY "players_insert" ON quiz_players FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "players_update" ON quiz_players FOR UPDATE TO anon USING (true);

-- -----------------------------------------------------------------------------
-- REALTIME
-- Habilita publicação em tempo real para as tabelas
-- -----------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE quiz_players;
ALTER PUBLICATION supabase_realtime ADD TABLE quiz_sessions;

-- =============================================================================
-- FIM DO SCHEMA
-- =============================================================================

-- -----------------------------------------------------------------------------
-- MIGRAÇÕES ADICIONAIS: PAUSE, HEARTBEAT, LOGS E AVATARES
-- -----------------------------------------------------------------------------
ALTER TABLE quiz_sessions ADD COLUMN IF NOT EXISTS is_paused boolean NOT NULL DEFAULT false;
ALTER TABLE quiz_sessions ADD COLUMN IF NOT EXISTS last_host_ping timestamptz;
ALTER TABLE quiz_players ADD COLUMN IF NOT EXISTS avatar_id varchar(50);

CREATE TABLE IF NOT EXISTS quiz_logs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid        NOT NULL REFERENCES quiz_sessions(id) ON DELETE CASCADE,
  event_type  varchar(50) NOT NULL,
  details     jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Habilitar RLS nos logs
ALTER TABLE quiz_logs ENABLE ROW LEVEL SECURITY;

-- Segurança RLS: Apenas escrita é liberada publicamente para registrar logs de forma anônima.
-- Sem política de SELECT pública (leitura bloqueada para usuários comuns).
CREATE POLICY "logs_insert" ON quiz_logs FOR INSERT TO anon WITH CHECK (true);

-- Habilitar Realtime para os logs
ALTER PUBLICATION supabase_realtime ADD TABLE quiz_logs;

