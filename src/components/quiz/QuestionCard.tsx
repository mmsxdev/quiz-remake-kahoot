'use client'

import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, XCircle, ArrowRight, HelpCircle, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { OptionButton } from './OptionButton'
import { QuizTimer } from './QuizTimer'
import type { Question, Option, Classification, Phase2Option, QuestionScore } from '@/lib/types'
import { SCORE_CONFIG, calcSpeedBonus, isSpeedDemon } from '@/lib/scoring'

interface QuestionCardProps {
  question: Question
  shuffledOptions: Option[] | Phase2Option[]
  result: { selectedOptionId: string; selectedClassification?: Classification; isCorrect: boolean; score: QuestionScore } | null
  onAnswer: (params: {
    selectedOptionId: string
    selectedClassification?: Classification
    isCorrect: boolean
    score: QuestionScore
  }) => void
  onNext: () => void
  questionNumber: number
  totalQuestions: number
  currentStreak: number
  timerEnabled: boolean
  isRoomMode: boolean
  sessionIsPaused?: boolean
}

// ─── Botão de Classificação (Fase 1) ─────────────────────────────────────────


interface ClassificationButtonProps {
  label: Classification
  isSelected: boolean
  isCorrect: boolean | null
  isDisabled: boolean
  onClick: () => void
  colorVariant: 'blue' | 'violet'
}

