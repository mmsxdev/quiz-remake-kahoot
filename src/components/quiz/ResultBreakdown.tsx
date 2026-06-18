'use client'

import { motion } from 'framer-motion'
import type { BlockScore } from '@/lib/types'

const blockDescriptions: Record<string, string> = {
  A: 'Identificar se uma afirmativa representa uma Competência ou Capacidade na MSEP.',
  B: 'Analisar situações do cotidiano docente à luz dos conceitos da MSEP.',
  C: 'Compreender os fundamentos conceituais da Metodologia SENAI de Educação Profissional.',
}

const blockColors: Record<string, { ring: string; bar: string; text: string }> = {
  A: { ring: 'ring-blue-500/30', bar: 'from-blue-500 to-blue-400', text: 'text-blue-400' },
  B: { ring: 'ring-violet-500/30', bar: 'from-violet-500 to-violet-400', text: 'text-violet-400' },
  C: { ring: 'ring-indigo-500/30', bar: 'from-indigo-500 to-indigo-400', text: 'text-indigo-400' },
}

interface ResultBreakdownProps {
  blockScores: BlockScore[]
}

export function ResultBreakdown({ blockScores }: ResultBreakdownProps) {
  return (
    <div className="space-y-4">
      {blockScores.map((block, i) => {
        const colors = blockColors[block.block] ?? blockColors['A']
        const pctColor =
          block.percentage >= 75 ? 'text-emerald-400' :
          block.percentage >= 50 ? 'text-amber-400' : 'text-red-400'

        const barGradient =
          block.percentage >= 75 ? 'from-emerald-500 to-emerald-400' :
          block.percentage >= 50 ? 'from-amber-500 to-amber-400' :
          'from-red-500 to-red-400'

        return (
          <motion.div
            key={block.block}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.12, duration: 0.4 }}
            className={`rounded-xl border border-slate-700/40 bg-slate-800/40 p-5 ring-1 ${colors.ring} backdrop-blur-sm`}
          >
            <div className="mb-3 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="mb-1 flex items-center gap-2">
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-700/60 text-xs font-bold ${colors.text}`}>
                    {block.block}
                  </span>
                  <span className="text-sm font-semibold text-white truncate">{block.blockLabel}</span>
                </div>
                <p className="text-xs leading-relaxed text-slate-500 pl-9">
                  {blockDescriptions[block.block]}
                </p>
              </div>

              {/* Score column */}
              <div className="shrink-0 text-right">
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-white">{block.correct}</span>
                  <span className="text-sm text-slate-500">/{block.total}</span>
                </div>
                <p className={`text-sm font-bold ${pctColor}`}>{block.percentage}%</p>
                {block.pointsEarned > 0 && (
                  <p className="text-xs text-slate-500">
                    {block.pointsEarned.toLocaleString()} pts
                  </p>
                )}
              </div>
            </div>

            {/* Progress bar */}
            <div className="relative h-2 overflow-hidden rounded-full bg-slate-700/60">
              <motion.div
                className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${barGradient}`}
                initial={{ width: 0 }}
                animate={{ width: `${block.percentage}%` }}
                transition={{ delay: i * 0.12 + 0.3, duration: 0.7, ease: 'easeOut' }}
              />
            </div>

            {/* Question dots */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {Array.from({ length: block.total }).map((_, qi) => {
                // Determina se a questão qi deste bloco está certa
                // A ordem das questões dentro de um bloco é preservada
                const blockQuestions = Array.from({ length: block.total })
                const isCorrectAtIndex = qi < block.correct // simplificado
                return (
                  <motion.div
                    key={qi}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: i * 0.12 + 0.5 + qi * 0.04 }}
                    className="h-2 w-2 rounded-full"
                    style={{
                      backgroundColor: qi < block.correct
                        ? block.percentage >= 75 ? '#10b981' : block.percentage >= 50 ? '#f59e0b' : '#ef4444'
                        : 'rgba(255,255,255,0.1)'
                    }}
                  />
                )
              })}
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
