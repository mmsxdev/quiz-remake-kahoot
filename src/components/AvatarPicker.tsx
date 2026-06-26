'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, ArrowRight } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AVATARS, AVATAR_STORAGE_KEY, type Avatar } from '@/data/avatars'

interface AvatarPickerProps {
  open: boolean
  /** Chamado ao confirmar o avatar (com o id escolhido). */
  onConfirm: (avatarId: string) => void
}

export function AvatarPicker({ open, onConfirm }: AvatarPickerProps) {
  const [selected, setSelected] = useState<string | null>(null)

  // Ao abrir, restaura a última escolha salva
  useEffect(() => {
    if (open) {
      try {
        const saved = localStorage.getItem(AVATAR_STORAGE_KEY)
        if (saved && AVATARS.some((a) => a.id === saved)) {
          setSelected(saved)
        }
      } catch {
        // localStorage não disponível (SSR)
      }
    }
  }, [open])

  function handleConfirm() {
    if (!selected) return
    try {
      localStorage.setItem(AVATAR_STORAGE_KEY, selected)
    } catch {
      // silencia erro de escrita no localStorage
    }
    onConfirm(selected)
  }

  return (
    /* disablePointerDismissal + onOpenChange evita fechar ao clicar fora ou pressionar ESC */
    <Dialog open={open} disablePointerDismissal onOpenChange={() => { /* bloqueado intencionalmente */ }}>
      <DialogContent
        className="sm:max-w-md"
        showCloseButton={false}
      >
        <DialogHeader className="text-center pb-0">
          <DialogTitle className="text-xl font-bold text-slate-900 dark:text-white text-center">
            Escolha seu Avatar
          </DialogTitle>
          <DialogDescription className="text-center">
            Selecione um personagem para representar você durante o quiz.
          </DialogDescription>
        </DialogHeader>

        {/* Grade de avatares */}
        <div
          className="mt-4 grid grid-cols-3 gap-4"
          role="radiogroup"
          aria-label="Seleção de avatar"
        >
          {AVATARS.map((avatar: Avatar) => {
            const isSelected = selected === avatar.id
            return (
              <motion.button
                key={avatar.id}
                role="radio"
                aria-checked={isSelected}
                aria-label={`Avatar ${avatar.name}`}
                onClick={() => setSelected(avatar.id)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                className={`
                  relative flex flex-col items-center gap-2 rounded-2xl border-2 p-4 
                  transition-colors duration-200 cursor-pointer focus:outline-none
                  focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2
                  ${isSelected
                    ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-500/10'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600 dark:hover:bg-slate-800/60'
                  }
                `}
              >
                {/* Indicador de seleção */}
                <AnimatePresence>
                  {isSelected && (
                    <motion.span
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      className="absolute -top-2 -right-2 z-10"
                    >
                      <CheckCircle className="h-5 w-5 text-blue-500 dark:text-blue-400 fill-white dark:fill-slate-950" />
                    </motion.span>
                  )}
                </AnimatePresence>

                <Image
                  src={avatar.src}
                  alt={`Avatar ${avatar.name}`}
                  width={80}
                  height={80}
                  className="rounded-full object-contain"
                  style={{ width: 80, height: 80 }}
                />

                <span
                  className={`text-xs font-semibold ${
                    isSelected
                      ? 'text-blue-600 dark:text-blue-300'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {avatar.name}
                </span>
              </motion.button>
            )
          })}
        </div>

        {/* Ação */}
        <div className="mt-6">
          <Button
            onClick={handleConfirm}
            disabled={!selected}
            size="lg"
            className="w-full bg-blue-600 py-6 text-base font-semibold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Confirmar
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          {!selected && (
            <p className="mt-2 text-center text-xs text-slate-400">
              Selecione um avatar para continuar.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
