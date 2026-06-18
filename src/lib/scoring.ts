import type { Achievement, AchievementId, QuestionResult, QuizState, BlockScore } from './types'

// ─── Constantes de Pontuação ──────────────────────────────────────────────────

export const SCORE_CONFIG = {
  // Pontos base
  STANDARD_CORRECT: 100,
  TWO_PHASE_P1_CORRECT: 50,
  TWO_PHASE_P2_CORRECT: 100,

  // Bônus de velocidade máximo (adicionado apenas em acertos)
  MAX_SPEED_BONUS_STANDARD: 50,
  MAX_SPEED_BONUS_P1: 25,
  MAX_SPEED_BONUS_P2: 50,

  // Bônus de sequência
  STREAK_THRESHOLD: 3,   // a cada N acertos consecutivos
  STREAK_BONUS: 30,

  // Bônus por bloco perfeito
  PERFECT_BLOCK_BONUS: 100,

  // Limites de tempo em segundos
  TIME_LIMIT_STANDARD: 30,
  TIME_LIMIT_TWO_PHASE_P1: 20,
  TIME_LIMIT_TWO_PHASE_P2: 30,
} as const

// ─── Catálogo de Conquistas ───────────────────────────────────────────────────

export const ACHIEVEMENTS: Record<AchievementId, Achievement> = {
  speed_demon: {
    id: 'speed_demon',
    label: 'Velocista',
    description: 'Respondeu corretamente usando menos de 20% do tempo disponível',
    emoji: '⚡',
    bonusPoints: 50,
  },
  streak_3: {
    id: 'streak_3',
    label: 'Em Ritmo',
    description: '3 respostas corretas consecutivas',
    emoji: '🔥',
    bonusPoints: 30,
  },
  streak_6: {
    id: 'streak_6',
    label: 'Sequência de Ouro',
    description: '6 respostas corretas consecutivas',
    emoji: '💫',
    bonusPoints: 60,
  },
  perfect_block_a: {
    id: 'perfect_block_a',
    label: 'Identificador Expert',
    description: 'Acertou todas as questões do Bloco A',
    emoji: '🎯',
    bonusPoints: 100,
  },
  perfect_block_b: {
    id: 'perfect_block_b',
    label: 'Mentor em Ação',
    description: 'Acertou todas as questões do Bloco B',
    emoji: '🏫',
    bonusPoints: 100,
  },
  perfect_block_c: {
    id: 'perfect_block_c',
    label: 'Fundamentos Sólidos',
    description: 'Acertou todas as questões do Bloco C',
    emoji: '📚',
    bonusPoints: 100,
  },
  master: {
    id: 'master',
    label: 'Mestre da MSEP',
    description: '100% de acerto no quiz completo',
    emoji: '🏆',
    bonusPoints: 200,
  },
}

// ─── Funções de Cálculo ───────────────────────────────────────────────────────

/**
 * Calcula o bônus de velocidade proporcionalmente ao tempo restante.
 * Retorna 0 se o tempo esgotou ou a resposta foi errada.
 */
export function calcSpeedBonus(
  timeLeftMs: number,
  timeLimitSec: number,
  maxBonus: number,
): number {
  if (timeLeftMs <= 0) return 0
  const ratio = timeLeftMs / (timeLimitSec * 1000)
  return Math.round(ratio * maxBonus)
}

/**
 * Verifica se a resposta foi feita usando menos de 20% do tempo (conquista "Velocista").
 */
export function isSpeedDemon(timeLeftMs: number, timeLimitSec: number): boolean {
  if (timeLeftMs <= 0) return false
  return timeLeftMs / (timeLimitSec * 1000) >= 0.8
}

/**
 * Calcula pontos base para a questão atual.
 * Para two-phase: soma pontos da fase 1 (se correta) + fase 2 (se correta).
 */
export function calcBasePoints(
  questionType: 'standard' | 'two-phase',
  isCorrect: boolean,
  phase1Correct?: boolean,
  phase2Correct?: boolean,
): number {
  if (questionType === 'standard') {
    return isCorrect ? SCORE_CONFIG.STANDARD_CORRECT : 0
  }
  // Two-phase: cada fase tem sua própria pontuação
  let total = 0
  if (phase1Correct) total += SCORE_CONFIG.TWO_PHASE_P1_CORRECT
  if (phase2Correct) total += SCORE_CONFIG.TWO_PHASE_P2_CORRECT
  return total
}

