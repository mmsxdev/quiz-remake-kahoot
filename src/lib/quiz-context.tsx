'use client'

import React, { createContext, useContext, useReducer, useEffect, useCallback, useState, useRef } from 'react'
import type {
  QuizState,
  QuizAction,
  QuestionResult,
  BlockScore,
  PerformanceLevel,
  QuizAttempt,
  Question,
  PlayerData,
  RankingEntry,
  AchievementId,
} from './types'
import {
  calcBlockScores,
  calcStreakBonus,
  detectNewAchievements,
  calcAchievementBonus,
  generateNameKey,
} from './scoring'
import { updatePlayerProgress } from './supabase-helpers'
import { supabase } from './supabase'

// ─── Chaves do localStorage ───────────────────────────────────────────────────

const STORAGE_KEY_STATE   = 'quizdida:state'
const STORAGE_KEY_HISTORY = 'quizdida:history'
const STORAGE_KEY_PLAYER  = 'quizdida:player'
const STORAGE_KEY_RANKING = 'quizdida:ranking'

// ─── Fisher-Yates Shuffle ─────────────────────────────────────────────────────

function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

// ─── Estado Inicial ───────────────────────────────────────────────────────────

const initialState: QuizState = {
  phase: 'welcome',
  currentIndex: 0,
  questions: [],
  results: [],
  startedAt: null,
  finishedAt: null,
  shuffledOptionIds: {},
  totalScore: 0,
  currentStreak: 0,
  maxStreak: 0,
  unlockedAchievements: [],
  playerName: '',
  // Session
  sessionCode: null,
  sessionId: null,
  playerId: null,
  timerEnabled: false,
  sessionStatus: 'lobby',
  sessionQuestionIndex: 0,
  sessionIsPaused: false,
}

// ─── Reducer ──────────────────────────────────────────────────────────────────

function quizReducer(state: QuizState, action: QuizAction): QuizState {
  switch (action.type) {

    case 'START_QUIZ': {
      const { questions, playerName, sessionCode, sessionId, playerId, timerEnabled } = action.payload

      // Embaralha apenas as alternativas (ordem das questões preservada por blocos)
      const shuffledOptionIds: Record<number, string[]> = {}
      questions.forEach((q) => {
        const options =
          q.type === 'two-phase' && q.phase2
            ? q.phase2.options.map((o) => o.id)
            : q.options.map((o) => o.id)
        shuffledOptionIds[q.id] = shuffleArray(options)
      })

      return {
        ...initialState,
        phase: 'quiz',
        questions,
        shuffledOptionIds,
        startedAt: new Date().toISOString(),
        playerName,
        sessionCode: sessionCode ?? null,
        sessionId: sessionId ?? null,
        playerId: playerId ?? null,
        timerEnabled: timerEnabled ?? false,
        sessionStatus: 'lobby',
        sessionQuestionIndex: 0,
        sessionIsPaused: false,
      }
    }

    case 'ANSWER_QUESTION': {
      const { questionId, selectedOptionId, selectedClassification, isCorrect, score } = action.payload
      const question = state.questions.find((q) => q.id === questionId)
      if (!question) return state

      const newStreak    = isCorrect ? state.currentStreak + 1 : 0
      const newMaxStreak = Math.max(state.maxStreak, newStreak)

      const streakBonus  = calcStreakBonus(newStreak, isCorrect)
      const finalScore   = { ...score, streakBonus, totalPoints: score.totalPoints + streakBonus }

      const result: QuestionResult = {
        questionId,
        selectedOptionId,
        selectedClassification,
        isCorrect,
        block: question.block,
        score: finalScore,
      }

      const newResults = [...state.results, result]

      const newAchievements = detectNewAchievements(
        newResults, newStreak, newResults, state.questions.length, state.unlockedAchievements,
      )
      const achievementPoints = calcAchievementBonus(newAchievements)
      const newTotalScore     = state.totalScore + finalScore.totalPoints + achievementPoints

      return {
        ...state,
        results: newResults,
        currentStreak: newStreak,
        maxStreak: newMaxStreak,
        unlockedAchievements: [...state.unlockedAchievements, ...newAchievements],
        totalScore: newTotalScore,
      }
    }

    case 'NEXT_QUESTION': {
      const nextIndex    = state.currentIndex + 1
      const isLastQuestion = nextIndex >= state.questions.length
      if (isLastQuestion) {
        return { ...state, phase: 'result', currentIndex: nextIndex, finishedAt: new Date().toISOString() }
      }
      return { ...state, currentIndex: nextIndex }
    }

    case 'FINISH_QUIZ':
      return { ...state, phase: 'result', finishedAt: new Date().toISOString() }

    case 'RESTART_QUIZ':
      return { ...initialState }

    case 'RESTORE_STATE':
      return action.payload

    case 'UPDATE_SESSION_STATE': {
      const { status, currentQuestionIndex, isPaused } = action.payload

      let newPhase = state.phase
      let newIndex = state.currentIndex

      if (status === 'ended') {
        newPhase = 'result'
      } else if (status === 'question') {
        newPhase = 'quiz'
        newIndex = currentQuestionIndex
      }

      return {
        ...state,
        sessionStatus: status,
        sessionQuestionIndex: currentQuestionIndex,
        sessionIsPaused: typeof isPaused === 'boolean' ? isPaused : state.sessionIsPaused,
        phase: newPhase,
        currentIndex: newIndex,
      }
    }

    default:
      return state
  }
}

