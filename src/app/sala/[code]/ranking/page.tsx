'use client'

import React, { useEffect, useState, useMemo, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Trophy, Users, CheckCircle, Flame, Star, AlertCircle, ShieldAlert, Ban, QrCode, Home, Play, ArrowRight, Check, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase'
import { getSessionByCode, getSessionRanking, closeSession, updateSessionStatus, type DbPlayer, type DbSession } from '@/lib/supabase-helpers'
import { ACHIEVEMENTS, SCORE_CONFIG } from '@/lib/scoring'
import questionsData from '@/data/questions.json'
import type { Question, Option, Phase2Option } from '@/lib/types'

const questions = questionsData as Question[]

export default function RankingSalaPage() {
  const params = useParams()
  const router = useRouter()
  const code = typeof params?.code === 'string' ? params.code : ''

  // Banco de dados
  const [session, setSession] = useState<DbSession | null>(null)
  const [players, setPlayers] = useState<DbPlayer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Estados locais da apresentação
  const [timeLeft, setTimeLeft] = useState(30)
  const [timerActive, setTimerActive] = useState(false)
  const [revealed, setRevealed] = useState(false) // Se o Host já revelou a resposta desta questão
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 1. Busca inicial da sessão e ranking
  useEffect(() => {
    if (!code) return

    async function loadData() {
      try {
        setLoading(true)
        const sess = await getSessionByCode(code)
        if (!sess) {
          setError(`Sala "${code}" não encontrada ou já encerrada.`)
          return
        }
        setSession(sess)

        const rank = await getSessionRanking(sess.id)
        setPlayers(rank)
      } catch (err: any) {
        console.error(err)
        setError('Erro ao carregar dados do ranking.')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [code])

  // 2. Realtime subscription para atualizar jogadores e sessão
  useEffect(() => {
    if (!session || !supabase) return

    // Escuta mudanças nos participantes (cadastro, score, last_answered_index)
    const playersChannel = supabase
      .channel(`ranking-realtime-${session.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'quiz_players',
          filter: `session_id=eq.${session.id}`,
        },
        async () => {
          try {
            const updatedRank = await getSessionRanking(session.id)
            setPlayers(updatedRank)
          } catch (err) {
            console.error('Erro ao atualizar ranking em tempo real:', err)
          }
        }
      )
      .subscribe()

    // Escuta mudanças na sessão (caso o Host controle por outro dispositivo ou para sincronização)
    const sessionChannel = supabase
      .channel(`session-realtime-${session.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'quiz_sessions',
          filter: `id=eq.${session.id}`,
        },
        (payload) => {
          const updatedSess = payload.new as DbSession
          if (updatedSess) {
            setSession((prev) => prev ? { ...prev, status: updatedSess.status, current_question_index: updatedSess.current_question_index } : null)
          }
        }
      )
      .subscribe()

    return () => {
      supabase?.removeChannel(playersChannel)
      supabase?.removeChannel(sessionChannel)
    }
  }, [session])

  // 3. Gerenciamento do Cronômetro do Host
  useEffect(() => {
    if (!session || session.status !== 'question' || !session.timer_enabled || revealed) {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      setTimerActive(false)
      return
    }

    // Define o tempo inicial da questão
    const activeQuestion = questions[session.current_question_index]
    const limit = activeQuestion?.type === 'two-phase'
      ? SCORE_CONFIG.TIME_LIMIT_TWO_PHASE_P1 + SCORE_CONFIG.TIME_LIMIT_TWO_PHASE_P2
      : SCORE_CONFIG.TIME_LIMIT_STANDARD

    setTimeLeft(limit)
    setTimerActive(true)

    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          if (timerRef.current) clearInterval(timerRef.current)
          setRevealed(true) // Auto-revela quando o tempo acaba
          return 0
        }
        return t - 1
      })
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [session?.status, session?.current_question_index, session?.timer_enabled, revealed])

  // Reseta estado de revelação ao mudar de questão
  useEffect(() => {
    setRevealed(false)
  }, [session?.current_question_index, session?.status])

  // 4. Ações do Apresentador (Host)
  async function handleStartQuiz() {
    if (!session) return
    try {
      await updateSessionStatus(session.id, 'question', 0)
    } catch (err: any) {
      alert(`Erro ao iniciar: ${err.message}`)
    }
  }

  async function handleRevealAnswer() {
    setRevealed(true)
  }

  async function handleShowLeaderboard() {
    if (!session) return
    try {
      await updateSessionStatus(session.id, 'leaderboard', session.current_question_index)
    } catch (err: any) {
      alert(`Erro ao mostrar leaderboard: ${err.message}`)
    }
  }

  async function handleNextQuestion() {
    if (!session) return
    const nextIdx = session.current_question_index + 1
    const isFinished = nextIdx >= questions.length

    try {
      if (isFinished) {
        await updateSessionStatus(session.id, 'ended', session.current_question_index)
      } else {
        await updateSessionStatus(session.id, 'question', nextIdx)
      }
    } catch (err: any) {
      alert(`Erro ao avançar: ${err.message}`)
    }
  }

  async function handleCloseSession() {
    if (!session) return
    if (!confirm('Tem certeza que deseja encerrar permanentemente esta sessão?')) return

    try {
      await closeSession(session.id)
      router.push('/')
    } catch (err: any) {
      alert(`Erro ao encerrar sessão: ${err.message}`)
    }
  }

  // ─── Dados Calculados ───────────────────────────────────────────────────────
  
  const activeQuestion = useMemo(() => {
    if (!session || session.status === 'lobby' || session.status === 'ended') return null
    return questions[session.current_question_index] ?? null
  }, [session])

  // Jogadores que já responderam a questão ativa
  const answeredPlayersCount = useMemo(() => {
    if (!session || session.status !== 'question') return 0
    return players.filter((p) => p.last_answered_index >= session.current_question_index).length
  }, [players, session])

  // Distribuição de respostas para exibir no gráfico
  const answerDistribution = useMemo(() => {
    if (!activeQuestion || !session) return {}
    const dist: Record<string, number> = {}

    const options = activeQuestion.type === 'two-phase'
      ? activeQuestion.phase2?.options ?? []
      : activeQuestion.options

    options.forEach((o) => { dist[o.id] = 0 })

    players.forEach((p) => {
      if (p.last_answered_index >= session.current_question_index) {
        const ans = p.answers?.find((a: any) => a.questionId === activeQuestion.id)
        if (ans) {
          dist[ans.selectedOptionId] = (dist[ans.selectedOptionId] || 0) + 1
        }
      }
    })

    return dist
  }, [activeQuestion, players, session])

  // Auto-revela resposta se todos os participantes já responderam
  useEffect(() => {
    if (session?.status === 'question' && players.length > 0 && answeredPlayersCount === players.length && !revealed) {
      setRevealed(true)
    }
  }, [answeredPlayersCount, players.length, session?.status, revealed])

  // Top 5 jogadores para o Leaderboard
  const topPlayers = useMemo(() => {
    return players.slice(0, 5)
  }, [players])

  // Top 3 jogadores para o Pódio Final
  const podiumPlayers = useMemo(() => {
    if (players.length === 0) return []
    // Retorna ordenado: [Segundo (1), Primeiro (0), Terceiro (2)] para renderizar na ordem visual do pódio
    const sorted = [...players].slice(0, 3)
    const podium = []
    if (sorted[1]) podium.push(sorted[1]) // 2º Lugar (Esquerda)
    if (sorted[0]) podium.push(sorted[0]) // 1º Lugar (Centro)
    if (sorted[2]) podium.push(sorted[2]) // 3º Lugar (Direita)
    return podium.length > 0 ? podium : sorted
  }, [players])

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 text-white">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
        <p className="mt-4 text-sm text-slate-400">Carregando painel do apresentador...</p>
      </div>
    )
  }

  if (error || !session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6 text-center text-white">
        <div className="mb-4 rounded-full bg-red-500/10 p-4 text-red-400">
          <AlertCircle className="h-12 w-12" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Ops! Sessão não encontrada</h1>
        <p className="text-slate-400 max-w-md mb-6">{error || 'A sessão está inativa ou indisponível.'}</p>
        <Button onClick={() => router.push('/')} className="bg-blue-600 hover:bg-blue-700">
          Voltar ao Início
        </Button>
      </div>
    )
  }

  return (
    <main className="relative min-h-screen bg-slate-950 font-sans text-white overflow-x-hidden flex flex-col justify-between">
      {/* Background decorativo sutil */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-0 right-1/4 h-[500px] w-[500px] rounded-full bg-blue-600/5 blur-3xl" />
        <div className="absolute bottom-0 left-1/4 h-[500px] w-[500px] rounded-full bg-violet-600/5 blur-3xl" />
      </div>

      {/* Top Bar do Host (Sempre visível) */}
      <header className="relative z-20 border-b border-slate-800/80 bg-slate-900/30 px-6 py-4 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="rounded bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 text-[10px] font-bold text-blue-300">
                Apresentador
              </span>
              <span className="text-xs text-slate-500 font-medium">
                Sala: <strong className="text-slate-350">{session.code}</strong>
              </span>
            </div>
            <h1 className="text-lg font-bold text-white truncate max-w-[280px] sm:max-w-md">{session.title}</h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-slate-400 text-sm">
              <Users className="h-4 w-4 text-blue-400" />
              <span><strong>{players.length}</strong> conectados</span>
            </div>
            <Button onClick={handleCloseSession} variant="ghost" size="sm" className="text-red-400 hover:text-white hover:bg-red-950/20">
              Encerrar Sala
            </Button>
          </div>
        </div>
      </header>

      {/* Conteúdo Dinâmico por Status da Sessão */}
      <div className="relative z-10 mx-auto flex-1 w-full max-w-6xl px-6 py-10 flex flex-col justify-center">
        <AnimatePresence mode="wait">
          
          {/* ─── ESTADO: LOBBY ────────────────────────────────────────────────── */}
          {session.status === 'lobby' && (
            <motion.div
              key="lobby"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-1 gap-8 lg:grid-cols-3 items-center"
            >
              {/* Painel do Código e Instruções de Acesso */}
              <div className="lg:col-span-1 space-y-6">
                <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-md shadow-2xl p-6 text-center">
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Como participar?</p>
                  <p className="text-sm text-slate-300 font-medium leading-relaxed">
                    Acesse pelo celular usando o código abaixo:
                  </p>
                  <div className="font-display text-5xl font-black tracking-widest text-blue-400 my-4 select-all">
                    {session.code}
                  </div>
                  <div className="flex justify-center my-4">
                    <div className="rounded-xl border border-slate-700 bg-white p-3 shadow-lg">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
                          `${typeof window !== 'undefined' ? window.location.protocol + '//' + window.location.host : ''}?sala=${session.code}`
                        )}&color=0f172a`}
                        alt="QR Code"
                        className="h-36 w-36"
                      />
                    </div>
                  </div>
                  <Button
                    onClick={handleStartQuiz}
                    disabled={players.length === 0}
                    className="w-full bg-blue-600 hover:bg-blue-700 py-6 text-lg font-bold shadow-lg shadow-blue-900/30 disabled:opacity-40"
                  >
                    Começar Quiz ({players.length}) <Play className="ml-2 h-5 w-5" />
                  </Button>
                </Card>
              </div>

              {/* Lista de Alunos conectados no Lobby */}
              <div className="lg:col-span-2 space-y-4">
                <h2 className="text-lg font-bold text-slate-300 flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-400" /> Participantes na Sala
                </h2>
                
                {players.length > 0 ? (
                  <div className="flex flex-wrap gap-3 max-h-[400px] overflow-y-auto pr-2">
                    {players.map((p, idx) => (
                      <motion.div
                        key={p.id}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: 'spring', stiffness: 200, delay: idx * 0.05 }}
                        className="rounded-full border border-slate-800 bg-slate-900/60 px-5 py-2.5 text-base font-semibold text-slate-200 shadow-sm"
                      >
                        🎓 {p.name}
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 border border-dashed border-slate-800 rounded-2xl bg-slate-900/10">
                    <Users className="h-10 w-10 text-slate-650 animate-pulse mb-3" />
                    <p className="text-base text-slate-400 font-medium">Aguardando participantes entrarem...</p>
                    <p className="text-xs text-slate-600 mt-1">Insira seu nome e código para aparecer aqui.</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ─── ESTADO: QUESTÃO ATIVA ───────────────────────────────────────── */}
          {session.status === 'question' && activeQuestion && (
            <motion.div
              key="question"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-8"
            >
              {/* Enunciado e Header */}
              <div className="text-center max-w-4xl mx-auto space-y-4">
                <Badge className="bg-blue-500/10 text-blue-300 border-blue-500/20 text-xs py-1 px-3">
                  Questão {session.current_question_index + 1} de {questions.length} • Bloco {activeQuestion.block}
                </Badge>
                <h2 className="font-display text-3xl font-extrabold text-white sm:text-4xl leading-snug">
                  {activeQuestion.text}
                </h2>
              </div>

              {/* Grid Central: Timer e Respostas Submetidas */}
              <div className="flex flex-col items-center justify-center gap-8 md:flex-row md:gap-16">
                
                {/* Timer gigante */}
                {session.timer_enabled && !revealed ? (
                  <div className="relative flex items-center justify-center h-40 w-40 rounded-full border-4 border-slate-800 bg-slate-900/40">
                    <div className="text-center">
                      <span className={`text-6xl font-black tracking-tight ${timeLeft <= 5 ? 'text-red-500 animate-pulse' : 'text-blue-400'}`}>
                        {timeLeft}
                      </span>
                      <p className="text-[10px] uppercase text-slate-500 font-bold tracking-wider mt-1">Segundos</p>
                    </div>
                  </div>
                ) : (
                  <div className="relative flex items-center justify-center h-40 w-40 rounded-full border-4 border-dashed border-slate-850 bg-slate-950">
                    <div className="text-center text-slate-600">
                      <span className="text-4xl">⏳</span>
                      <p className="text-[9px] uppercase font-bold tracking-wider mt-1">Tempo Livre</p>
                    </div>
                  </div>
                )}

                {/* Submissões */}
                <div className="flex flex-col items-center justify-center h-40 w-40 rounded-full border-4 border-slate-800 bg-slate-900/40">
                  <div className="text-center">
                    <span className="text-5xl font-black tracking-tight text-violet-400">
                      {answeredPlayersCount}
                    </span>
                    <span className="text-slate-500 text-xl font-bold">/{players.length}</span>
                    <p className="text-[10px] uppercase text-slate-500 font-bold tracking-wider mt-1">Respostas</p>
                  </div>
                </div>

              </div>

              {/* Distribuição das Respostas (Gráfico) ou Listagem de Opções */}
              <div className="max-w-3xl mx-auto">
                <AnimatePresence mode="wait">
                  {!revealed ? (
                    /* Aguardando finalização, mostra opções normais */
                    <motion.div key="options" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {(activeQuestion.type === 'two-phase' ? activeQuestion.phase2?.options ?? [] : activeQuestion.options).map((opt, i) => (
                        <div key={opt.id} className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/30 px-5 py-4">
                          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-800 font-mono text-sm font-bold text-slate-400 select-none">
                            {String.fromCharCode(65 + i)}
                          </span>
                          <span className="text-slate-300 font-medium text-sm sm:text-base leading-relaxed">{opt.text}</span>
                        </div>
                      ))}
                    </motion.div>
                  ) : (
                    /* Revelado: Mostra Gráfico de Respostas + Correta destacada */
                    <motion.div
                      key="distribution"
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-6"
                    >
                      <h3 className="text-center font-bold text-lg text-slate-350">Respostas Submetidas</h3>
                      
                      <div className="space-y-4">
                        {(activeQuestion.type === 'two-phase' ? activeQuestion.phase2?.options ?? [] : activeQuestion.options).map((opt, i) => {
                          const votes = answerDistribution[opt.id] || 0
                          const pct = players.length > 0 ? Math.round((votes / players.length) * 100) : 0
                          const isOptCorrect = opt.isCorrect

                          return (
                            <div key={opt.id} className="space-y-1">
                              <div className="flex items-center justify-between text-sm">
                                <span className="flex items-center gap-2 font-medium">
                                  <span className={`flex h-6 w-6 items-center justify-center rounded font-mono text-xs font-bold ${isOptCorrect ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
                                    {String.fromCharCode(65 + i)}
                                  </span>
                                  <span className={isOptCorrect ? 'text-emerald-400 font-bold' : 'text-slate-300'}>
                                    {opt.text}
                                  </span>
                                  {isOptCorrect && <Check className="h-4 w-4 text-emerald-400" />}
                                </span>
                                <span className="font-mono text-slate-400">{votes} votos ({pct}%)</span>
                              </div>
                              <div className="h-3 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-850">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${pct}%` }}
                                  transition={{ duration: 0.8, ease: 'easeOut' }}
                                  className={`h-full rounded-full ${isOptCorrect ? 'bg-emerald-500' : 'bg-slate-700'}`}
                                />
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      {/* Explicativo Pedagógico */}
                      <Card className="border-blue-900/30 bg-blue-950/10 p-5 mt-6">
                        <p className="text-sm font-semibold text-blue-400 mb-1.5">Justificativa da Questão:</p>
                        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">{activeQuestion.explanation}</p>
                      </Card>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Botão de Controle do Host no rodapé */}
              <div className="flex justify-center pt-4 border-t border-slate-900">
                {!revealed ? (
                  <Button onClick={handleRevealAnswer} className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-4 px-8 shadow-lg">
                    <Eye className="mr-2 h-5 w-5" /> Encerrar Tempo / Revelar Resposta
                  </Button>
                ) : (
                  <Button onClick={handleShowLeaderboard} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-8 shadow-lg">
                    Mostrar Placar da Rodada <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                )}
              </div>
            </motion.div>
          )}

          {/* ─── ESTADO: LEADERBOARD DA RODADA ────────────────────────────────── */}
          {session.status === 'leaderboard' && (
            <motion.div
              key="leaderboard"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-8"
            >
              <div className="text-center">
                <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-400 text-xs py-1 px-3 mb-2">
                  Placar da Rodada
                </Badge>
                <h2 className="text-3xl font-extrabold text-white font-display">Leaderboard — Top 5</h2>
              </div>

              <div className="max-w-3xl mx-auto space-y-3 relative min-h-[300px]">
                <AnimatePresence mode="popLayout">
                  {topPlayers.map((player, index) => {
                    const isTop3 = index < 3
                    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : null
                    const pct = Math.round((player.correct_answers / player.total_questions) * 100)

                    return (
                      <motion.div
                        key={player.id}
                        layoutId={player.id}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                        className={`flex items-center justify-between rounded-xl border px-5 py-4 transition-colors ${
                          isTop3
                            ? 'border-blue-500/20 bg-blue-950/10 backdrop-blur-sm'
                            : 'border-slate-800 bg-slate-900/30'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <span className="w-8 text-center text-lg font-black tracking-tight select-none">
                            {medal || `${index + 1}`}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-white text-base">
                                {player.name}
                              </span>
                              {player.max_streak >= 3 && (
                                <span className="flex items-center gap-0.5 rounded bg-orange-500/10 border border-orange-500/20 px-1 py-0.5 text-[9px] font-bold text-orange-400">
                                  🔥 {player.max_streak}x
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <span className="font-mono text-lg font-extrabold text-blue-400">
                              {player.score.toLocaleString()}
                            </span>
                            <span className="text-xs text-slate-500">pts</span>
                          </div>
                          <p className="text-xs text-slate-400">
                            {player.correct_answers} acertos ({pct}%)
                          </p>
                        </div>
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
              </div>

              {/* Botões do Rodapé */}
              <div className="flex justify-center pt-4 border-t border-slate-900">
                <Button onClick={handleNextQuestion} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-8 shadow-lg">
                  {session.current_question_index + 1 >= questions.length ? 'Finalizar Quiz' : 'Próxima Questão'} <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* ─── ESTADO: PODIUM / FIM DO QUIZ ─────────────────────────────────── */}
          {session.status === 'ended' && (
            <motion.div
              key="ended"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-12 py-10"
            >
              <div className="text-center space-y-2">
                <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10 border border-amber-500/20 text-3xl">
                  🏆
                </div>
                <h2 className="text-4xl font-extrabold tracking-tight text-white font-display sm:text-5xl">Quiz Finalizado!</h2>
                <p className="text-slate-400 max-w-md mx-auto">
                  Excelente formação! Parabéns a todos os participantes. Confira o pódio final do QuizDida:
                </p>
              </div>

              {/* Podium Visual Animado */}
              <div className="flex flex-row justify-center items-end gap-4 sm:gap-8 max-w-4xl mx-auto h-[350px] pt-10">
                {podiumPlayers.map((player, i) => {
                  // O array está ordenado [2º, 1º, 3º] para renderização direta da esquerda para a direita.
                  const isFirst = player.id === players[0]?.id
                  const isSecond = player.id === players[1]?.id
                  const isThird = player.id === players[2]?.id

                  let rankLabel = '1º'
                  let height = 'h-56'
                  let colorClass = 'bg-gradient-to-t from-slate-900 to-amber-500/20 border-amber-500/40'
                  let textClass = 'text-amber-400'
                  let delay = 0.4

                  if (isSecond) {
                    rankLabel = '2º'
                    height = 'h-40'
                    colorClass = 'bg-gradient-to-t from-slate-900 to-slate-350/20 border-slate-300/30'
                    textClass = 'text-slate-300'
                    delay = 0.2
                  } else if (isThird) {
                    rankLabel = '3º'
                    height = 'h-28'
                    colorClass = 'bg-gradient-to-t from-slate-900 to-amber-700/20 border-amber-700/30'
                    textClass = 'text-amber-600'
                    delay = 0.6
                  }

                  return (
                    <motion.div
                      key={player.id}
                      initial={{ opacity: 0, y: 100 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ type: 'spring', stiffness: 100, damping: 15, delay }}
                      className="flex flex-col items-center w-28 sm:w-44"
                    >
                      {/* Nome e Pontos do Aluno */}
                      <div className="text-center mb-3">
                        <p className="text-sm sm:text-base font-bold text-white truncate max-w-[100px] sm:max-w-[150px]">
                          {player.name}
                        </p>
                        <p className="text-xs font-mono font-bold text-blue-400">
                          {player.score.toLocaleString()} pts
                        </p>
                      </div>

                      {/* Pedestal */}
                      <div className={`w-full ${height} rounded-t-2xl border ${colorClass} flex flex-col justify-between p-4 shadow-xl`}>
                        <div className={`mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-950 font-black ${textClass} text-lg`}>
                          {rankLabel}
                        </div>
                        <div className="text-center font-display font-black text-2xl tracking-tighter opacity-10">
                          SENAI
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>

              <div className="flex justify-center gap-4 pt-6">
                <Button onClick={() => router.push('/')} variant="outline" className="border-slate-800 text-slate-300 hover:bg-slate-900 py-6 px-8">
                  Voltar para o Início
                </Button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* Footer do Host */}
      <footer className="relative z-10 py-4 border-t border-slate-900/60 bg-slate-950 text-center text-[10px] text-slate-500 uppercase tracking-widest font-mono">
        Metodologia SENAI de Educação Profissional • MSEP
      </footer>
    </main>
  )
}
