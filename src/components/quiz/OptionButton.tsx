'use client'

import { motion } from 'framer-motion'
import { CheckCircle2, XCircle, Circle } from 'lucide-react'
import type { Option } from '@/lib/types'
import { cn } from '@/lib/utils'

interface OptionButtonProps {
  option: Option
  index: number
  isSelected: boolean
  hasAnswered: boolean
  onSelect: () => void
}

const LETTERS = ['A', 'B', 'C', 'D']

export function OptionButton({ option, index, isSelected, hasAnswered, onSelect }: OptionButtonProps) {
  const isCorrect = option.isCorrect
  const showCorrect = hasAnswered && isCorrect
  const showWrong = hasAnswered && isSelected && !isCorrect
  const isDisabled = hasAnswered && !isSelected && !isCorrect

  return (
    <motion.button
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06, duration: 0.3 }}
      onClick={onSelect}
      disabled={hasAnswered}
      aria-checked={isSelected}
      role="radio"
      className={cn(
        'group relative flex w-full cursor-pointer items-start gap-4 rounded-xl border px-5 py-4 text-left transition-all duration-200',
        // Default
        !hasAnswered && !isSelected && [
          'border-slate-700/60 bg-slate-800/40',
          'hover:border-blue-500/50 hover:bg-slate-800/70',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
        ],
        // Selected (before answer)
        !hasAnswered && isSelected && 'border-blue-500 bg-blue-500/15',
        // Correct (after answer)
        showCorrect && 'border-emerald-500/60 bg-emerald-500/10',
        // Wrong selection (after answer)
        showWrong && 'border-red-500/60 bg-red-500/10',
        // Dimmed (non-selected, not correct, after answer)
        isDisabled && 'cursor-not-allowed border-slate-700/30 bg-slate-800/20 opacity-40',
      )}
    >
      {/* Letter badge */}
      <span
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold transition-colors',
          !hasAnswered && !isSelected && 'bg-slate-700 text-slate-400 group-hover:bg-blue-500/30 group-hover:text-blue-300',
          !hasAnswered && isSelected && 'bg-blue-500 text-white',
          showCorrect && 'bg-emerald-500 text-white',
          showWrong && 'bg-red-500 text-white',
          isDisabled && 'bg-slate-700 text-slate-500',
        )}
      >
        {LETTERS[index]}
      </span>

      {/* Option text */}
      <span
        className={cn(
          'flex-1 text-sm leading-relaxed md:text-base',
          !hasAnswered && !isSelected && 'text-slate-300',
          !hasAnswered && isSelected && 'font-medium text-white',
          showCorrect && 'font-medium text-emerald-200',
          showWrong && 'font-medium text-red-200',
          isDisabled && 'text-slate-500',
        )}
      >
        {option.text}
      </span>

      {/* Status icon */}
      {hasAnswered && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className="shrink-0 self-center"
        >
          {showCorrect && <CheckCircle2 className="h-5 w-5 text-emerald-400" />}
          {showWrong && <XCircle className="h-5 w-5 text-red-400" />}
        </motion.span>
      )}
    </motion.button>
  )
}