// ─── Utilitários ──────────────────────────────────────────────────────────────

export function calcPerformanceLevel(percentage: number): PerformanceLevel {
  if (percentage < 50) return 'iniciante'
  if (percentage < 75) return 'em_desenvolvimento'
  return 'consolidado'
}

export function calcTotalCorrect(results: QuestionResult[]): number {
  return results.filter((r) => r.isCorrect).length
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface QuizContextValue {
  state: QuizState
  dispatch: React.Dispatch<QuizAction>
  // Computed
  currentQuestion: Question | null
  totalQuestions: number
  answeredCount: number
  progressPercent: number
  blockScores: BlockScore[]
  totalCorrect: number
  performanceLevel: PerformanceLevel
  percentage: number
  // Player (localStorage, fallback mode)
  player: PlayerData | null
  setPlayer: (p: PlayerData) => void
  markPlayerCompleted: (score: number, pct: number) => void
  resetPlayer: () => void
  // Ranking local (fallback mode)
  ranking: RankingEntry[]
  saveToRanking: () => void
  // History
  history: QuizAttempt[]
  saveAttemptToHistory: () => void
  clearHistory: () => void
  // Achievement toasts
  lastNewAchievements: AchievementId[]
  clearLastNewAchievements: () => void
  realtimeActive: boolean
}

const QuizContext = createContext<QuizContextValue | null>(null)

// ─── Provider ─────────────────────────────────────────────────────────────────

export function QuizProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(quizReducer, initialState)
  const [history, setHistory] = React.useState<QuizAttempt[]>([])
  const [player, setPlayerState] = useState<PlayerData | null>(null)
  const [ranking, setRanking] = useState<RankingEntry[]>([])
  const [lastNewAchievements, setLastNewAchievements] = useState<AchievementId[]>([])
  const [realtimeActive, setRealtimeActive] = useState(true)

  // Rastreia conquistas novas para toast
  const prevAchievementsRef = useRef<AchievementId[]>([])
  useEffect(() => {
    const prev = prevAchievementsRef.current
    const curr = state.unlockedAchievements
    const newOnes = curr.filter((a) => !prev.includes(a))
    if (newOnes.length > 0) setLastNewAchievements(newOnes)
    prevAchievementsRef.current = curr
  }, [state.unlockedAchievements])

  const clearLastNewAchievements = useCallback(() => setLastNewAchievements([]), [])

  // ── Carrega localStorage ao montar ─────────────────────────────────────────
  useEffect(() => {
    try {
      const savedPlayer  = localStorage.getItem(STORAGE_KEY_PLAYER)
      if (savedPlayer)   setPlayerState(JSON.parse(savedPlayer))

      const savedRanking = localStorage.getItem(STORAGE_KEY_RANKING)
      if (savedRanking)  setRanking(JSON.parse(savedRanking))

      const savedHistory = localStorage.getItem(STORAGE_KEY_HISTORY)
      if (savedHistory)  setHistory(JSON.parse(savedHistory))

      const savedState   = localStorage.getItem(STORAGE_KEY_STATE)
      if (savedState) {
        const parsed: QuizState = JSON.parse(savedState)
        if (parsed.phase === 'quiz' && parsed.questions.length > 0) {
          dispatch({ type: 'RESTORE_STATE', payload: parsed })
        }
      }
    } catch { /* ignora erros de parsing */ }
  }, [])

  // ── Persiste estado do quiz (somente durante quiz ativo) ───────────────────
  useEffect(() => {
    if (state.phase === 'quiz') {
      try { localStorage.setItem(STORAGE_KEY_STATE, JSON.stringify(state)) } catch { }
    } else {
      localStorage.removeItem(STORAGE_KEY_STATE)
    }
  }, [state])

  // ── Sincroniza progresso com Supabase (Instantâneo) ──────────────────────
  useEffect(() => {
    if (!state.playerId || state.results.length === 0) return

    const isCompleted = state.phase === 'result'
    const correctAnswers = state.results.filter((r) => r.isCorrect).length
    
    const lastResult = state.results[state.results.length - 1]
    const lastAnsweredIndex = lastResult ? state.questions.findIndex(q => q.id === lastResult.questionId) : -1

    updatePlayerProgress({
      playerId: state.playerId!,
      score: state.totalScore,
      correctAnswers,
      maxStreak: state.maxStreak,
      achievements: state.unlockedAchievements,
      answers: state.results,
      completed: isCompleted,
      completedAt: isCompleted ? (state.finishedAt ?? new Date().toISOString()) : null,
      lastAnsweredIndex: lastAnsweredIndex
    })
  }, [state.results, state.phase, state.playerId, state.totalScore, state.maxStreak, state.unlockedAchievements, state.finishedAt, state.questions])

  // ── Escuta mudanças na sessão em tempo real (Host -> Player) ─────────────────
  useEffect(() => {
    if (!state.sessionId || !supabase) return

    const channel = supabase
      .channel(`player-session-sync-${state.sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'quiz_sessions',
          filter: `id=eq.${state.sessionId}`,
        },
        (payload) => {
          const updatedSession = payload.new as any
          if (updatedSession) {
            dispatch({
              type: 'UPDATE_SESSION_STATE',
              payload: {
                status: updatedSession.status,
                currentQuestionIndex: updatedSession.current_question_index,
                isPaused: updatedSession.is_paused,
              },
            })
          }
        }
      )
      .subscribe((status) => {
        setRealtimeActive(status === 'SUBSCRIBED')
      })

    return () => {
      supabase?.removeChannel(channel)
    }
  }, [state.sessionId])

  // ── Polling de fallback sob demanda (ativo apenas se Realtime falhar) ─────────
  useEffect(() => {
    if (!state.sessionId || realtimeActive || !supabase) return

    const intervalId = setInterval(async () => {
      try {
        const { data, error } = await supabase!
          .from('quiz_sessions')
          .select('status, current_question_index, is_paused')
          .eq('id', state.sessionId)
          .single()

        if (data && !error) {
          if (
            data.status !== state.sessionStatus ||
            data.current_question_index !== state.sessionQuestionIndex ||
            data.is_paused !== state.sessionIsPaused
          ) {
            dispatch({
              type: 'UPDATE_SESSION_STATE',
              payload: {
                status: data.status,
                currentQuestionIndex: data.current_question_index,
                isPaused: data.is_paused,
              },
            })
          }
        }
      } catch (err) {
        console.error('Erro no polling de sincronização da sessão:', err)
      }
    }, 3000)

    return () => {
      clearInterval(intervalId)
    }
  }, [state.sessionId, realtimeActive, state.sessionStatus, state.sessionQuestionIndex])

  // ── Player (modo local) ────────────────────────────────────────────────────
  const setPlayer = useCallback((p: PlayerData) => {
    setPlayerState(p)
    try { localStorage.setItem(STORAGE_KEY_PLAYER, JSON.stringify(p)) } catch { }
  }, [])

  const markPlayerCompleted = useCallback((score: number, pct: number) => {
    setPlayerState((prev) => {
      if (!prev) return prev
      const updated: PlayerData = { ...prev, hasCompleted: true, finalScore: score, finalPercentage: pct, completedAt: new Date().toISOString() }
      try { localStorage.setItem(STORAGE_KEY_PLAYER, JSON.stringify(updated)) } catch { }
      return updated
    })
  }, [])

  const resetPlayer = useCallback(() => {
    setPlayerState(null)
    localStorage.removeItem(STORAGE_KEY_PLAYER)
  }, [])

  // ── Ranking local (fallback) ───────────────────────────────────────────────
  const saveToRanking = useCallback(() => {
    if (!state.playerName || state.phase !== 'result') return

    const totalCorrect = state.results.filter((r) => r.isCorrect).length
    const pct = state.questions.length > 0
      ? Math.round((totalCorrect / state.questions.length) * 100) : 0

    const entry: RankingEntry = {
      id: crypto.randomUUID(),
      name: state.playerName,
      score: state.totalScore,
      percentage: pct,
      correctAnswers: totalCorrect,
      totalQuestions: state.questions.length,
      completedAt: state.finishedAt ?? new Date().toISOString(),
      maxStreak: state.maxStreak,
      achievements: state.unlockedAchievements,
    }

    const newRanking = [...ranking, entry].sort((a, b) => b.score - a.score).slice(0, 50)
    setRanking(newRanking)
    try { localStorage.setItem(STORAGE_KEY_RANKING, JSON.stringify(newRanking)) } catch { }

    markPlayerCompleted(state.totalScore, pct)
  }, [state, ranking, markPlayerCompleted])

  const saveAttemptToHistory = useCallback(() => { }, [])
  const clearHistory = useCallback(() => {
    setHistory([])
    localStorage.removeItem(STORAGE_KEY_HISTORY)
  }, [])

  // ── Computed ───────────────────────────────────────────────────────────────
  const currentQuestion  = state.questions[state.currentIndex] ?? null
  const totalQuestions   = state.questions.length
  const answeredCount    = state.results.length
  const progressPercent  = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0
  const blockScores      = calcBlockScores(state.questions, state.results)
  const totalCorrect     = calcTotalCorrect(state.results)
  const percentage       = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0
  const performanceLevel = calcPerformanceLevel(percentage)

  return (
    <QuizContext.Provider value={{
      state, dispatch,
      currentQuestion, totalQuestions, answeredCount, progressPercent,
      blockScores, totalCorrect, performanceLevel, percentage,
      player, setPlayer, markPlayerCompleted, resetPlayer,
      ranking, saveToRanking,
      history, saveAttemptToHistory, clearHistory,
      lastNewAchievements, clearLastNewAchievements,
      realtimeActive,
    }}>
      {children}
    </QuizContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useQuiz(): QuizContextValue {
  const context = useContext(QuizContext)
  if (!context) throw new Error('useQuiz must be used within a QuizProvider')
  return context
}
