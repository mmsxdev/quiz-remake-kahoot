'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuiz } from '@/lib/quiz-context'
import { QuestionCard } from '@/components/quiz/QuestionCard'
import { QuizProgressBar } from '@/components/quiz/QuizProgressBar'
import { AchievementToast } from '@/components/quiz/AchievementToast'
import { Maximize2, Minimize2, Home, Star, Users, Hourglass, Trophy, Flame } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { Classification, QuestionScore } from '@/lib/types'

export default function QuizPage() {
  const router = useRouter()
  const {
    state, currentQuestion, totalQuestions, answeredCount, progressPercent, dispatch,
    lastNewAchievements, clearLastNewAchievements,
  } = useQuiz()
  const [isFullscreen, setIsFullscreen] = useState(false)

  // 1. Redirecionamento de fase
  useEffect(() => {
    if (state.phase === 'welcome') router.push('/')
    else if (state.phase === 'result') router.push('/resultado')
  }, [state.phase, router])

  // 2. Fullscreen handlers
  const toggleFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen()
      setIsFullscreen(true)
    } else {
      await document.exitFullscreen()
      setIsFullscreen(false)
    }
  }, [])

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  // 3. Resposta submetida
  function handleAnswer(params: {
    selectedOptionId: string
    selectedClassification?: Classification
    isCorrect: boolean
    score: QuestionScore
  }) {
    if (!currentQuestion) return
    dispatch({
      type: 'ANSWER_QUESTION',
      payload: { questionId: currentQuestion.id, ...params },
    })
  }

  function handleNext() {
    dispatch({ type: 'NEXT_QUESTION' })
  }

  // Opções embaralhadas
  const shuffledOptions = useMemo(() => {
    if (!currentQuestion) return []
    const savedOrder = state.shuffledOptionIds[currentQuestion.id]
    if (!savedOrder) return currentQuestion.type === 'two-phase'
      ? currentQuestion.phase2?.options ?? []
      : currentQuestion.options

    const sourceOptions = currentQuestion.type === 'two-phase'
      ? currentQuestion.phase2?.options ?? []
      : currentQuestion.options

    return savedOrder
      .map((id) => sourceOptions.find((o) => o.id === id))
      .filter(Boolean) as typeof sourceOptions
  }, [currentQuestion, state.shuffledOptionIds])

  if (state.phase !== 'quiz') return null

  const currentResult = currentQuestion
    ? state.results.find((r) => r.questionId === currentQuestion.id) ?? null
    : null

  const isRoomMode = !!state.sessionCode

  return (
    <main className="relative min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 font-sans text-white">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-0 right-1/3 h-64 w-64 rounded-full bg-blue-600/8 blur-3xl" />
      </div>

      {/* Top Bar */}
      <div className="relative z-20 border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
          <button onClick={() => {
            if (confirm('Deseja sair do quiz? Seu progresso nesta sala será perdido.')) {
              dispatch({ type: 'RESTART_QUIZ' })
              router.push('/')
            }
          }}
            className="flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-slate-200"
            aria-label="Sair da Sala">
            <Home className="h-4 w-4" />
            <span className="text-xs">{state.playerName}</span>
          </button>

          <div className="flex items-center gap-3">
            {isRoomMode && (
              <Badge variant="outline" className="border-blue-500/30 bg-blue-500/10 text-xs text-blue-300">
                Sala: {state.sessionCode}
              </Badge>
            )}

            {!isRoomMode && (
              <span className="text-sm text-slate-400">
                Q<span className="font-bold text-white">{state.currentIndex + 1}</span>
                /{totalQuestions}
              </span>
            )}

            {/* Score */}
            <div className="flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1">
              <Star className="h-3 w-3 text-blue-400" />
              <motion.span
                key={state.totalScore}
                initial={{ scale: 1.3, color: '#34d399' }}
                animate={{ scale: 1, color: '#93c5fd' }}
                transition={{ duration: 0.4 }}
                className="text-sm font-bold text-blue-300 tabular-nums"
              >
                {state.totalScore.toLocaleString()}
              </motion.span>
            </div>
          </div>

          <Button variant="ghost" size="sm" onClick={toggleFullscreen}
            className="text-slate-400 hover:text-white"
            aria-label={isFullscreen ? 'Sair do modo tela cheia' : 'Ativar modo tela cheia'}>
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>

        {/* Barra de progresso visível apenas em andamento */}
        {state.sessionStatus === 'question' && (
          <QuizProgressBar percent={progressPercent} answeredCount={answeredCount} total={totalQuestions} />
        )}
      </div>

      {/* Conteúdo dinâmico por status da sessão */}
      <div className="relative z-10 mx-auto max-w-4xl px-6 py-10">
        <AnimatePresence mode="wait">
          
          {/* ─── ESTADO: LOBBY (Aguardando Host) ───────────────────────────────── */}
          {isRoomMode && state.sessionStatus === 'lobby' && (
            <motion.div
              key="lobby"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center justify-center py-20 text-center space-y-6"
            >
              <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 animate-pulse">
                <Users className="h-10 w-10" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-white">Você está conectado!</h2>
                <p className="text-slate-400 max-w-sm mx-auto">
                  Olá, <strong className="text-white">{state.playerName}</strong>. Aguarde o apresentador iniciar a partida no projetor.
                </p>
              </div>
              <div className="rounded-lg bg-slate-900/60 border border-slate-800 p-4 w-full max-w-xs text-xs text-slate-500">
                Código da Sala: <strong className="text-blue-400 font-mono tracking-widest">{state.sessionCode}</strong>
              </div>
            </motion.div>
          )}

          {/* ─── ESTADO: LEADERBOARD (Esperando Host) ───────────────────────────── */}
          {isRoomMode && state.sessionStatus === 'leaderboard' && (
            <motion.div
              key="leaderboard"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="flex flex-col items-center justify-center py-20 text-center space-y-6"
            >
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <Trophy className="h-10 w-10 animate-bounce" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-white">Veja a tela de projeção!</h2>
                <p className="text-slate-400 max-w-sm mx-auto">
                  O placar parcial está sendo exibido na tela principal. Veja quem está liderando!
                </p>
              </div>

              {/* Informações rápidas do aluno */}
              <div className="grid grid-cols-2 gap-4 w-full max-w-sm bg-slate-900/40 p-4 border border-slate-800 rounded-xl">
                <div className="text-center border-r border-slate-800">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Sua pontuação</p>
                  <p className="text-xl font-bold text-blue-400 mt-1">{state.totalScore}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Streak atual</p>
                  <p className="text-xl font-bold text-orange-400 mt-1 flex items-center justify-center gap-1">
                    <Flame className="h-4 w-4" /> {state.currentStreak}x
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* ─── ESTADO: QUESTÃO ATIVA ─────────────────────────────────────────── */}
          {(!isRoomMode || state.sessionStatus === 'question') && currentQuestion && (
            <motion.div
              key={currentQuestion.id}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.35, ease: 'easeInOut' }}
            >
              <QuestionCard
                question={currentQuestion}
                shuffledOptions={shuffledOptions}
                result={currentResult}
                onAnswer={handleAnswer}
                onNext={handleNext}
                questionNumber={state.currentIndex + 1}
                totalQuestions={totalQuestions}
                currentStreak={state.currentStreak}
                timerEnabled={state.timerEnabled}
                isRoomMode={isRoomMode}
              />
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* Toast de conquistas */}
      <AchievementToast achievements={lastNewAchievements} onDismiss={clearLastNewAchievements} />
    </main>
  )
}
