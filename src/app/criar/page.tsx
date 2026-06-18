'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Play, Copy, Check, ExternalLink, QrCode, Hourglass, Settings, AlertCircle, Sun, Moon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { createSession } from '@/lib/supabase-helpers'
import { isSupabaseEnabled } from '@/lib/supabase'
import { useTheme } from '@/lib/theme'

export default function CriarSessaoPage() {
  const router = useRouter()
  const { theme, toggleTheme } = useTheme()
  const [title, setTitle] = useState('')
  const [timerEnabled, setTimerEnabled] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Resultado da criação
  const [createdSession, setCreatedSession] = useState<{ code: string; id: string } | null>(null)
  const [copied, setCopied] = useState(false)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return

    setIsLoading(true)
    setError(null)

    try {
      if (!isSupabaseEnabled) {
        throw new Error('O banco de dados Supabase não está configurado. Não é possível criar sessões compartilhadas no momento.')
      }

      const session = await createSession({
        title: title.trim(),
        timerEnabled,
      })

      setCreatedSession({
        code: session.code,
        id: session.id,
      })
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Ocorreu um erro ao criar a sessão.')
    } finally {
      setIsLoading(false)
    }
  }

  const joinUrl = typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.host}?sala=${createdSession?.code}`
    : ''

  const rankingUrl = createdSession
    ? `/sala/${createdSession.code}/ranking`
    : ''

  function handleCopy() {
    if (!joinUrl) return
    navigator.clipboard.writeText(joinUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground transition-colors duration-300 font-sans">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-blue-600/5 dark:bg-blue-600/10 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-80 w-80 rounded-full bg-indigo-600/5 dark:bg-indigo-600/10 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-16">
        
        {/* Header/Topo com Botão de Voltar e Alternador de Tema */}
        <div className="flex items-center justify-between mb-8">
          {!createdSession ? (
            <motion.button
              onClick={() => router.push('/')}
              className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <ArrowLeft className="h-4 w-4" /> Voltar para a tela inicial
            </motion.button>
          ) : (
            <div />
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/40 rounded-full"
            title={theme === 'dark' ? 'Alternar para Tema Claro' : 'Alternar para Tema Escuro'}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4 text-amber-500" /> : <Moon className="h-4 w-4 text-blue-600" />}
          </Button>
        </div>

        <AnimatePresence mode="wait">
          {!createdSession ? (
            /* formulário de criação */
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 backdrop-blur-md shadow-2xl">
                <CardHeader>
                  <div className="mb-2 flex gap-2">
                    <Badge variant="outline" className="border-blue-500/40 bg-blue-500/10 text-blue-300">Coordenador</Badge>
                    <Badge variant="outline" className="border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">Nova Sala</Badge>
                  </div>
                  <CardTitle className="font-display text-3xl font-bold text-slate-900 dark:text-white">Criar Sessão de Quiz</CardTitle>
                  <CardDescription className="text-slate-500 dark:text-slate-400">
                    Gere um código de sala compartilhado para que seus docentes possam responder juntos e ver o ranking em tempo real.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleCreate} className="space-y-6">
                    {error && (
                      <div className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-300">
                        <AlertCircle className="h-5 w-5 shrink-0 text-red-500 dark:text-red-400" />
                        <p>{error}</p>
                      </div>
                    )}

                    <div className="space-y-2">
                      <label htmlFor="session-title" className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Nome da Sessão / Turma
                      </label>
                      <input
                        id="session-title"
                        type="text"
                        required
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Ex: Formação Docente - Junho 2026"
                        maxLength={100}
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/80 px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>

                    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-start gap-3 pr-4">
                          <Hourglass className="mt-1 h-5 w-5 text-blue-500 dark:text-blue-400 shrink-0" />
                          <div>
                            <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200">
                              Habilitar Timer
                            </label>
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              Se ativo, cada questão terá limite de tempo (30s) e bônus de velocidade para quem responder mais rápido.
                            </span>
                          </div>
                        </div>
                        <label className="relative inline-flex cursor-pointer items-center">
                          <input
                            type="checkbox"
                            checked={timerEnabled}
                            onChange={(e) => setTimerEnabled(e.target.checked)}
                            className="peer sr-only"
                          />
                          <div className="peer h-6 w-11 rounded-full bg-slate-200 dark:bg-slate-700 after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500/20"></div>
                        </label>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      disabled={isLoading || !title.trim()}
                      className="w-full bg-blue-600 py-6 text-lg font-semibold shadow-lg shadow-blue-900/40 hover:bg-blue-700 disabled:opacity-50 text-white"
                    >
                      {isLoading ? 'Criando...' : (
                        <>
                          <Play className="mr-2 h-5 w-5" /> Criar Sala Compartilhada
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            /* tela de sucesso com o código e link */
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-6"
            >
              <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 backdrop-blur-md shadow-2xl text-center">
                <CardHeader>
                  <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                    <Check className="h-6 w-6" />
                  </div>
                  <CardTitle className="font-display text-2xl font-bold text-slate-900 dark:text-white">Sala Criada com Sucesso!</CardTitle>
                  <CardDescription className="text-slate-500 dark:text-slate-400">
                    Compartilhe os dados abaixo com os participantes para iniciarem.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Nome da Sessão */}
                  <div className="rounded-lg bg-slate-50 dark:bg-slate-950/40 p-3">
                    <p className="text-xs text-slate-500 font-semibold uppercase">Sessão</p>
                    <p className="text-lg font-bold text-slate-800 dark:text-slate-200">{title}</p>
                    <div className="mt-1 flex justify-center gap-2">
                      <Badge variant="outline" className={timerEnabled ? 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}>
                        {timerEnabled ? '⚡ Com Timer + Velocidade' : '⏳ Sem limite de tempo'}
                      </Badge>
                    </div>
                  </div>

                  {/* Código Gigante */}
                  <div className="py-4">
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Código de Acesso</p>
                    <div className="font-display text-6xl font-black tracking-widest text-blue-600 dark:text-blue-400 select-all">
                      {createdSession.code}
                    </div>
                  </div>

                  {/* QR Code */}
                  <div className="flex flex-col items-center justify-center py-2">
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white p-4 shadow-lg">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(joinUrl)}&color=0f172a`}
                        alt="QR Code para entrar na sala"
                        className="h-40 w-40"
                      />
                    </div>
                    <span className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                      <QrCode className="h-3.5 w-3.5" /> Escaneie para entrar direto
                    </span>
                  </div>

                  {/* Links de Compartilhamento */}
                  <div className="space-y-3 pt-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={joinUrl}
                        className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/80 px-3 py-2 text-sm text-slate-800 dark:text-slate-300 outline-none"
                      />
                      <Button onClick={handleCopy} variant="outline" className="border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
                        {copied ? (
                          <Check className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <Copy className="h-4 w-4 text-slate-400 dark:text-slate-400" />
                        )}
                        <span className="ml-2 hidden sm:inline">{copied ? 'Copiado!' : 'Copiar'}</span>
                      </Button>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button
                        onClick={() => router.push(rankingUrl)}
                        className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 py-6 text-base font-semibold text-white shadow-lg hover:from-blue-700 hover:to-indigo-700"
                      >
                        Projetar Ranking <ExternalLink className="ml-2 h-4 w-4" />
                      </Button>
                      <Button
                        onClick={() => router.push('/')}
                        variant="outline"
                        className="border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 py-6"
                      >
                        Início
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  )
}
