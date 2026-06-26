import { supabase } from './supabase'
import type { QuestionResult, AchievementId } from './types'

// ─── Tipos do banco de dados ──────────────────────────────────────────────────

export interface DbSession {
  id: string
  code: string
  title: string
  timer_enabled: boolean
  is_active: boolean
  closed_at: string | null
  created_at: string
  current_question_index: number
  status: 'lobby' | 'question' | 'leaderboard' | 'ended'
  is_paused: boolean
  last_host_ping: string | null
}

export interface DbPlayer {
  id: string
  session_id: string
  name: string
  score: number
  correct_answers: number
  total_questions: number
  max_streak: number
  achievements: AchievementId[]
  answers: QuestionResult[]
  completed: boolean
  completed_at: string | null
  created_at: string
  last_answered_index: number
  avatar_id?: string | null
}

// ─── Geração de código de sessão ──────────────────────────────────────────────

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // sem caracteres ambíguos

function randomCode(length = 6): string {
  return Array.from({ length }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('')
}

// ─── Sessões ──────────────────────────────────────────────────────────────────

/**
 * Cria uma nova sessão com código único (tenta até 5 vezes em caso de colisão).
 */
export async function createSession(params: {
  title: string
  timerEnabled: boolean
}): Promise<DbSession> {
  if (!supabase) throw new Error('Supabase não configurado')

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode()

    const { data, error } = await supabase
      .from('quiz_sessions')
      .insert({ code, title: params.title, timer_enabled: params.timerEnabled })
      .select()
      .single()

    if (error) {
      // Colisão de código — tenta novamente
      if (error.code === '23505') continue
      throw new Error(`Erro ao criar sessão: ${error.message}`)
    }

    return data as DbSession
  }

  throw new Error('Não foi possível gerar um código único. Tente novamente.')
}

/**
 * Busca uma sessão pelo código (case-insensitive).
 * Retorna null se não encontrada ou inativa.
 */
export async function getSessionByCode(code: string): Promise<DbSession | null> {
  if (!supabase) return null

  const { data, error } = await supabase
    .from('quiz_sessions')
    .select()
    .eq('is_active', true)
    .ilike('code', code.trim())
    .maybeSingle()

  if (error) {
    console.error('[QuizDida] Erro ao buscar sessão:', error)
    return null
  }

  return data as DbSession | null
}

/**
 * Encerra uma sessão (coordenador).
 */
export async function closeSession(sessionId: string): Promise<void> {
  if (!supabase) return

  const { error } = await supabase
    .from('quiz_sessions')
    .update({ is_active: false, closed_at: new Date().toISOString() })
    .eq('id', sessionId)

  if (error) throw new Error(`Erro ao encerrar sessão: ${error.message}`)
}

// ─── Jogadores ────────────────────────────────────────────────────────────────

/**
 * Registra um jogador em uma sessão.
 * Retorna o jogador criado com seu ID.
 */
export async function joinSession(params: {
  sessionId: string
  playerName: string
  totalQuestions: number
  avatarId?: string | null
}): Promise<DbPlayer> {
  if (!supabase) throw new Error('Supabase não configurado')

  const { data, error } = await supabase
    .from('quiz_players')
    .insert({
      session_id: params.sessionId,
      name: params.playerName.trim(),
      total_questions: params.totalQuestions,
      avatar_id: params.avatarId || null,
    })
    .select()
    .single()

  if (error) throw new Error(`Erro ao entrar na sessão: ${error.message}`)

  return data as DbPlayer
}

/**
 * Atualiza o progresso de um jogador (chamado a cada resposta, debounced).
 */
export async function updatePlayerProgress(params: {
  playerId: string
  score: number
  correctAnswers: number
  maxStreak: number
  achievements: AchievementId[]
  answers: QuestionResult[]
  completed: boolean
  completedAt: string | null
  lastAnsweredIndex: number
}): Promise<void> {
  if (!supabase) return

  const { error } = await supabase
    .from('quiz_players')
    .update({
      score: params.score,
      correct_answers: params.correctAnswers,
      max_streak: params.maxStreak,
      achievements: params.achievements,
      answers: params.answers as unknown as object[],
      completed: params.completed,
      completed_at: params.completedAt,
      last_answered_index: params.lastAnsweredIndex,
    })
    .eq('id', params.playerId)

  if (error) {
    console.error('[QuizDida] Erro ao salvar progresso:', error)
  }
}

/**
 * Atualiza o status e índice de questão da sessão (coordenador).
 */
export async function updateSessionStatus(
  sessionId: string,
  status: 'lobby' | 'question' | 'leaderboard' | 'ended',
  currentQuestionIndex: number
): Promise<void> {
  if (!supabase) return

  const { error } = await supabase
    .from('quiz_sessions')
    .update({
      status,
      current_question_index: currentQuestionIndex
    })
    .eq('id', sessionId)

  if (error) {
    throw new Error(`Erro ao atualizar status da sessão: ${error.message}`)
  }
}

// ─── Ranking da sessão ────────────────────────────────────────────────────────

/**
 * Busca o ranking completo de uma sessão, ordenado por pontuação.
 */
export async function getSessionRanking(sessionId: string): Promise<DbPlayer[]> {
  if (!supabase) return []

  const { data, error } = await supabase
    .from('quiz_players')
    .select()
    .eq('session_id', sessionId)
    .order('score', { ascending: false })
    .order('completed_at', { ascending: true, nullsFirst: false })

  if (error) {
    console.error('[QuizDida] Erro ao buscar ranking:', error)
    return []
  }

  return (data ?? []) as DbPlayer[]
}

/**
 * Atualiza o status de pausa da sessão (coordenador).
 */
export async function updateSessionPauseStatus(sessionId: string, isPaused: boolean): Promise<void> {
  if (!supabase) return

  const { error } = await supabase
    .from('quiz_sessions')
    .update({ is_paused: isPaused })
    .eq('id', sessionId)

  if (error) {
    throw new Error(`Erro ao atualizar pausa da sessão: ${error.message}`)
  }
}

/**
 * Atualiza o heartbeat do apresentador na sessão.
 */
export async function updateSessionHostPing(sessionId: string): Promise<void> {
  if (!supabase) return

  const { error } = await supabase
    .from('quiz_sessions')
    .update({ last_host_ping: new Date().toISOString() })
    .eq('id', sessionId)

  if (error) {
    console.error('[QuizDida] Erro ao enviar ping do host:', error)
  }
}

/**
 * Registra um evento de auditoria no banco de dados.
 * Falha silenciosamente caso a tabela quiz_logs ainda não exista (42P01)
 * ou em caso de violação de RLS — logs são opcionais e não devem
 * interromper o fluxo principal da aplicação.
 */
export async function logSessionEvent(sessionId: string, eventType: string, details: any = {}): Promise<void> {
  if (!supabase) return

  const { error } = await supabase
    .from('quiz_logs')
    .insert({
      session_id: sessionId,
      event_type: eventType,
      details
    })

  if (error) {
    // 42P01 = tabela não existe → schema ainda não foi aplicado no Supabase
    // 42501 = violação de RLS → esperado em ambientes sem a política correta
    const isSilent = error.code === '42P01' || error.code === '42501'
    if (!isSilent) {
      console.warn(
        `[QuizDida] Log de sessão não registrado (${error.code}): ${error.message}`
      )
    }
  }
}
