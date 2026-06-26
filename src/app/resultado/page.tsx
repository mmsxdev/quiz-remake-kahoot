'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useQuiz } from '@/lib/quiz-context'
import { ResultBreakdown } from '@/components/quiz/ResultBreakdown'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { AVATAR_STORAGE_KEY } from '@/data/avatars'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { RotateCcw, Home, Trophy, TrendingUp, Lightbulb, Star, Zap, Flame, Sun, Moon } from 'lucide-react'
import { ACHIEVEMENTS } from '@/lib/scoring'
import { getSessionRanking, type DbPlayer } from '@/lib/supabase-helpers'
import { useTheme } from '@/lib/theme'
import { useAudio } from '@/lib/audio-manager'

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
  const { theme, toggleTheme } = useTheme()
  const {
    state, dispatch, totalCorrect, totalQuestions, performanceLevel, blockScores,
    saveToRanking, ranking,
  } = useQuiz()
  const { playSfx } = useAudio()
  const savedRef = useRef(false)
  const [roomRanking, setRoomRanking] = useState<DbPlayer[]>([])
  const [loadingRoom, setLoadingRoom] = useState(false)
  const [avatarId, setAvatarId] = useState<string | null>(null)

  // Lê o avatar salvo no localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(AVATAR_STORAGE_KEY)
      if (saved) setAvatarId(saved)
    } catch {
      // SSR
    }
  }, [])

  useEffect(() => {
    if (state.phase === 'welcome') router.push('/')
    else if (state.phase === 'quiz') router.push('/quiz')
  }, [state.phase, router])

  useEffect(() => {
    if (state.phase === 'result' && !savedRef.current) {
      savedRef.current = true
      saveToRanking()
      // Toca fanfarra se o desempenho foi alto (>= 75%)
      const pct = totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0
      if (pct >= 75) {
        playSfx('fanfare')
      }
    }
  }, [state.phase, saveToRanking, playSfx, totalCorrect, totalQuestions])

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
    <>
      {/* Container Interativo Principal (Oculto na Impressão) */}
      <main className="relative min-h-screen bg-background text-foreground transition-colors duration-300 print:hidden">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute top-20 right-0 h-96 w-96 rounded-full bg-blue-600/5 dark:bg-blue-600/8 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-80 w-80 rounded-full bg-violet-600/5 dark:bg-violet-600/8 blur-3xl" />
        </div>

        {/* Botão de Alternar Tema (Fixo no canto superior direito) */}
        <div className="absolute top-6 right-6 z-30">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/40 rounded-full shadow-sm"
            title={theme === 'dark' ? 'Alternar para Tema Claro' : 'Alternar para Tema Escuro'}
          >
            {theme === 'dark' ? <Sun className="h-5 w-5 text-amber-500" /> : <Moon className="h-5 w-5 text-blue-600" />}
          </Button>
        </div>

        <div className="relative z-10 mx-auto max-w-3xl px-6 py-16">
          {/* Score hero */}
          <motion.div className="mb-8 text-center" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
            <div className="mb-4 inline-flex flex-col items-center gap-2">
              <PlayerAvatar
                avatarId={avatarId}
                size="lg"
                name={state.playerName}
                className="ring-2 ring-offset-2 ring-offset-background ring-blue-500/40"
              />
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">{state.playerName}</span>
            </div>

            <h1 className="font-display mb-1 text-5xl font-bold text-slate-800 dark:text-white md:text-6xl">
              {state.totalScore.toLocaleString()}
            </h1>
            <p className="mb-2 text-slate-500 dark:text-slate-400">pontos totais</p>
            <p className="mb-4 text-xl text-slate-700 dark:text-slate-300">
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
          <motion.div className="mb-6 rounded-xl border border-slate-200 dark:border-slate-700/40 bg-white dark:bg-slate-800/40 p-5 backdrop-blur-sm"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <p className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <Star className="h-4 w-4" /> Composição da Pontuação
            </p>
            <div className="space-y-2">
              {[
                { label: 'Respostas corretas (base)', value: baseTotal, icon: '✅', color: 'text-slate-800 dark:text-white' },
                { label: 'Bônus de velocidade', value: speedTotal, icon: '⚡', color: 'text-emerald-600 dark:text-emerald-400' },
                { label: 'Bônus de sequência', value: streakTotal, icon: '🔥', color: 'text-orange-600 dark:text-orange-400' },
                { label: 'Conquistas', value: achievementTotal, icon: '🏆', color: 'text-amber-600 dark:text-amber-400' },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">{item.icon} {item.label}</span>
                  <span className={`font-bold ${item.color}`}>+{item.value.toLocaleString()}</span>
                </div>
              ))}
              <div className="my-2 border-t border-slate-200 dark:border-slate-700" />
              <div className="flex items-center justify-between text-sm font-bold">
                <span className="text-slate-700 dark:text-slate-200">Total</span>
                <span className="text-blue-600 dark:text-blue-300">{state.totalScore.toLocaleString()} pts</span>
              </div>
            </div>
          </motion.div>

          {/* Streak e conquistas */}
          {(state.maxStreak >= 3 || state.unlockedAchievements.length > 0) && (
            <motion.div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
              {state.maxStreak >= 3 && (
                <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-4">
                  <p className="mb-1 flex items-center gap-2 text-sm font-semibold text-orange-400 dark:text-orange-300">
                    <Flame className="h-4 w-4" /> Melhor sequência
                  </p>
                  <p className="text-2xl font-bold text-slate-800 dark:text-white">{state.maxStreak}x consecutivos</p>
                </div>
              )}
              {state.unlockedAchievements.length > 0 && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                  <p className="mb-2 text-sm font-semibold text-amber-400 dark:text-amber-300">🏆 Conquistas</p>
                  <div className="flex flex-wrap gap-2">
                    {state.unlockedAchievements.map((id) => (
                      <span key={id} title={ACHIEVEMENTS[id]?.description}
                        className="flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-600 dark:text-amber-200">
                        {ACHIEVEMENTS[id]?.emoji} {ACHIEVEMENTS[id]?.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Diagnóstico */}
          <motion.div className="mb-6 rounded-xl border border-slate-200 dark:border-slate-700/40 bg-white dark:bg-slate-800/40 p-6 backdrop-blur-sm"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <div className="mb-3 flex items-center gap-2 text-slate-500 dark:text-slate-400">
              <Lightbulb className="h-4 w-4" />
              <span className="text-sm font-semibold uppercase tracking-wider">Diagnóstico pedagógico</span>
            </div>
            <p className="leading-relaxed text-slate-700 dark:text-slate-300">{config.message}</p>
          </motion.div>

          {/* Desempenho por bloco */}
          <motion.div className="mb-6" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <div className="mb-4 flex items-center gap-2 text-slate-500 dark:text-slate-400">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm font-semibold uppercase tracking-wider">Desempenho por bloco</span>
            </div>
            <ResultBreakdown blockScores={blockScores} />
          </motion.div>

          {/* Classificação Completa da Sala (apenas leitura para o jogador) */}
          {isRoomMode && roomRanking.length > 0 && (
            <motion.div className="mb-6 rounded-xl border border-slate-200 dark:border-slate-700/40 bg-white dark:bg-slate-800/40 p-5 backdrop-blur-sm"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
              <p className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <Trophy className="h-4 w-4 text-amber-500" /> Classificação Geral da Sala
              </p>
              
              {loadingRoom ? (
                <p className="text-xs text-slate-500 animate-pulse text-center py-4">Atualizando classificação da sala...</p>
              ) : (
                <div className="overflow-x-auto max-h-[300px] overflow-y-auto pr-1 scrollbar-thin">
                  <table className="w-full text-left border-collapse text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-950/40 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                        <th className="py-2.5 px-3 w-16 text-center">Posição</th>
                        <th className="py-2.5 px-3">Nome</th>
                        <th className="py-2.5 px-3 text-center">Pontos</th>
                        <th className="py-2.5 px-3 text-center">Acertos</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {roomRanking.map((p, idx) => {
                        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null
                        const isMe = p.id === state.playerId
                        return (
                          <tr key={p.id} className={`transition-colors ${isMe ? 'bg-blue-500/10 hover:bg-blue-500/15' : 'hover:bg-slate-100/50 dark:hover:bg-slate-800/20'}`}>
                            <td className="py-2.5 px-3 text-center font-black text-slate-500 dark:text-slate-300">
                              {medal || `${idx + 1}º`}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-2">
                                <PlayerAvatar avatarId={p.avatar_id} size="sm" name={p.name} />
                                <span className={`font-semibold ${isMe ? 'text-blue-600 dark:text-blue-300 font-bold' : 'text-slate-800 dark:text-slate-300'}`}>
                                  {p.name} {isMe && ' (Você)'}
                                </span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-bold text-blue-600 dark:text-blue-400">
                              {p.score.toLocaleString()}
                            </td>
                            <td className="py-2.5 px-3 text-center text-slate-500 dark:text-slate-400">
                              {p.correct_answers}/{p.total_questions}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          )}

          {/* Mensagem-chave */}
          <motion.div className="my-8 rounded-xl border border-blue-200 dark:border-blue-500/20 bg-blue-50/50 dark:bg-blue-500/5 p-6"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
            <p className="mb-3 text-sm font-semibold text-blue-600 dark:text-blue-400">💡 Mensagem-chave da MSEP</p>
            <div className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
              <p>📘 <strong>Capacidade</strong> é aquilo que o aluno <em>desenvolve durante a formação</em>.</p>
              <p>🎯 <strong>Competência</strong> é aquilo que o professional <em>demonstra ao atuar em situações reais de trabalho</em>.</p>
              <p>✅ Na MSEP, o foco do docente é <em>desenvolver capacidades</em> para que o estudante alcance as <em>competências previstas no Perfil Profissional</em>.</p>
            </div>
          </motion.div>

          {/* Ações */}
          <motion.div className="flex flex-col gap-3 sm:flex-row"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
            <Button
              onClick={() => window.print()}
              size="lg"
              className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 py-6 text-lg font-semibold hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg"
            >
              📄 Salvar PDF do Resultado
            </Button>
            
            <Button
              onClick={() => {
                dispatch({ type: 'RESTART_QUIZ' })
                router.push('/')
              }}
              size="lg"
              variant="outline"
              className="flex-1 py-6 text-lg font-semibold border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900"
            >
              <Home className="mr-2 h-5 w-5" /> Tela inicial
            </Button>
          </motion.div>
   
          <motion.p className="mt-6 text-center text-xs text-slate-500" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>
            {isRoomMode
              ? `Sua pontuação foi salva na sala ${state.sessionCode}. Você completou sua tentativa.`
              : 'Sua pontuação foi salva no ranking local. Você completou sua tentativa.'}
          </motion.p>
        </div>
      </main>

      {/* Layout Oculto na Tela, Visível Apenas na Impressão (Relatório de PDF A4 Limpo) */}
      <div className="hidden print:block text-slate-900 bg-white p-8 font-sans max-w-4xl mx-auto">
        <div className="border-b-2 border-blue-600 pb-4 mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-blue-900">QuizDida</h1>
            <p className="text-[10px] uppercase font-mono tracking-widest text-slate-500">
              Metodologia SENAI de Educação Profissional — MSEP
            </p>
          </div>
          <div className="text-right">
            <span className="bg-blue-50 text-blue-800 border border-blue-200 px-3 py-1 text-xs font-bold rounded">
              Relatório de Autoformação
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <p className="text-[10px] font-semibold uppercase text-slate-500">Participante</p>
            <p className="text-lg font-bold text-slate-800">{state.playerName}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-semibold uppercase text-slate-500">Data de Emissão</p>
            <p className="text-sm font-semibold text-slate-700">{new Date().toLocaleString('pt-BR')}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 border border-slate-200 rounded-xl p-4 bg-slate-50 mb-6">
          <div className="text-center border-r border-slate-200">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Pontuação Total</p>
            <p className="text-2xl font-black text-blue-600 mt-1">{state.totalScore.toLocaleString()}</p>
          </div>
          <div className="text-center border-r border-slate-200">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Acertos</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">{totalCorrect} / {totalQuestions}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Aproveitamento MSEP</p>
            <p className="text-lg font-bold text-emerald-600 mt-1.5">{config.label}</p>
          </div>
        </div>

        <div className="mb-6">
          <h2 className="text-xs font-bold uppercase text-slate-700 border-b border-slate-200 pb-1.5 mb-2">
            Diagnóstico Pedagógico
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed italic">{config.message}</p>
        </div>

        <div className="mb-6">
          <h2 className="text-xs font-bold uppercase text-slate-700 border-b border-slate-200 pb-1.5 mb-3">
            Desempenho por Bloco
          </h2>
          <div className="space-y-3">
            {Object.entries(blockScores).map(([block, data]: [string, any]) => {
              const bPct = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0
              return (
                <div key={block} className="text-sm">
                  <div className="flex justify-between font-semibold mb-1 text-slate-700">
                    <span>
                      Bloco {block} — {block === 'A' ? 'Definições Metodológicas' : 'Aplicações no Cotidiano Docente'}
                    </span>
                    <span>
                      {data.correct} / {data.total} acertos ({bPct}%)
                    </span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                    <div className="h-full bg-blue-600 rounded-full" style={{ width: `${bPct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="border border-slate-200 pt-4 mt-8 bg-slate-50 p-4 rounded-xl">
          <p className="text-xs font-bold text-blue-800 mb-1.5">💡 Conceitos Fundamentais da MSEP para Reflexão</p>
          <div className="space-y-1.5 text-xs text-slate-600 leading-relaxed">
            <p>
              • <strong>Capacidade</strong>: Corresponde aos saberes, habilidades e atitudes integrados que o estudante constrói e desenvolve durante o seu processo formativo dentro da instituição de ensino.
            </p>
            <p>
              • <strong>Competência</strong>: Consiste na capacidade de mobilizar articuladamente esses saberes no contexto profissional, atuando com autonomia e responsabilidade na resolução de problemas reais de trabalho.
            </p>
            <p>
              • <strong>Ação Docente</strong>: Na Metodologia SENAI, o foco é mediar e promover o desenvolvimento de capacidades para viabilizar a constituição da competência profissional definida no perfil de saída.
            </p>
          </div>
        </div>

        <div className="mt-16 text-center text-[8px] text-slate-400 uppercase tracking-widest border-t border-slate-200 pt-4">
          Emitido de forma segura pelo QuizDida • Portal de Formação Continuada SENAI
        </div>
      </div>
    </>
  )
}
