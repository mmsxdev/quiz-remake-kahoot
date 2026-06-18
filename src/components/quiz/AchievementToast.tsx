'use client'

import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { AchievementId } from '@/lib/types'
import { ACHIEVEMENTS } from '@/lib/scoring'

interface AchievementToastProps {
  achievements: AchievementId[]
  onDismiss: () => void
}

export function AchievementToast({ achievements, onDismiss }: AchievementToastProps) {
  useEffect(() => {
    if (achievements.length === 0) return
    const timer = setTimeout(onDismiss, 3500)
    return () => clearTimeout(timer)
  }, [achievements, onDismiss])

  return (
    <AnimatePresence>
      {achievements.length > 0 && (
        <div className="pointer-events-none fixed right-4 bottom-24 z-50 flex flex-col gap-2">
          {achievements.map((id) => {
            const achievement = ACHIEVEMENTS[id]
            if (!achievement) return null
            return (
              <motion.div
                key={id}
                initial={{ opacity: 0, x: 60, scale: 0.85 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 60, scale: 0.85 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                className="flex items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-500/15 px-4 py-3 shadow-lg backdrop-blur-md"
              >
                <span className="text-2xl">{achievement.emoji}</span>
                <div>
                  <p className="text-sm font-bold text-amber-300">Conquista desbloqueada!</p>
                  <p className="text-xs text-amber-200">{achievement.label}</p>
                  {achievement.bonusPoints > 0 && (
                    <p className="text-xs font-semibold text-emerald-400">
                      +{achievement.bonusPoints} pts
                    </p>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </AnimatePresence>
  )
}

// ─── Score pop (bônus de velocidade/streak) ───────────────────────────────────

interface ScorePopProps {
  points: number
  label: string
  show: boolean
}

export function ScorePop({ points, label, show }: ScorePopProps) {
  return (
    <AnimatePresence>
      {show && points > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 0, scale: 0.8 }}
          animate={{ opacity: 1, y: -32, scale: 1 }}
          exit={{ opacity: 0, y: -56, scale: 0.7 }}
          transition={{ duration: 0.6 }}
          className="pointer-events-none absolute -top-2 right-2 z-20 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-400 border border-emerald-500/30"
        >
          +{points} {label}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
