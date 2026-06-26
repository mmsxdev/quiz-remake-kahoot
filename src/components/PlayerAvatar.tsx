'use client'

import Image from 'next/image'
import { AVATARS } from '@/data/avatars'

interface PlayerAvatarProps {
  /** ID do avatar (ex: 'axolote'). Se undefined, exibe fallback com iniciais. */
  avatarId?: string | null
  /** Tamanho do avatar. sm=32px · md=44px · lg=96px */
  size?: 'sm' | 'md' | 'lg'
  /** Nome do jogador, usado no alt e no fallback de iniciais. */
  name?: string
  className?: string
}

const sizeMap = {
  sm: 32,
  md: 44,
  lg: 96,
} as const

/** Gera uma cor de fundo determinística a partir do nome do jogador. */
function nameToColor(name?: string): string {
  if (!name) return '#6366f1'
  const hue = [...name].reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % 360
  return `hsl(${hue}, 60%, 55%)`
}

/** Extrai até 2 iniciais do nome. */
function initials(name?: string): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function PlayerAvatar({
  avatarId,
  size = 'md',
  name,
  className = '',
}: PlayerAvatarProps) {
  const px = sizeMap[size]
  const avatar = AVATARS.find((a) => a.id === avatarId)

  if (!avatar) {
    // Fallback: círculo colorido com iniciais
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white select-none ${className}`}
        style={{
          width: px,
          height: px,
          backgroundColor: nameToColor(name),
          fontSize: px * 0.35,
        }}
        aria-label={name ? `Avatar de ${name}` : 'Avatar'}
      >
        {initials(name)}
      </span>
    )
  }

  return (
    <Image
      src={avatar.src}
      alt={`Avatar: ${avatar.name}`}
      width={px}
      height={px}
      className={`shrink-0 rounded-full object-contain ${className}`}
      style={{ width: px, height: px }}
      priority={size === 'lg'}
    />
  )
}
