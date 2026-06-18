'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { BookOpen, Users, Target, ArrowRight, Trophy, Zap, Flame, RotateCcw, Plus, CheckCircle, AlertTriangle, Key, Sun, Moon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useQuiz } from '@/lib/quiz-context'
import { generateNameKey } from '@/lib/scoring'
import type { PlayerData, Question } from '@/lib/types'
import questionsData from '@/data/questions.json'
import { getSessionByCode, joinSession } from '@/lib/supabase-helpers'
import { supabase, isSupabaseEnabled } from '@/lib/supabase'
import { useTheme } from '@/lib/theme'

const questions = questionsData as Question[]

function WelcomeForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { theme } = useTheme()
  const { state, dispatch, player, setPlayer, resetPlayer, ranking } = useQuiz()

  // Form states
  const [nameInput, setNameInput] = useState('')
  const [nameError, setNameError] = useState('')
  const [codeInput, setCodeInput] = useState('')
  const [codeError, setCodeError] = useState('')

  // Supabase room verification states
  const [verifyingCode, setVerifyingCode] = useState(false)
  const [verifiedSession, setVerifiedSession] = useState<{ id: string; title: string; timer_enabled: boolean; playerCount: number; status: string } | null>(null)

  const [showRanking, setShowRanking] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // 1. Auto-preenche o código se vier na URL (?sala=CODE)
  useEffect(() => {
    const salaParam = searchParams?.get('sala')
    if (salaParam) {
      setCodeInput(salaParam.toUpperCase())
    }
  }, [searchParams])

  // 2. Verifica a sala em tempo real quando o código tem 6 ou mais caracteres
  useEffect(() => {
    const code = codeInput.trim()
    if (code.length < 6) {
      setVerifiedSession(null)
      setCodeError('')
      return
    }

    let active = true

    async function checkRoom() {
      if (!isSupabaseEnabled) return
      setVerifyingCode(true)
      setCodeError('')
      
      try {
        const sessionData = await getSessionByCode(code)
        if (!active) return

        if (sessionData) {
          const currentStatus = sessionData.status || 'lobby'
          if (currentStatus !== 'lobby') {
            if (active) {
              setVerifiedSession(null)
              setCodeError('Esta sala já iniciou o quiz e não aceita novos participantes.')
            }
          } else {
            // Busca quantidade de jogadores na sala
            const { count } = await supabase!
              .from('quiz_players')
              .select('*', { count: 'exact', head: true })
              .eq('session_id', sessionData.id)

            if (active) {
              setVerifiedSession({
                id: sessionData.id,
                title: sessionData.title,
                timer_enabled: sessionData.timer_enabled,
                playerCount: count || 0,
                status: currentStatus,
              })
              setCodeError('')
            }
          }
        } else {
          if (active) {
            setVerifiedSession(null)
            setCodeError('Sala não encontrada ou já encerrada.')
          }
        }
      } catch (err) {
        console.error(err)
        if (active) {
          setCodeError('Erro ao buscar informações da sala.')
        }
      } finally {
        if (active) setVerifyingCode(false)
      }
    }

    const timer = setTimeout(checkRoom, 400)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [codeInput])

  // 3. Redireciona se o quiz já estiver em andamento
  useEffect(() => {
    if (state.phase === 'quiz') router.push('/quiz')
    else if (state.phase === 'result') router.push('/resultado')
  }, [state.phase, router])

  async function handleStart() {
    const trimmedName = nameInput.trim()
    if (trimmedName.length < 2) {
      setNameError('Digite seu nome (mínimo 2 caracteres).')
      return
    }
    if (trimmedName.length > 40) {
      setNameError('Nome muito longo (máximo 40 caracteres).')
      return
    }
    setNameError('')

    const code = codeInput.trim()

    // Caso tente entrar em uma sala mas ela não esteja validada
    if (code.length > 0 && !verifiedSession) {
      setCodeError('Valide o código da sala antes de iniciar.')
      return
    }

    setIsLoading(true)

    try {
      if (verifiedSession && code.length > 0) {
        // --- MODO SALA COMPARTILHADA (Supabase) ---
        // Verificar se jogador já existe na sala para evitar duplicados / responder 2 vezes
        const { data: existingPlayer } = await supabase!
          .from('quiz_players')
          .select('id, completed')
          .eq('session_id', verifiedSession.id)
          .ilike('name', trimmedName)
          .maybeSingle()

        if (existingPlayer) {
          if (existingPlayer.completed) {
            // Se já concluiu e é o mesmo player local, restaura fase e vai pro resultado
            if (state.playerId === existingPlayer.id) {
              dispatch({ type: 'RESTORE_STATE', payload: { ...state, phase: 'result' } })
              router.push('/resultado')
              return
            } else {
              throw new Error('Este participante já concluiu o quiz nesta sala.')
            }
          }
          
          if (state.playerId !== existingPlayer.id) {
            throw new Error('Este nome já está sendo usado nesta sala. Use outro nome.')
          }
        }

        // 1. Registra o jogador no banco de dados da sessão se não existir ainda
        const dbPlayer = existingPlayer || await joinSession({
          sessionId: verifiedSession.id,
          playerName: trimmedName,
          totalQuestions: questions.length,
        })

        // 2. Inicia o quiz no contexto associando os IDs do Supabase
        dispatch({
          type: 'START_QUIZ',
          payload: {
            questions,
            playerName: trimmedName,
            sessionCode: code.toUpperCase(),
            sessionId: verifiedSession.id,
            playerId: dbPlayer.id,
            timerEnabled: verifiedSession.timer_enabled,
          },
        })
      } else {
        // --- MODO LOCAL FALLBACK (Prática) ---
        const nameKey = generateNameKey(trimmedName)
        const newPlayer: PlayerData = { name: trimmedName, nameKey, hasCompleted: false }
        setPlayer(newPlayer)
        
        dispatch({
          type: 'START_QUIZ',
          payload: {
            questions,
            playerName: trimmedName,
            sessionCode: null,
            sessionId: null,
            playerId: null,
            timerEnabled: false, // Local-only sempre sem timer por padrão
          },
        })
      }

      router.push('/quiz')
    } catch (err: any) {
      console.error(err)
      setNameError(err.message || 'Erro ao entrar na sessão. Nome já cadastrado nesta sala?')
    } finally {
      setIsLoading(false)
    }
  }

  function handleResume() {
    router.push('/quiz')
  }

  function handleContinueAsNew() {
    resetPlayer()
    setNameInput('')
    setCodeInput('')
    setVerifiedSession(null)
  }

  const hasOngoingSession = state.phase === 'quiz' && state.questions.length > 0
  const playerCompleted = player?.hasCompleted === true

  return (
    <div className="relative z-10 mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center px-6 py-16">
      
      {/* Badges do SENAI/MSEP */}
      <motion.div className="mb-6 flex gap-3" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <Badge variant="outline" className="border-blue-500/40 bg-blue-500/10 text-blue-300">SENAI</Badge>
        <Badge variant="outline" className="border-violet-500/40 bg-violet-500/10 text-violet-300">MSEP</Badge>
        <Badge variant="outline" className="border-slate-500/40 bg-slate-500/10 text-slate-400">Autoformação</Badge>
      </motion.div>

      {/* Título Principal */}
      <motion.div className="mb-8 text-center" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <h1 className="font-display mb-3 text-5xl font-bold tracking-tight text-slate-900 dark:text-white md:text-6xl">
          Competência ou{' '}
          <span className="bg-gradient-to-r from-blue-600 to-violet-600 dark:from-blue-400 dark:to-violet-400 bg-clip-text text-transparent font-black">Capacidade?</span>
        </h1>
        <p className="mx-auto max-w-2xl text-base leading-relaxed text-slate-600 dark:text-slate-400">
          Identifique e classifique os conceitos estruturantes da Metodologia SENAI de Educação Profissional.
        </p>
      </motion.div>

      {/* Info Cards */}
      <motion.div className="mb-8 grid w-full grid-cols-1 gap-4 sm:grid-cols-3"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
        {[
          { icon: BookOpen, label: '18 questões', desc: 'Autoformação docente', colorClass: 'text-blue-600 dark:text-blue-400' },
          { icon: Zap, label: 'Ranking em tempo real', desc: 'Competição amigável estilo Kahoot', colorClass: 'text-violet-600 dark:text-violet-400' },
          { icon: Trophy, label: 'Bônus de velocidade', desc: 'Responda rápido para pontuar mais', colorClass: 'text-amber-600 dark:text-amber-400' },
        ].map((item, i) => (
          <motion.div key={item.label} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.08 }}>
            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 backdrop-blur-sm shadow-sm dark:shadow-none transition-colors duration-300">
              <CardContent className="flex flex-col items-center p-5 text-center">
                <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 ${item.colorClass} transition-colors duration-300`}>
                  <item.icon className="h-5 w-5" />
                </div>
                <p className="font-semibold text-slate-800 dark:text-white text-sm">{item.label}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{item.desc}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* ── Formulário / CTA ──────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {hasOngoingSession && !playerCompleted ? (
          /* Sessão em andamento */
          <motion.div key="resume" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center gap-4 w-full max-w-md">
            <div className="w-full rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center text-sm text-amber-300">
              📌 Você tem uma sessão em andamento como{' '}
              <strong className="text-white">{state.playerName}</strong>{' '}
              (questão {state.results.length + 1}/{state.questions.length})
            </div>
            <div className="flex w-full gap-3">
              <Button onClick={handleResume} size="lg" className="flex-1 bg-blue-600 py-6 text-lg font-semibold hover:bg-blue-700">
                Retomar <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button onClick={() => { dispatch({ type: 'RESTART_QUIZ' }); resetPlayer() }}
                size="lg" variant="outline" className="border-slate-800 py-6 text-slate-300 hover:bg-slate-900">
                <RotateCcw className="h-5 w-5" />
              </Button>
            </div>
          </motion.div>

        ) : playerCompleted ? (
          /* Jogador completou */
          <motion.div key="completed" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/50 p-6 text-center backdrop-blur-md">
            <div className="mb-4 text-4xl">🎓</div>
            <h2 className="mb-1 text-xl font-bold text-white">Excelente, {player.name}!</h2>
            <p className="mb-4 text-sm text-slate-400">Você concluiu sua tentativa.</p>
            <div className="mb-5 flex items-center justify-center gap-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-blue-400">{player.finalScore}</p>
                <p className="text-xs text-slate-500">pontos</p>
              </div>
              <div className="h-8 w-px bg-slate-800" />
              <div className="text-center">
                <p className="text-3xl font-bold text-violet-400">{player.finalPercentage}%</p>
                <p className="text-xs text-slate-500">acerto</p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button onClick={handleContinueAsNew}
                className="text-xs text-slate-500 underline-offset-2 hover:text-slate-400 hover:underline">
                Entrar com outro participante ou outra Sala
              </button>
            </div>
          </motion.div>

        ) : (
          /* Formulário de entrada principal */
          <motion.div key="form" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="flex w-full max-w-md flex-col gap-4">
            
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-5 backdrop-blur-sm space-y-4 shadow-sm dark:shadow-none transition-colors duration-300">
              
              {/* Nome */}
              <div>
                <label htmlFor="player-name" className="mb-1.5 block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Seu Nome Completo
                </label>
                <input
                  id="player-name"
                  type="text"
                  value={nameInput}
                  onChange={(e) => { setNameInput(e.target.value); setNameError('') }}
                  placeholder="Ex: Prof. Carlos Silva"
                  maxLength={40}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/80 px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
                {nameError && <p className="mt-1.5 text-xs text-red-400">{nameError}</p>}
              </div>

              {/* Código da sala (Supabase) */}
              <div>
                <label htmlFor="room-code" className="mb-1.5 block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Código da Sala (Obrigatório)</span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal normal-case">Estilo Kahoot</span>
                </label>
                <div className="relative">
                  <input
                    id="room-code"
                    type="text"
                    value={codeInput}
                    onChange={(e) => { setCodeInput(e.target.value.toUpperCase()); setCodeError('') }}
                    placeholder="Ex: SENAI1"
                    maxLength={8}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/80 pl-4 pr-10 py-3 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 font-mono tracking-widest uppercase"
                  />
                  <div className="absolute right-3 top-3.5 text-slate-400 dark:text-slate-500">
                    <Key className="h-4 w-4" />
                  </div>
                </div>

                {/* Feedbacks de validação do código */}
                <AnimatePresence mode="wait">
                  {verifyingCode && (
                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-1.5 text-xs text-slate-400 animate-pulse">
                      Verificando sala...
                    </motion.p>
                  )}

                  {verifiedSession && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
                      className="mt-2 flex items-start gap-2 rounded border border-emerald-500/20 bg-emerald-500/5 p-2 text-xs text-emerald-400"
                    >
                      <CheckCircle className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
                      <div>
                        <p className="font-semibold text-white">{verifiedSession.title}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {verifiedSession.playerCount} participantes ativos • {verifiedSession.timer_enabled ? '⚡ Timer ativo' : '⏳ Sem tempo'}
                        </p>
                      </div>
                    </motion.div>
                  )}

                  {codeError && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
                      className="mt-2 flex items-center gap-2 text-xs text-amber-400"
                    >
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <span>{codeError}</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

            </div>

            <Button onClick={handleStart} size="lg" disabled={nameInput.trim().length < 2 || codeInput.trim().length < 6 || isLoading || verifyingCode || !verifiedSession || !!codeError}
              className="w-full bg-blue-600 py-6 text-lg font-semibold shadow-lg shadow-blue-900/40 hover:bg-blue-700 disabled:opacity-50">
              {isLoading ? 'Entrando...' : 'Entrar na Sala'} 
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>

          </motion.div>
        )}
      </AnimatePresence>

      {/* Rodapé informativo */}
      <motion.p className="mt-12 text-center text-[10px] text-slate-600 uppercase tracking-widest font-mono" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }}>
        Metodologia SENAI de Educação Profissional • MSEP
      </motion.p>
    </div>
  )
}

export default function WelcomePage() {
  const { theme, toggleTheme } = useTheme()

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground transition-colors duration-300 font-sans">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-blue-600/5 dark:bg-blue-600/10 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-80 w-80 rounded-full bg-indigo-600/5 dark:bg-indigo-600/10 blur-3xl" />
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

      <Suspense fallback={
        <div className="relative z-10 mx-auto flex min-h-screen flex-col items-center justify-center text-foreground">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          <p className="mt-4 text-sm text-slate-400">Carregando formulário...</p>
        </div>
      }>
        <WelcomeForm />
      </Suspense>
    </main>
  )
}
