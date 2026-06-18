'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useQuiz } from '@/lib/quiz-context'
import { ResultBreakdown } from '@/components/quiz/ResultBreakdown'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RotateCcw, Home, Trophy, TrendingUp, Lightbulb, Star, Zap, Flame } from 'lucide-react'
import { ACHIEVEMENTS } from '@/lib/scoring'
import { getSessionRanking, type DbPlayer } from '@/lib/supabase-helpers'

const levelConfig = {
  iniciante: {
    emoji: '🌱', label: 'Iniciante',
    color: 'text-slate-300', borderColor: 'border-slate-500/40', bgColor: 'bg-slate-500/10',
    message: 'Você está começando sua jornada na MSEP! Recomendamos revisitar o material sobre Competências e Capacidades antes de explorar as atividades de sala de aula.',
  },
  em_desenvolvimento: {
    emoji: '🚀', label: 'Em Desenvolvimento',
    color: 'text-amber-300', borderColor: 'border-amber-500/40', bgColor: 'bg-amber-500/10',
    message: 'Você demonstra uma boa base conceitual! Alguns pontos ainda merecem atenção — especialmente a distinção em situações do cotidiano docente.',
  },
  consolidado: {
    emoji: '⭐', label: 'Consolidado',
    color: 'text-emerald-300', borderColor: 'border-emerald-500/40', bgColor: 'bg-emerald-500/10',
    message: 'Excelente! Você demonstra domínio sólido sobre os conceitos centrais da MSEP. Continue sendo referência para seus colegas nessa metodologia.',
  },
}

