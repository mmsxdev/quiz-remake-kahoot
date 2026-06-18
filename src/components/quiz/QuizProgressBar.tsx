'use client'

import { motion } from 'framer-motion'

interface QuizProgressBarProps {
  percent: number
  answeredCount: number
  total: number
}

export function QuizProgressBar({ percent, answeredCount, total }: QuizProgressBarProps) {
  return (
    <div className="px-0 pb-0">
      {/* Block segment indicators */}
      <div className="relative h-1.5 w-full bg-slate-800">
        <motion.div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-violet-500"
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
        {/* Block dividers at 33% and 66% */}
        <div className="absolute inset-y-0 left-1/3 w-px bg-slate-700" />
        <div className="absolute inset-y-0 left-2/3 w-px bg-slate-700" />
      </div>
    </div>
  )
}
