'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { motion } from 'framer-motion'

interface QuizTimerProps {
  /** Tempo limite em segundos */
  timeLimitSec: number
  /** Chamado quando o tempo esgota */
  onTimeout: () => void
  /** Chamado a cada segundo com o tempo restante em ms */
  onTick?: (timeLeftMs: number) => void
  /** Chave para forçar reset (mude o valor para reiniciar o timer) */
  resetKey: string | number
  /** Se true, pausa o timer (ex: após responder) */
  paused?: boolean
  size?: number
}

export function QuizTimer({ timeLimitSec, onTimeout, onTick, resetKey, paused = false, size = 56 }: QuizTimerProps) {
  const [timeLeft, setTimeLeft] = useState(timeLimitSec)
  const onTimeoutRef = useRef(onTimeout)
  onTimeoutRef.current = onTimeout

  // Reset quando resetKey ou timeLimitSec mudam
  useEffect(() => {
    setTimeLeft(timeLimitSec)
  }, [resetKey, timeLimitSec])

  const onTickRef = useRef(onTick)
  onTickRef.current = onTick

  useEffect(() => {
    if (paused || timeLeft <= 0) {
      if (timeLeft <= 0) onTimeoutRef.current()
      return
    }
    // Reporta o tempo atual imediatamente e depois a cada tick
    onTickRef.current?.(timeLeft * 1000)
    const id = setInterval(() => {
      setTimeLeft((t) => {
        const next = t - 1
        onTickRef.current?.(next * 1000)
        return next
      })
    }, 1000)
    return () => clearInterval(id)
  }, [timeLeft, paused])

  const ratio = timeLeft / timeLimitSec
  const radius = (size - 8) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference * (1 - ratio)

  const color =
    ratio > 0.5 ? '#10b981' :  // verde (>50%)
    ratio > 0.25 ? '#f59e0b' : // âmbar (25-50%)
    '#ef4444'                   // vermelho (<25%)

  const urgente = ratio <= 0.25 && timeLeft > 0 && !paused

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
      role="timer"
      aria-label={`${timeLeft} segundos restantes`}
    >
      <svg width={size} height={size} className={urgente ? 'animate-pulse' : ''}>
        {/* Trilho */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={4}
        />
        {/* Progresso */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
        />
      </svg>
      {/* Número central */}
      <span
        className="absolute text-sm font-bold tabular-nums"
        style={{ color: paused ? 'rgba(255,255,255,0.3)' : color }}
      >
        {paused ? '—' : timeLeft}
      </span>
    </div>
  )
}