export default function ResultadoPage() {
  const router = useRouter()
  const {
    state, dispatch, totalCorrect, totalQuestions, performanceLevel, blockScores,
    saveToRanking, ranking,
  } = useQuiz()
  const savedRef = useRef(false)
  const [roomRanking, setRoomRanking] = useState<DbPlayer[]>([])
  const [loadingRoom, setLoadingRoom] = useState(false)

  useEffect(() => {
    if (state.phase === 'welcome') router.push('/')
    else if (state.phase === 'quiz') router.push('/quiz')
  }, [state.phase, router])

  useEffect(() => {
    if (state.phase === 'result' && !savedRef.current) {
      savedRef.current = true
      saveToRanking()
    }
  }, [state.phase, saveToRanking])

  // Busca o ranking da sala após um pequeno delay para dar tempo do progresso ser sincronizado
  useEffect(() => {
    if (state.phase === 'result' && state.sessionId) {
      setLoadingRoom(true)
      const timer = setTimeout(async () => {
        try {
          const rank = await getSessionRanking(state.sessionId!)
          setRoomRanking(rank)
        } catch (err) {
          console.error('Erro ao buscar ranking da sala:', err)
        } finally {
          setLoadingRoom(false)
        }
      }, 1800)

      return () => clearTimeout(timer)
    }
  }, [state.phase, state.sessionId])

  if (state.phase !== 'result') return null

  const percentage = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0
  const config = levelConfig[performanceLevel]

  // Score breakdown
  const baseTotal = state.results.reduce((s, r) => s + r.score.basePoints, 0)
  const speedTotal = state.results.reduce((s, r) => s + r.score.speedBonus, 0)
  const streakTotal = state.results.reduce((s, r) => s + r.score.streakBonus, 0)
  const achievementTotal = state.unlockedAchievements.reduce((s, id) => s + (ACHIEVEMENTS[id]?.bonusPoints ?? 0), 0)

  // Posição no ranking (Sala ou Local)
  const isRoomMode = !!state.sessionCode
  
  const myRankPosition = useMemo(() => {
    if (isRoomMode) {
      if (roomRanking.length === 0) return null
      const idx = roomRanking.findIndex((p) => p.id === state.playerId)
      return idx !== -1 ? idx + 1 : null
    } else {
      const myRankingEntry = ranking.find((e) => e.name === state.playerName)
      return myRankingEntry ? ranking.indexOf(myRankingEntry) + 1 : null
    }
  }, [isRoomMode, roomRanking, ranking, state.playerId, state.playerName])

  return (
    <main className="relative min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-20 right-0 h-96 w-96 rounded-full bg-blue-600/8 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-80 w-80 rounded-full bg-violet-600/8 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-3xl px-6 py-16">
        {/* Score hero */}
        <motion.div className="mb-8 text-center" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
          <div className="mb-4 inline-flex h-24 w-24 items-center justify-center rounded-full border border-slate-700/50 bg-slate-800/50 text-5xl backdrop-blur-sm">
            {config.emoji}
          </div>

          <h1 className="font-display mb-1 text-5xl font-bold text-white md:text-6xl">
            {state.totalScore.toLocaleString()}
          </h1>
          <p className="mb-2 text-slate-400">pontos totais</p>
          <p className="mb-4 text-xl text-slate-300">
            {totalCorrect}/{totalQuestions} acertos ({percentage}%)
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <Badge variant="outline" className={`${config.borderColor} ${config.bgColor} ${config.color} px-4 py-1.5 text-base`}>
              <Trophy className="mr-2 h-4 w-4" />{config.label}
            </Badge>
            {myRankPosition && (
              <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 px-4 py-1.5 text-base text-amber-300">
                <Star className="mr-2 h-4 w-4" />#{myRankPosition} no ranking
              </Badge>
            )}
          </div>
        </motion.div>

        {/* Score breakdown */}
        <motion.div className="mb-6 rounded-xl border border-slate-700/40 bg-slate-800/40 p-5 backdrop-blur-sm"
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <p className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
            <Star className="h-4 w-4" /> Composição da Pontuação
          </p>
          <div className="space-y-2">
            {[
              { label: 'Respostas corretas (base)', value: baseTotal, icon: '✅', color: 'text-white' },
              { label: 'Bônus de velocidade', value: speedTotal, icon: '⚡', color: 'text-emerald-400' },
              { label: 'Bônus de sequência', value: streakTotal, icon: '🔥', color: 'text-orange-400' },
              { label: 'Conquistas', value: achievementTotal, icon: '🏆', color: 'text-amber-400' },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between text-sm">
                <span className="text-slate-400">{item.icon} {item.label}</span>
                <span className={`font-bold ${item.color}`}>+{item.value.toLocaleString()}</span>
              </div>
            ))}
            <div className="my-2 border-t border-slate-700" />
            <div className="flex items-center justify-between text-sm font-bold">
              <span className="text-slate-200">Total</span>
              <span className="text-blue-300">{state.totalScore.toLocaleString()} pts</span>
            </div>
          </div>
        </motion.div>

        {/* Streak e conquistas */}
        {(state.maxStreak >= 3 || state.unlockedAchievements.length > 0) && (
          <motion.div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            {state.maxStreak >= 3 && (
              <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-4">
                <p className="mb-1 flex items-center gap-2 text-sm font-semibold text-orange-300">
                  <Flame className="h-4 w-4" /> Melhor sequência
                </p>
                <p className="text-2xl font-bold text-white">{state.maxStreak}x consecutivos</p>
              </div>
            )}
            {state.unlockedAchievements.length > 0 && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                <p className="mb-2 text-sm font-semibold text-amber-300">🏆 Conquistas</p>
                <div className="flex flex-wrap gap-2">
                  {state.unlockedAchievements.map((id) => (
                    <span key={id} title={ACHIEVEMENTS[id]?.description}
                      className="flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-200">
                      {ACHIEVEMENTS[id]?.emoji} {ACHIEVEMENTS[id]?.label}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Diagnóstico */}
        <motion.div className="mb-6 rounded-xl border border-slate-700/40 bg-slate-800/40 p-6 backdrop-blur-sm"
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <div className="mb-3 flex items-center gap-2 text-slate-400">
            <Lightbulb className="h-4 w-4" />
            <span className="text-sm font-semibold uppercase tracking-wider">Diagnóstico pedagógico</span>
          </div>
          <p className="leading-relaxed text-slate-300">{config.message}</p>
        </motion.div>

        {/* Desempenho por bloco */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <div className="mb-4 flex items-center gap-2 text-slate-400">
            <TrendingUp className="h-4 w-4" />
            <span className="text-sm font-semibold uppercase tracking-wider">Desempenho por bloco</span>
          </div>
          <ResultBreakdown blockScores={blockScores} />
        </motion.div>

        {/* Mensagem-chave */}
        <motion.div className="my-8 rounded-xl border border-blue-500/20 bg-blue-500/5 p-6"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
          <p className="mb-3 text-sm font-semibold text-blue-400">💡 Mensagem-chave da MSEP</p>
          <div className="space-y-2 text-sm text-slate-300">
            <p>📘 <strong>Capacidade</strong> é aquilo que o aluno <em>desenvolve durante a formação</em>.</p>
            <p>🎯 <strong>Competência</strong> é aquilo que o profissional <em>demonstra ao atuar em situações reais de trabalho</em>.</p>
            <p>✅ Na MSEP, o foco do docente é <em>desenvolver capacidades</em> para que o estudante alcance as <em>competências previstas no Perfil Profissional</em>.</p>
          </div>
        </motion.div>

        {/* Ações */}
        <motion.div className="flex flex-col gap-3 sm:flex-row"
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
          {isRoomMode && (
            <Button
              onClick={() => router.push(`/sala/${state.sessionCode}/ranking`)}
              size="lg"
              className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 py-6 text-lg font-semibold hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg"
            >
              <Trophy className="mr-2 h-5 w-5 text-amber-400" /> Ver Ranking da Sala
            </Button>
          )}
          <Button
            onClick={() => router.push('/')}
            size="lg"
            variant={isRoomMode ? 'outline' : 'default'}
            className={`flex-1 py-6 text-lg font-semibold ${isRoomMode ? 'border-slate-800 text-slate-300 hover:bg-slate-900' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            <Home className="mr-2 h-5 w-5" /> Tela inicial
          </Button>
        </motion.div>
 
        <motion.p className="mt-6 text-center text-xs text-slate-650" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>
          {isRoomMode
            ? `Sua pontuação foi salva na sala ${state.sessionCode}. Você completou sua tentativa.`
            : 'Sua pontuação foi salva no ranking local. Você completou sua tentativa.'}
        </motion.p>
      </div>
    </main>
  )
}
