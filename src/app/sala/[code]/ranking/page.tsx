'use client'

import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Trophy, Users, CheckCircle, Flame, Star, AlertCircle, ShieldAlert, Ban, QrCode, Home, Play, ArrowRight, Check, Eye, Volume2, VolumeX, Music, Sun, Moon, Pause, PlayCircle, ExternalLink, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase'
import { getSessionByCode, getSessionRanking, closeSession, updateSessionStatus, updateSessionPauseStatus, updateSessionHostPing, logSessionEvent, type DbPlayer, type DbSession } from '@/lib/supabase-helpers'
import { ACHIEVEMENTS, SCORE_CONFIG } from '@/lib/scoring'
import { useTheme } from '@/lib/theme'
import { calculateSessionStats } from '@/lib/statistics'
import questionsData from '@/data/questions.json'
import type { Question, Option, Phase2Option } from '@/lib/types'
import { PlayerAvatar } from '@/components/PlayerAvatar'

const questions = questionsData as Question[]

export default function RankingSalaPage() {
  const params = useParams()
  const router = useRouter()
  const code = typeof params?.code === 'string' ? params.code : ''
  const { theme, toggleTheme } = useTheme()

  // Banco de dados
  const [session, setSession] = useState<DbSession | null>(null)
  const [players, setPlayers] = useState<DbPlayer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Audio e Trilha Sonora
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [maxVolume, setMaxVolume] = useState(0.25)

  // Estados locais da apresentação
  const [timeLeft, setTimeLeft] = useState(30)
  const [timerActive, setTimerActive] = useState(false)
  const [revealed, setRevealed] = useState(false) // Se o Host já revelou a resposta desta questão
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Melhorias Premium
  const [hijacked, setHijacked] = useState(false)
  const [isHijackScreen, setIsHijackScreen] = useState(false)
  const [connectionState, setConnectionState] = useState<'connected' | 'reconnecting' | 'offline'>('connected')
  const [showCloseConfirmModal, setShowCloseConfirmModal] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen()
        setIsFullscreen(true)
      } else {
        await document.exitFullscreen()
        setIsFullscreen(false)
      }
    } catch (e) {
      console.error(e)
    }
  }, [])

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  async function handleTogglePause() {
    if (!session) return
    const nextPause = !session.is_paused
    try {
      await updateSessionPauseStatus(session.id, nextPause)
      setSession(prev => prev ? { ...prev, is_paused: nextPause } : null)
      await logSessionEvent(session.id, nextPause ? 'quiz_paused' : 'quiz_resumed', {
        questionIndex: session.current_question_index
      })
    } catch (err: any) {
      alert(`Erro ao alterar status de pausa: ${err.message}`)
    }
  }

  // ── Persistência de Preferências do Host ──
  useEffect(() => {
    try {
      const savedVolume = localStorage.getItem('quizdida_host_volume')
      if (savedVolume !== null) setMaxVolume(parseFloat(savedVolume))

      const savedPlaying = localStorage.getItem('quizdida_host_playing')
      if (savedPlaying !== null) setPlaying(savedPlaying === 'true')
    } catch (e) {
      console.error('Erro ao ler LocalStorage:', e)
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('quizdida_host_volume', maxVolume.toString())
    } catch (e) {}
  }, [maxVolume])

  useEffect(() => {
    try {
      localStorage.setItem('quizdida_host_playing', playing.toString())
    } catch (e) {}
  }, [playing])

  // ── 1. Busca inicial da sessão e ranking (com Heartbeat/Host Único) ──
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

        const now = new Date().getTime()
        const lastPing = sess.last_host_ping ? new Date(sess.last_host_ping).getTime() : 0
        const isHostActive = (now - lastPing) < 15000 // 15 segundos limite

        if (isHostActive && !hijacked) {
          setIsHijackScreen(true)
          setSession(sess)
        } else {
          setIsHijackScreen(false)
          await updateSessionHostPing(sess.id)
          setSession(sess)
          await logSessionEvent(sess.id, hijacked ? 'host_takeover' : 'host_entered', { details: 'Apresentador entrou na sala' })
        }

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
  }, [code, hijacked])

  // ── Heartbeat Ping loop ──
  useEffect(() => {
    if (!session || isHijackScreen) return

    const intervalId = setInterval(() => {
      updateSessionHostPing(session.id)
    }, 5000) // a cada 5 segundos

    return () => {
      clearInterval(intervalId)
    }
  }, [session?.id, isHijackScreen])

  // ── 2. Realtime subscription para atualizar jogadores e sessão ──
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
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setConnectionState('connected')
        else if (status === 'TIMED_OUT' || status === 'CLOSED') setConnectionState('offline')
        else setConnectionState('reconnecting')
      })

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
            setSession((prev) => prev ? { 
              ...prev, 
              status: updatedSess.status, 
              current_question_index: updatedSess.current_question_index,
              is_paused: updatedSess.is_paused
            } : null)
          }
        }
      )
      .subscribe()

    return () => {
      supabase?.removeChannel(playersChannel)
      supabase?.removeChannel(sessionChannel)
    }
  }, [session])

  // ── 3. Gerenciamento do Cronômetro do Host ──
  useEffect(() => {
    if (!session || session.status !== 'question' || !session.timer_enabled || revealed || session.is_paused) {
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

    setTimeLeft((prev) => (timerActive ? prev : limit))
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
  }, [session?.status, session?.current_question_index, session?.timer_enabled, revealed, session?.is_paused, timerActive])

  // Reseta estado de revelação ao mudar de questão
  useEffect(() => {
    setRevealed(false)
    setTimeLeft(30) // reseta timer visual
    setTimerActive(false)
  }, [session?.current_question_index, session?.status])

  // ── Controle do Player de Áudio ──
  useEffect(() => {
    if (!audioRef.current) return
    if (playing && !session?.is_paused) {
      audioRef.current.play().catch((err) => {
        console.log('Autoplay bloqueado. Aguardando clique do usuário.', err)
        setPlaying(false)
      })
    } else {
      audioRef.current.pause()
    }
  }, [playing, session?.is_paused])

  // Lógica de volume dinâmico proporcional
  useEffect(() => {
    if (!audioRef.current) return
    const isExplaining = session?.status === 'question' && revealed
    const targetVolume = isExplaining ? maxVolume * 0.15 : maxVolume
    audioRef.current.volume = targetVolume
  }, [session?.status, revealed, maxVolume])

  // 4. Ações do Apresentador (Host)
  async function handleStartQuiz() {
    if (!session) return
    try {
      await updateSessionStatus(session.id, 'question', 0)
      await logSessionEvent(session.id, 'quiz_started', { title: session.title })
    } catch (err: any) {
      alert(`Erro ao iniciar: ${err.message}`)
    }
  }

  async function handleRevealAnswer() {
    setRevealed(true)
    if (session) {
      await logSessionEvent(session.id, 'question_revealed', {
        questionIndex: session.current_question_index,
        questionId: questions[session.current_question_index]?.id
      })
    }
  }

  async function handleShowLeaderboard() {
    if (!session) return
    try {
      await updateSessionStatus(session.id, 'leaderboard', session.current_question_index)
      await logSessionEvent(session.id, 'leaderboard_shown', {
        questionIndex: session.current_question_index
      })
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
        await logSessionEvent(session.id, 'quiz_ended', { totalQuestions: questions.length })
      } else {
        await updateSessionStatus(session.id, 'question', nextIdx)
        await logSessionEvent(session.id, 'question_changed', {
          fromIndex: session.current_question_index,
          toIndex: nextIdx,
          questionId: questions[nextIdx]?.id
        })
      }
    } catch (err: any) {
      alert(`Erro ao avançar: ${err.message}`)
    }
  }

  function exportToCSV() {
    if (!session || players.length === 0) return
    
    const stats = calculateSessionStats(players, questions.length)
    const easiestText = stats.easiestQuestion 
      ? `Questão ${stats.easiestQuestion.index} (${stats.easiestQuestion.successRate}% acertos)` 
      : 'N/A'
    const hardestText = stats.hardestQuestion 
      ? `Questão ${stats.hardestQuestion.index} (${stats.hardestQuestion.successRate}% acertos)` 
      : 'N/A'

    const csvRows = [
      `Relatório do Quiz — ${session.title}`,
      `Código da Sala: ${session.code}`,
      `Data de Encerramento: ${new Date().toLocaleString('pt-BR')}`,
      `Total de Participantes: ${stats.totalParticipants}`,
      `Média de Pontuação da Turma: ${stats.averageScore} pts`,
      `Maior Pontuação: ${stats.highestScore} pts`,
      `Menor Pontuação: ${stats.lowestScore} pts`,
      `Tempo Médio de Resposta: ${stats.averageResponseTime}s`,
      `Questão Mais Fácil: ${easiestText}`,
      `Questão Mais Difícil: ${hardestText}`,
      '',
      'Classificação,Nome,Pontuação Total,Acertos,Total de Questões,Aproveitamento (%),Streak Máximo,Conquistas'
    ]

    players.forEach((p, idx) => {
      const pct = p.total_questions > 0 ? Math.round((p.correct_answers / p.total_questions) * 100) : 0
      const achievementsList = (p.achievements || []).join('; ')
      csvRows.push(`${idx + 1},"${p.name.replace(/"/g, '""')}",${p.score},${p.correct_answers},${p.total_questions},${pct}%,${p.max_streak},"${achievementsList}"`)
    })

    const csvContent = '\uFEFF' + csvRows.join('\r\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `relatorio_quiz_${session.code}_${session.title.toLowerCase().replace(/\s+/g, '_')}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  async function handleCloseSession() {
    if (!session) return
    setShowCloseConfirmModal(true)
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

  const endedStats = useMemo(() => {
    return calculateSessionStats(players, questions.length)
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

  if (isHijackScreen) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6 text-center text-white font-sans">
        <div className="mb-4 rounded-full bg-amber-500/10 p-4 text-amber-400">
          <ShieldAlert className="h-12 w-12 animate-pulse" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Sala com Apresentador Ativo</h1>
        <p className="text-slate-400 max-w-md mb-6">
          Esta sala já possui uma janela de apresentador conectada e ativa nos últimos 15 segundos. 
          Deseja assumir o controle da sala? A outra sessão será desconectada.
        </p>
        <div className="flex gap-4">
          <Button
            onClick={() => router.push('/')}
            variant="outline"
            className="border-slate-800 text-slate-300 hover:bg-slate-900"
          >
            Voltar ao Início
          </Button>
          <Button
            onClick={() => setHijacked(true)}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            Forçar Entrada (Assumir)
          </Button>
        </div>
      </div>
    )
  }

  return (
    <main className="relative min-h-screen bg-background font-sans text-foreground overflow-x-hidden flex flex-col justify-between transition-colors duration-300">
      {/* Background decorativo sutil */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-0 right-1/4 h-[500px] w-[500px] rounded-full bg-blue-600/5 dark:bg-blue-600/5 blur-3xl" />
        <div className="absolute bottom-0 left-1/4 h-[500px] w-[500px] rounded-full bg-violet-600/5 dark:bg-violet-600/5 blur-3xl" />
      </div>

      {/* Top Bar do Host (Sempre visível) */}
      <header className="relative z-20 border-b border-slate-200/80 dark:border-slate-800/80 bg-slate-100/30 dark:bg-slate-900/30 px-6 py-4 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="rounded bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 text-[10px] font-bold text-blue-600 dark:text-blue-300">
                Apresentador
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-500 font-medium">
                Sala: <strong className="text-slate-700 dark:text-slate-300">{session.code}</strong>
              </span>
            </div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white truncate max-w-[280px] sm:max-w-md">{session.title}</h1>
          </div>

          <div className="flex items-center gap-4">
            {/* Controles de Música */}
            <div className="flex items-center gap-2 border-r border-slate-200 dark:border-slate-800 pr-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setPlaying(!playing)}
                className="h-8 w-8 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/40 rounded-full"
                title={playing ? 'Pausar música' : 'Tocar música'}
              >
                {playing ? <Volume2 className="h-4 w-4 text-blue-500 dark:text-blue-400 animate-pulse" /> : <VolumeX className="h-4 w-4" />}
              </Button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={maxVolume}
                onChange={(e) => setMaxVolume(parseFloat(e.target.value))}
                className="w-16 h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                title="Volume da música"
              />
            </div>

            {/* Alternador de Tema */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="h-8 w-8 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/40 rounded-full"
              title={theme === 'dark' ? 'Alternar para Tema Claro' : 'Alternar para Tema Escuro'}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4 text-amber-500" /> : <Moon className="h-4 w-4 text-blue-600" />}
            </Button>

            {/* Indicador de Conexão */}
            <div className="flex items-center gap-1.5 border-r border-slate-200 dark:border-slate-800 pr-4">
              <span className={`h-2.5 w-2.5 rounded-full ${
                connectionState === 'connected' ? 'bg-emerald-500' :
                connectionState === 'reconnecting' ? 'bg-amber-500 animate-pulse' :
                'bg-red-500 animate-ping'
              }`} />
              <span className={`text-xs font-semibold ${
                connectionState === 'connected' ? 'text-emerald-500' :
                connectionState === 'reconnecting' ? 'text-amber-500' :
                'text-red-500'
              }`}>
                {connectionState === 'connected' ? 'Conectado' :
                 connectionState === 'reconnecting' ? 'Reconectando' :
                 'Offline'}
              </span>
            </div>

            {/* Controle de Pausa */}
            {session.status === 'question' && (
              <Button
                onClick={handleTogglePause}
                variant="outline"
                size="sm"
                className={`gap-1.5 h-8 ${
                  session.is_paused 
                    ? 'bg-amber-500/20 text-amber-500 border-amber-500/30 hover:bg-amber-500/30' 
                    : 'text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-200/50 dark:hover:bg-slate-800/40'
                }`}
              >
                {session.is_paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                {session.is_paused ? 'Retomar' : 'Pausar'}
              </Button>
            )}

            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-sm">
              <Users className="h-4 w-4 text-blue-500 dark:text-blue-400" />
              <span><strong>{players.length}</strong> conectados</span>
            </div>
            <Button onClick={handleCloseSession} variant="ghost" size="sm" className="text-red-600 dark:text-red-400 hover:bg-red-500/10 dark:hover:bg-red-950/20">
              Encerrar Sala
            </Button>
          </div>
        </div>
      </header>

      {/* Barra de Progresso Linear do Host */}
      {session.status === 'question' && (
        <div className="w-full h-1 bg-slate-200 dark:bg-slate-800 relative z-20">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${((session.current_question_index + 1) / questions.length) * 100}%` }}
            transition={{ duration: 0.5 }}
            className="h-full bg-blue-600 dark:bg-blue-500"
          />
        </div>
      )}

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
              <div className="lg:col-span-1 space-y-4">
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

                {!isFullscreen && (
                  <Card className="border-amber-500/20 bg-amber-500/5 backdrop-blur-md p-4 text-center">
                    <p className="text-xs text-amber-500 font-bold flex items-center justify-center gap-1.5">
                      <AlertCircle className="h-4 w-4" /> Recomendação de Projeção
                    </p>
                    <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                      Para uma melhor experiência no projetor, ative o modo Tela Cheia.
                    </p>
                    <Button
                      onClick={toggleFullscreen}
                      size="sm"
                      variant="outline"
                      className="mt-3 border-amber-500/30 hover:bg-amber-500/10 text-amber-500 font-bold text-xs"
                    >
                      Ativar Tela Cheia
                    </Button>
                  </Card>
                )}
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
                        className="flex items-center gap-2 rounded-full border border-slate-200 dark:border-slate-800 bg-slate-100/30 dark:bg-slate-900/60 pl-2 pr-4 py-1.5 text-base font-semibold text-slate-800 dark:text-slate-200 shadow-sm"
                      >
                        <PlayerAvatar avatarId={p.avatar_id} size="sm" name={p.name} />
                        <span>{p.name}</span>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 border border-dashed border-slate-800 rounded-2xl bg-slate-900/10">
                    <Users className="h-10 w-10 text-slate-500 animate-pulse mb-3" />
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
                  <div className="relative flex items-center justify-center h-40 w-40 rounded-full border-4 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                    <div className="text-center text-slate-500 dark:text-slate-400">
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
                      <h3 className="text-center font-bold text-lg text-slate-700 dark:text-slate-300">Respostas Submetidas</h3>
                      
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
                              <div className="h-3 w-full bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden border border-slate-200 dark:border-slate-800">
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
                          <PlayerAvatar avatarId={player.avatar_id} size="sm" name={player.name} />
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
              <div className="flex flex-row justify-center items-end gap-4 sm:gap-8 max-w-4xl mx-auto h-[390px] pt-4">
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
                  let ringColor = 'ring-amber-500'

                  if (isSecond) {
                    rankLabel = '2º'
                    height = 'h-40'
                    colorClass = 'bg-gradient-to-t from-slate-900 to-slate-300/20 border-slate-300/30'
                    textClass = 'text-slate-300'
                    delay = 0.2
                    ringColor = 'ring-slate-300'
                  } else if (isThird) {
                    rankLabel = '3º'
                    height = 'h-28'
                    colorClass = 'bg-gradient-to-t from-slate-900 to-amber-700/20 border-amber-700/30'
                    textClass = 'text-amber-600'
                    delay = 0.6
                    ringColor = 'ring-amber-700'
                  }

                  return (
                    <motion.div
                      key={player.id}
                      initial={{ opacity: 0, y: 100 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ type: 'spring', stiffness: 100, damping: 15, delay }}
                      className="flex flex-col items-center w-28 sm:w-44"
                    >
                      {/* Avatar do Jogador no Pódio */}
                      <div className="mb-3">
                        <PlayerAvatar 
                          avatarId={player.avatar_id} 
                          size="md" 
                          name={player.name} 
                          className={`ring-4 ring-offset-2 ring-offset-slate-950 ${ringColor}`} 
                        />
                      </div>

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

              {/* Dashboard de Estatísticas da Sala */}
              <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
                <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-md p-5 text-center shadow-xl">
                  <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Média de Pontos</p>
                  <p className="text-2xl font-black text-blue-400 mt-1">{endedStats.averageScore.toLocaleString()} pts</p>
                </Card>
                <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-md p-5 text-center shadow-xl">
                  <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Tempo Médio</p>
                  <p className="text-2xl font-black text-violet-400 mt-1">{endedStats.averageResponseTime}s</p>
                </Card>
                <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-md p-5 text-center shadow-xl">
                  <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Mais Fácil</p>
                  <p className="text-sm font-bold text-emerald-400 mt-2 truncate" title={endedStats.easiestQuestion ? `Questão ${endedStats.easiestQuestion.index} (${endedStats.easiestQuestion.successRate}% acertos)` : 'N/A'}>
                    {endedStats.easiestQuestion ? `Questão ${endedStats.easiestQuestion.index} (${endedStats.easiestQuestion.successRate}%)` : 'N/A'}
                  </p>
                </Card>
                <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-md p-5 text-center shadow-xl">
                  <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Mais Difícil</p>
                  <p className="text-sm font-bold text-red-400 mt-2 truncate" title={endedStats.hardestQuestion ? `Questão ${endedStats.hardestQuestion.index} (${endedStats.hardestQuestion.successRate}% acertos)` : 'N/A'}>
                    {endedStats.hardestQuestion ? `Questão ${endedStats.hardestQuestion.index} (${endedStats.hardestQuestion.successRate}%)` : 'N/A'}
                  </p>
                </Card>
              </div>

              {/* Tabela de Classificação Completa */}
              <div className="max-w-4xl mx-auto mt-12 space-y-4">
                <h3 className="text-center font-bold text-lg text-slate-300 flex items-center justify-center gap-2">
                  <Trophy className="h-5 w-5 text-amber-500" /> Classificação Geral da Sala
                </h3>
                <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-sm">
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-800 bg-slate-950/60 text-xs font-bold uppercase tracking-wider text-slate-400">
                            <th className="px-6 py-4 w-20 text-center">Posição</th>
                            <th className="px-6 py-4">Participante</th>
                            <th className="px-6 py-4 text-center">Pontuação</th>
                            <th className="px-6 py-4 text-center">Acertos</th>
                            <th className="px-6 py-4 text-center">Aproveitamento</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                          {players.map((p, idx) => {
                            const pct = p.total_questions > 0 ? Math.round((p.correct_answers / p.total_questions) * 100) : 0
                            const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null
                            return (
                              <tr key={p.id} className="hover:bg-slate-900/30 transition-colors">
                                <td className="px-6 py-4 text-center font-black text-slate-300">
                                  {medal || `${idx + 1}º`}
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-3">
                                    <PlayerAvatar avatarId={p.avatar_id} size="sm" name={p.name} />
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold text-slate-200">{p.name}</span>
                                      {p.max_streak >= 3 && (
                                        <span className="rounded bg-orange-500/10 border border-orange-500/20 px-1 py-0.5 text-[9px] font-bold text-orange-400">
                                          🔥 {p.max_streak}x
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-center font-mono font-bold text-blue-400">
                                  {p.score.toLocaleString()}
                                </td>
                                <td className="px-6 py-4 text-center text-slate-600 dark:text-slate-300">
                                  {p.correct_answers}/{p.total_questions}
                                </td>
                                <td className="px-6 py-4 text-center">
                                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                    pct >= 70 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                    pct >= 50 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                    'bg-red-500/10 text-red-400 border border-red-500/20'
                                  }`}>
                                    {pct}%
                                  </span>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="flex justify-center gap-4 pt-6">
                <Button onClick={handleCloseSession} className="bg-red-600 hover:bg-red-700 text-white font-bold py-6 px-10 shadow-lg text-lg">
                  Encerrar Sala e Baixar Relatório (CSV)
                </Button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* Footer do Host */}
      <footer className="relative z-10 py-4 border-t border-slate-200/60 dark:border-slate-900/60 bg-slate-100/50 dark:bg-slate-950 text-center text-[10px] text-slate-500 uppercase tracking-widest font-mono">
        Metodologia SENAI de Educação Profissional • MSEP
      </footer>

      {/* Elemento de Áudio Oculto */}
      <audio
        ref={audioRef}
        src="/audio/quiz_music.mp3"
        loop
      />

      {/* Modal de Confirmação de Encerramento */}
      {showCloseConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl animate-in fade-in-50 zoom-in-95 duration-200 text-left">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400 mb-4">
              <ShieldAlert className="h-8 w-8" />
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Encerrar Sala Permanentemente?</h3>
            </div>
            <p className="text-slate-600 dark:text-slate-300 text-sm mb-4">
              Tem certeza de que deseja encerrar a sala <strong>{session.code}</strong>? Esta ação não pode ser desfeita.
            </p>
            <ul className="space-y-2 mb-6 text-sm text-slate-500 dark:text-slate-400 list-disc pl-4">
              <li>
                Os participantes serão desconectados e redirecionados.
              </li>
              <li>
                O relatório CSV detalhado com todas as pontuações e estatísticas da turma será gerado automaticamente.
              </li>
              <li>
                O código da sala será desativado permanentemente.
              </li>
            </ul>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setShowCloseConfirmModal(false)}
                className="border-slate-200 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancelar
              </Button>
              <Button
                onClick={async () => {
                  setShowCloseConfirmModal(false)
                  try {
                    exportToCSV()
                    await closeSession(session.id)
                    await logSessionEvent(session.id, 'session_closed', { details: 'Sala encerrada permanentemente pelo apresentador' })
                    router.push('/')
                  } catch (err: any) {
                    alert(`Erro ao encerrar sessão: ${err.message}`)
                  }
                }}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Encerrar Sala
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