/**
 * Calcula o bônus de sequência (streak) baseado no streak atual APÓS essa resposta.
 * Retorna 0 se a streak não atingiu o threshold ou a resposta foi errada.
 */
export function calcStreakBonus(newStreak: number, isCorrect: boolean): number {
  if (!isCorrect || newStreak === 0) return 0
  if (newStreak % SCORE_CONFIG.STREAK_THRESHOLD === 0) return SCORE_CONFIG.STREAK_BONUS
  return 0
}

/**
 * Detecta novas conquistas baseadas no estado atual do quiz após uma resposta.
 */
export function detectNewAchievements(
  results: QuestionResult[],
  newStreak: number,
  allResults: QuestionResult[], // todos os resultados incluindo o atual
  totalQuestions: number,
  existingAchievements: AchievementId[],
): AchievementId[] {
  const newOnes: AchievementId[] = []

  const add = (id: AchievementId) => {
    if (!existingAchievements.includes(id) && !newOnes.includes(id)) {
      newOnes.push(id)
    }
  }

  // Streak 3 e 6
  if (newStreak >= 3) add('streak_3')
  if (newStreak >= 6) add('streak_6')

  // Blocos perfeitos (só verifica quando o bloco está completo)
  const blockCounts: Record<string, { total: number; correct: number }> = {}
  allResults.forEach((r) => {
    if (!blockCounts[r.block]) blockCounts[r.block] = { total: 0, correct: 0 }
    blockCounts[r.block].total++
    if (r.isCorrect) blockCounts[r.block].correct++
  })

  // Quantidade de questões por bloco (assumindo 6 cada)
  const BLOCK_SIZES: Record<string, number> = { A: 6, B: 6, C: 6 }
  if (blockCounts['A']?.total === BLOCK_SIZES['A'] && blockCounts['A']?.correct === BLOCK_SIZES['A']) {
    add('perfect_block_a')
  }
  if (blockCounts['B']?.total === BLOCK_SIZES['B'] && blockCounts['B']?.correct === BLOCK_SIZES['B']) {
    add('perfect_block_b')
  }
  if (blockCounts['C']?.total === BLOCK_SIZES['C'] && blockCounts['C']?.correct === BLOCK_SIZES['C']) {
    add('perfect_block_c')
  }

  // Mestre da MSEP (100% geral, só na última questão)
  if (allResults.length === totalQuestions && allResults.every((r) => r.isCorrect)) {
    add('master')
  }

  return newOnes
}

/**
 * Calcula o bônus total das conquistas desbloqueadas.
 */
export function calcAchievementBonus(achievementIds: AchievementId[]): number {
  return achievementIds.reduce((sum, id) => sum + (ACHIEVEMENTS[id]?.bonusPoints ?? 0), 0)
}

/**
 * Calcula os scores por bloco a partir dos resultados.
 */
export function calcBlockScores(
  questions: { id: number; block: 'A' | 'B' | 'C'; blockLabel: string }[],
  results: QuestionResult[],
): BlockScore[] {
  const blockMap: Record<string, { label: string; correct: number; total: number; points: number }> = {}

  questions.forEach((q) => {
    if (!blockMap[q.block]) {
      blockMap[q.block] = { label: q.blockLabel, correct: 0, total: 0, points: 0 }
    }
    blockMap[q.block].total++
  })

  results.forEach((r) => {
    if (blockMap[r.block]) {
      if (r.isCorrect) blockMap[r.block].correct++
      blockMap[r.block].points += r.score.totalPoints
    }
  })

  return Object.entries(blockMap).map(([block, data]) => ({
    block: block as 'A' | 'B' | 'C',
    blockLabel: data.label,
    correct: data.correct,
    total: data.total,
    percentage: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0,
    pointsEarned: data.points,
  }))
}

/**
 * Gera uma chave simples baseada no nome do jogador (para identificação anti-farm).
 * Não é criptografia — apenas um identificador estável para localStorage.
 */
export function generateNameKey(name: string): string {
  const normalized = name.trim().toLowerCase().replace(/\s+/g, '_')
  let hash = 0
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash << 5) - hash + normalized.charCodeAt(i)
    hash |= 0
  }
  return `${normalized}_${Math.abs(hash).toString(36)}`
}