function ClassificationButton({ label, isSelected, isCorrect, isDisabled, onClick, colorVariant }: ClassificationButtonProps) {
  const revealed = isCorrect !== null
  let classes = 'group relative flex flex-1 flex-col items-center gap-2 rounded-xl border px-6 py-5 font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500'

  if (!revealed) {
    if (isSelected) {
      classes += colorVariant === 'blue'
        ? ' border-blue-500 bg-blue-500/20 text-blue-200 scale-[1.02]'
        : ' border-violet-500 bg-violet-500/20 text-violet-200 scale-[1.02]'
    } else if (isDisabled) {
      classes += ' cursor-not-allowed border-slate-700/30 bg-slate-800/20 opacity-40 text-slate-500'
    } else {
      classes += colorVariant === 'blue'
        ? ' border-slate-700/60 bg-slate-800/40 text-slate-300 hover:border-blue-500/60 hover:bg-blue-500/10 hover:text-blue-200 cursor-pointer'
        : ' border-slate-700/60 bg-slate-800/40 text-slate-300 hover:border-violet-500/60 hover:bg-violet-500/10 hover:text-violet-200 cursor-pointer'
    }
  } else {
    if (isSelected && isCorrect) classes += ' border-emerald-500/60 bg-emerald-500/10 text-emerald-200 cursor-not-allowed'
    else if (isSelected && !isCorrect) classes += ' border-red-500/60 bg-red-500/10 text-red-200 cursor-not-allowed'
    else if (!isSelected && isCorrect) classes += ' border-emerald-500/40 bg-emerald-500/5 text-emerald-300 cursor-not-allowed'
    else classes += ' cursor-not-allowed border-slate-700/30 bg-slate-800/20 opacity-30 text-slate-500'
  }

  return (
    <button className={classes} onClick={onClick} disabled={isDisabled || revealed} aria-pressed={isSelected}>
      <span className="text-base md:text-lg">{label}</span>
      {revealed && isSelected && (
        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300 }}>
          {isCorrect ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : <XCircle className="h-5 w-5 text-red-400" />}
        </motion.span>
      )}
      {revealed && !isSelected && isCorrect && (
        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300 }}>
          <CheckCircle2 className="h-5 w-5 text-emerald-400 opacity-60" />
        </motion.span>
      )}
    </button>
  )
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export function QuestionCard({
  question, shuffledOptions, result, onAnswer, onNext,
  questionNumber, totalQuestions, currentStreak, timerEnabled, isRoomMode,
  sessionIsPaused = false,
}: QuestionCardProps) {
  const isTwoPhase = question.type === 'two-phase'
  const isLastQuestion = questionNumber === totalQuestions

  // ── Estado local ────────────────────────────────────────────────────────────
  const [phase1Selection, setPhase1Selection] = useState<Classification | null>(result?.selectedClassification ?? null)
  const [phase1Revealed, setPhase1Revealed] = useState(!!result)
  const [phase2Selection, setPhase2Selection] = useState<string | null>(isTwoPhase && result ? result.selectedOptionId : null)
  const [phase2Revealed, setPhase2Revealed] = useState(!!result)
  const [standardSelection, setStandardSelection] = useState<string | null>(!isTwoPhase && result ? result.selectedOptionId : null)

  // Timer state
  const [timerPhase, setTimerPhase] = useState<1 | 2>(1)
  const [timerResetKey, setTimerResetKey] = useState(0)
  const [timerPaused, setTimerPaused] = useState(!!result)

  // Guarda o tempo restante no momento da resposta
  const phase1TimeRef = useRef<number>(SCORE_CONFIG.TIME_LIMIT_TWO_PHASE_P1 * 1000)
  const phase2TimeRef = useRef<number>(SCORE_CONFIG.TIME_LIMIT_TWO_PHASE_P2 * 1000)
  const standardTimeRef = useRef<number>(SCORE_CONFIG.TIME_LIMIT_STANDARD * 1000)

  // Timer: atualiza o ref do tempo restante a cada tick
  const handleTick = useCallback((timeLeftMs: number) => {
    if (isTwoPhase) {
      if (timerPhase === 1) phase1TimeRef.current = timeLeftMs
      else phase2TimeRef.current = timeLeftMs
    } else {
      standardTimeRef.current = timeLeftMs
    }
  }, [isTwoPhase, timerPhase])

  // ── Handlers ────────────────────────────────────────────────────────────────

  function handlePhase1Click(classification: Classification) {
    if (phase1Revealed) return
    setTimerPaused(true)
    setPhase1Selection(classification)
    setPhase1Revealed(true)

    // Transição para fase 2
    setTimeout(() => {
      setTimerPhase(2)
      setTimerResetKey((k) => k + 1)
      setTimerPaused(false)
      phase2TimeRef.current = SCORE_CONFIG.TIME_LIMIT_TWO_PHASE_P2 * 1000
    }, 400)
  }

  function handlePhase2Select(optionId: string) {
    if (phase2Revealed) return
    setTimerPaused(true)
    setPhase2Selection(optionId)
    setPhase2Revealed(true)

    const phase1Correct = phase1Selection === question.correctClassification
    const phase2Option = question.phase2!.options.find((o) => o.id === optionId)
    const phase2Correct = phase2Option?.isCorrect ?? false
    const bothCorrect = phase1Correct && phase2Correct

    const p1SpeedBonus = phase1Correct && timerEnabled
      ? calcSpeedBonus(phase1TimeRef.current, SCORE_CONFIG.TIME_LIMIT_TWO_PHASE_P1, SCORE_CONFIG.MAX_SPEED_BONUS_P1)
      : 0
    const p2SpeedBonus = phase2Correct && timerEnabled
      ? calcSpeedBonus(phase2TimeRef.current, SCORE_CONFIG.TIME_LIMIT_TWO_PHASE_P2, SCORE_CONFIG.MAX_SPEED_BONUS_P2)
      : 0

    let basePoints = 0
    if (phase1Correct) basePoints += SCORE_CONFIG.TWO_PHASE_P1_CORRECT
    if (phase2Correct) basePoints += SCORE_CONFIG.TWO_PHASE_P2_CORRECT
    const speedBonus = p1SpeedBonus + p2SpeedBonus

    const score: QuestionScore = {
      questionId: question.id,
      basePoints,
      speedBonus,
      streakBonus: 0, // calculado no reducer
      totalPoints: basePoints + speedBonus,
      phase1TimeLeftMs: phase1TimeRef.current,
      phase2TimeLeftMs: phase2TimeRef.current,
    }

    onAnswer({ selectedOptionId: optionId, selectedClassification: phase1Selection ?? undefined, isCorrect: bothCorrect, score })
  }

  function handlePhase1Timeout() {
    if (phase1Revealed) return
    setTimerPaused(true)
    setPhase1Selection(null)
    setPhase1Revealed(true)
    phase1TimeRef.current = 0

    setTimeout(() => {
      setTimerPhase(2)
      setTimerResetKey((k) => k + 1)
      setTimerPaused(false)
      phase2TimeRef.current = SCORE_CONFIG.TIME_LIMIT_TWO_PHASE_P2 * 1000
    }, 500)
  }

  function handlePhase2Timeout() {
    if (phase2Revealed) return
    const firstOption = (shuffledOptions as Phase2Option[])[0]
    if (!firstOption) return
    setTimerPaused(true)
    setPhase2Selection(firstOption.id)
    setPhase2Revealed(true)
    phase2TimeRef.current = 0

    const phase1Correct = phase1Selection === question.correctClassification
    let basePoints = 0
    if (phase1Correct) basePoints += SCORE_CONFIG.TWO_PHASE_P1_CORRECT

    const score: QuestionScore = {
      questionId: question.id,
      basePoints,
      speedBonus: 0,
      streakBonus: 0,
      totalPoints: basePoints,
      phase1TimeLeftMs: phase1TimeRef.current,
      phase2TimeLeftMs: 0,
    }
    onAnswer({ selectedOptionId: firstOption.id, selectedClassification: phase1Selection ?? undefined, isCorrect: false, score })
  }

  function handleStandardSelect(optionId: string) {
    if (standardSelection) return
    setTimerPaused(true)
    setStandardSelection(optionId)

    const option = (question.options as Option[]).find((o) => o.id === optionId)
    const correct = option?.isCorrect ?? false
    const speedBonus = correct && timerEnabled
      ? calcSpeedBonus(standardTimeRef.current, SCORE_CONFIG.TIME_LIMIT_STANDARD, SCORE_CONFIG.MAX_SPEED_BONUS_STANDARD)
      : 0
    const basePoints = correct ? SCORE_CONFIG.STANDARD_CORRECT : 0

    const score: QuestionScore = {
      questionId: question.id,
      basePoints,
      speedBonus,
      streakBonus: 0,
      totalPoints: basePoints + speedBonus,
      timeLeftMs: standardTimeRef.current,
    }
    onAnswer({ selectedOptionId: optionId, isCorrect: correct, score })
  }

  function handleStandardTimeout() {
    if (standardSelection) return
    const firstOption = (shuffledOptions as Option[])[0]
    if (!firstOption) return
    setTimerPaused(true)
    setStandardSelection(firstOption.id)
    standardTimeRef.current = 0

    const score: QuestionScore = {
      questionId: question.id,
      basePoints: 0,
      speedBonus: 0,
      streakBonus: 0,
      totalPoints: 0,
      timeLeftMs: 0,
    }
    onAnswer({ selectedOptionId: firstOption.id, isCorrect: false, score })
  }

  // ── Derived ──────────────────────────────────────────────────────────────────
  const phase1Correct = phase1Selection === question.correctClassification
  const isAnswered = isTwoPhase ? phase2Revealed : !!standardSelection
  const isCorrect = result
    ? result.isCorrect
    : isTwoPhase
      ? phase1Correct && !!(question.phase2?.options.find((o) => o.id === phase2Selection)?.isCorrect)
      : !!(question.options as Option[]).find((o) => o.id === standardSelection)?.isCorrect

  const earnedScore = result?.score ?? null
  const showSpeedBonus = isAnswered && !!earnedScore && earnedScore.speedBonus > 0

  const currentTimerLimit = isTwoPhase
    ? (timerPhase === 1 ? SCORE_CONFIG.TIME_LIMIT_TWO_PHASE_P1 : SCORE_CONFIG.TIME_LIMIT_TWO_PHASE_P2)
    : SCORE_CONFIG.TIME_LIMIT_STANDARD

  return (
    <div className="flex flex-col gap-6">
      {/* Badges + Timer row */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="border-blue-500/30 bg-blue-500/10 font-mono text-xs text-blue-400">
            Bloco {question.block}
          </Badge>
          <Badge variant="outline" className="border-slate-600/50 bg-slate-800/50 text-xs text-slate-400">
            {question.difficulty}
          </Badge>
          {question.capabilityCategory && (
            <Badge variant="outline" className="border-violet-500/30 bg-violet-500/10 text-xs text-violet-400">
              Cap. {question.capabilityCategory}
            </Badge>
          )}
          {isTwoPhase && (
            <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-xs text-amber-400">
              2 fases
            </Badge>
          )}
          {currentStreak >= 3 && (
            <Badge variant="outline" className="border-orange-500/40 bg-orange-500/10 text-xs text-orange-400">
              🔥 {currentStreak}x
            </Badge>
          )}
        </div>

        {/* Timer */}
        {!isAnswered && timerEnabled && (
          <div className="shrink-0">
            <QuizTimer
              timeLimitSec={currentTimerLimit}
              resetKey={`${question.id}_${timerPhase}_${timerResetKey}`}
              paused={timerPaused || sessionIsPaused}
              onTick={handleTick}
              onTimeout={
                isTwoPhase
                  ? timerPhase === 1 ? handlePhase1Timeout : handlePhase2Timeout
                  : handleStandardTimeout
              }
              size={52}
            />
          </div>
        )}

        {/* Speed badge (após responder) */}
        {isAnswered && earnedScore && earnedScore.speedBonus > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex shrink-0 items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1"
          >
            <Zap className="h-3 w-3 text-emerald-400" />
            <span className="text-xs font-bold text-emerald-400">+{earnedScore.speedBonus}</span>
          </motion.div>
        )}
      </div>

      {/* Question text */}
      <h2 className="text-xl leading-relaxed font-semibold text-white md:text-2xl">{question.text}</h2>

      {/* ── FASE 1: Classificação ───────────────────────────────────────────────── */}
      {isTwoPhase && (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium text-slate-400">
            {phase1Revealed ? 'Classificação escolhida:' : 'Classifique a afirmativa:'}
          </p>
          <div className="flex gap-3" role="radiogroup" aria-label="Classificar como Competência ou Capacidade">
            <ClassificationButton
              label="Competência" colorVariant="blue"
              isSelected={phase1Selection === 'Competência'}
              isCorrect={phase1Revealed ? question.correctClassification === 'Competência' : null}
              isDisabled={phase1Revealed && phase1Selection !== 'Competência'}
              onClick={() => handlePhase1Click('Competência')}
            />
            <ClassificationButton
              label="Capacidade" colorVariant="violet"
              isSelected={phase1Selection === 'Capacidade'}
              isCorrect={phase1Revealed ? question.correctClassification === 'Capacidade' : null}
              isDisabled={phase1Revealed && phase1Selection !== 'Capacidade'}
              onClick={() => handlePhase1Click('Capacidade')}
            />
          </div>

          <AnimatePresence>
            {phase1Revealed && (
              <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
                className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium ${
                  phase1Correct
                    ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                    : 'border border-amber-500/30 bg-amber-500/10 text-amber-300'
                }`}
              >
                {phase1Correct ? (
                  <><CheckCircle2 className="h-4 w-4 shrink-0" /> Correto! Agora justifique sua resposta:</>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 shrink-0" />
                    {phase1Selection === null
                      ? <>Tempo esgotado! A resposta correta é <strong className="text-white">{question.correctClassification}</strong>. Por quê?</>
                      : <>A classificação correta é <strong className="text-white">{question.correctClassification}</strong>. Mas por quê?</>
                    }
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── FASE 2: Justificativa ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isTwoPhase && phase1Revealed && (
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15 }}
            className="flex flex-col gap-3"
          >
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-200">
              <HelpCircle className="h-4 w-4 text-blue-400" />
              {question.phase2!.prompt}
            </p>
            <div className="flex flex-col gap-2.5" role="radiogroup" aria-label="Selecione a justificativa">
              {(shuffledOptions as Phase2Option[]).map((option, index) => (
                <OptionButton
                  key={option.id} option={option} index={index}
                  isSelected={phase2Selection === option.id}
                  hasAnswered={phase2Revealed}
                  onSelect={() => handlePhase2Select(option.id)}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Questão padrão ───────────────────────────────────────────────────────── */}
      {!isTwoPhase && (
        <div className="flex flex-col gap-3" role="radiogroup" aria-label="Opções de resposta">
          {(shuffledOptions as Option[]).map((option, index) => (
            <OptionButton
              key={option.id} option={option} index={index}
              isSelected={standardSelection === option.id}
              hasAnswered={!!standardSelection}
              onSelect={() => handleStandardSelect(option.id)}
            />
          ))}
        </div>
      )}

      {/* ── Feedback ─────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isAnswered && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className={`rounded-xl border p-5 ${isCorrect ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-red-500/30 bg-red-500/10'}`}
            role="alert" aria-live="polite"
          >
            <div className="mb-3 flex items-center gap-2">
              {isCorrect ? (
                <><CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  <span className="font-semibold text-emerald-400">
                    {isTwoPhase ? 'Perfeito! Classificação e justificativa corretas.' : 'Correto!'}
                  </span></>
              ) : (
                <><XCircle className="h-5 w-5 text-red-400" />
                  <span className="font-semibold text-red-400">
                    {isTwoPhase ? 'Não foi dessa vez.' : <>
                      Não exatamente.{' '}
                      <span className="font-normal text-slate-300">
                        A resposta correta era:{' '}
                        <strong className="text-white">{(question.options as Option[]).find((o) => o.isCorrect)?.text}</strong>
                      </span>
                    </>}
                  </span></>
              )}
            </div>

            {/* Score breakdown */}
            {earnedScore && earnedScore.totalPoints > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-slate-700/50 px-3 py-0.5 text-xs text-slate-300">
                  +{earnedScore.basePoints} base
                </span>
                {earnedScore.speedBonus > 0 && (
                  <span className="rounded-full bg-emerald-500/20 px-3 py-0.5 text-xs text-emerald-400">
                    ⚡ +{earnedScore.speedBonus} velocidade
                  </span>
                )}
                {earnedScore.streakBonus > 0 && (
                  <span className="rounded-full bg-orange-500/20 px-3 py-0.5 text-xs text-orange-400">
                    🔥 +{earnedScore.streakBonus} sequência
                  </span>
                )}
                <span className="rounded-full bg-blue-500/20 px-3 py-0.5 text-xs font-bold text-blue-300">
                  = {earnedScore.totalPoints} pts
                </span>
              </div>
            )}

            <div className="flex items-start gap-2">
              <span className="mt-0.5 text-slate-400">💡</span>
              <p className="text-sm leading-relaxed text-slate-300">{question.explanation}</p>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-500">Conceito:</span>
              <Badge variant="outline" className={
                question.conceptHighlight === 'Competência'
                  ? 'border-blue-500/40 bg-blue-500/10 text-xs text-blue-300'
                  : question.conceptHighlight === 'Capacidade'
                    ? 'border-violet-500/40 bg-violet-500/10 text-xs text-violet-300'
                    : 'border-slate-500/40 bg-slate-500/10 text-xs text-slate-300'
              }>
                {question.conceptHighlight}
              </Badge>
              {question.capabilityCategory && (
                <Badge variant="outline" className="border-violet-500/30 bg-violet-500/10 text-xs text-violet-400">
                  {question.capabilityCategory}
                </Badge>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Botão Próxima */}
      <AnimatePresence>
        {isAnswered && (
          isRoomMode ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="text-center py-4 text-sm text-slate-500 italic font-medium"
            >
              Resposta registrada! Aguarde o apresentador na tela principal...
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
              className="flex justify-end"
            >
              <Button onClick={onNext} size="lg" className="bg-blue-600 px-8 font-semibold hover:bg-blue-700"
                aria-label={isLastQuestion ? 'Ver resultado final' : 'Próxima questão'}>
                {isLastQuestion ? 'Ver resultado' : 'Próxima'}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </motion.div>
          )
        )}
      </AnimatePresence>
    </div>
  )
}
