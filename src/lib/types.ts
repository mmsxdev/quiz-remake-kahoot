// ─── Tipos de Questão ────────────────────────────────────────────────────────

export type ThematicBlock = 'A' | 'B' | 'C'
export type CapabilityCategory = 'Técnica' | 'Social' | 'Organizativa' | 'Metodológica' | null
export type QuestionType = 'standard' | 'two-phase'
export type Classification = 'Competência' | 'Capacidade'

export interface Option {
  id: string
  text: string
  isCorrect: boolean
}

export interface Phase2Option {
  id: string
  text: string
  isCorrect: boolean
}

export interface Phase2Data {
  prompt: string
  options: Phase2Option[]
}

export interface Question {
  id: number
  block: ThematicBlock
  blockLabel: string
  text: string
  type: QuestionType
  options: Option[]
  correctClassification?: Classification
  phase2?: Phase2Data
  explanation: string
  conceptHighlight: Classification | 'Ambos'
  capabilityCategory?: CapabilityCategory
  difficulty: 'básico' | 'intermediário' | 'avançado'
}

// ─── Pontuação ───────────────────────────────────────────────────────────────

export interface QuestionScore {
  questionId: number
  basePoints: number
  speedBonus: number
  streakBonus: number
  totalPoints: number
  /** ms restantes na fase 1 ao responder (two-phase) */
  phase1TimeLeftMs?: number
  /** ms restantes na fase 2 ao responder (two-phase) */
  phase2TimeLeftMs?: number
  /** ms restantes ao responder (standard) */
  timeLeftMs?: number
}

export type AchievementId =
  | 'speed_demon'      // Respondeu uma questão com >80% do tempo restante
  | 'streak_3'         // 3 acertos consecutivos
  | 'streak_6'         // 6 acertos consecutivos
  | 'perfect_block_a'  // Bloco A perfeito
  | 'perfect_block_b'  // Bloco B perfeito
  | 'perfect_block_c'  // Bloco C perfeito
  | 'master'           // 100% de acerto

export interface Achievement {
  id: AchievementId
  label: string
  description: string
  emoji: string
  bonusPoints: number
}

// ─── Tipos de Estado do Quiz ─────────────────────────────────────────────────

export type QuizPhase = 'welcome' | 'quiz' | 'result'

export interface QuestionResult {
  questionId: number
  selectedOptionId: string
  selectedClassification?: Classification
  isCorrect: boolean
  block: ThematicBlock
  score: QuestionScore
}

export interface BlockScore {
  block: ThematicBlock
  blockLabel: string
  correct: number
  total: number
  percentage: number
  pointsEarned: number
}

export interface QuizState {
  phase: QuizPhase
  currentIndex: number
  questions: Question[]
  results: QuestionResult[]
  startedAt: string | null
  finishedAt: string | null
  shuffledOptionIds: Record<number, string[]>
  // Score
  totalScore: number
  currentStreak: number
  maxStreak: number
  unlockedAchievements: AchievementId[]
  playerName: string
  // Session (Supabase)
  sessionCode: string | null
  sessionId: string | null
  playerId: string | null
  timerEnabled: boolean
  sessionStatus: 'lobby' | 'question' | 'leaderboard' | 'ended' | null
  sessionQuestionIndex: number
}

// ─── Player e Ranking ─────────────────────────────────────────────────────────

export interface PlayerData {
  name: string
  nameKey: string          // hash simples para identificação
  hasCompleted: boolean
  finalScore?: number
  finalPercentage?: number
  completedAt?: string
}

export interface RankingEntry {
  id: string
  name: string
  score: number
  percentage: number
  correctAnswers: number
  totalQuestions: number
  completedAt: string
  maxStreak: number
  achievements: AchievementId[]
}

// ─── Tipos de Resultado ───────────────────────────────────────────────────────

export type PerformanceLevel = 'iniciante' | 'em_desenvolvimento' | 'consolidado'

export interface QuizAttempt {
  id: string
  completedAt: string
  totalScore: number
  totalQuestions: number
  percentage: number
  level: PerformanceLevel
  blockScores: BlockScore[]
}

// ─── Tipos de Ação do Reducer ─────────────────────────────────────────────────

export type QuizAction =
  | {
      type: 'START_QUIZ'
      payload: {
        questions: Question[]
        playerName: string
        sessionCode?: string | null
        sessionId?: string | null
        playerId?: string | null
        timerEnabled?: boolean
      }
    }
  | {
      type: 'ANSWER_QUESTION'
      payload: {
        questionId: number
        selectedOptionId: string
        selectedClassification?: Classification
        isCorrect: boolean
        score: QuestionScore
      }
    }
  | { type: 'NEXT_QUESTION' }
  | { type: 'FINISH_QUIZ' }
  | { type: 'RESTART_QUIZ' }
  | { type: 'RESTORE_STATE'; payload: QuizState }
  | {
      type: 'UPDATE_SESSION_STATE'
      payload: {
        status: 'lobby' | 'question' | 'leaderboard' | 'ended'
        currentQuestionIndex: number
      }
    }
