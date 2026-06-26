'use client'

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { PLAYLIST, SFX } from './audio-config'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface AudioContextValue {
  /** Está mutado? (música de fundo) */
  muted: boolean
  /** Volume (0..1) da música de fundo */
  volume: number
  /** Toggle mute */
  toggleMute: () => void
  /** Set volume */
  setVolume: (v: number) => void
  /** Toca um SFX (não respeita o muted — sempre toca) */
  playSfx: (key: keyof typeof SFX) => void
  /** Toca a música de fundo (se ainda não está tocando) */
  startBackground: () => void
  /** Para a música de fundo */
  stopBackground: () => void
  /** Próxima faixa (opcional) */
  nextTrack: () => void
  /** Faixa atual (debug/display) */
  currentTrackIndex: number
}

// ─── Persistência ─────────────────────────────────────────────────────────────

const LS_MUTED = 'quizdida:audio:muted'
const LS_VOLUME = 'quizdida:audio:volume'

// ─── Helper: lê do localStorage no client (lazy initializer) ──────────────────

function readStoredPrefs(): { muted: boolean; volume: number } {
  if (typeof window === 'undefined') return { muted: false, volume: 0.3 }
  try {
    const savedMuted = localStorage.getItem(LS_MUTED)
    const savedVolume = localStorage.getItem(LS_VOLUME)
    return {
      muted: savedMuted === 'true',
      volume:
        savedVolume !== null && !Number.isNaN(Number(savedVolume))
          ? Math.max(0, Math.min(1, Number(savedVolume)))
          : 0.3,
    }
  } catch {
    return { muted: false, volume: 0.3 }
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AudioContext = createContext<AudioContextValue | null>(null)

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AudioProvider({ children }: { children: React.ReactNode }) {
  // Estado inicial lendo do localStorage (lazy initializer — não dispara efeito)
  const [muted, setMuted] = useState<boolean>(() => readStoredPrefs().muted)
  const [volume, setVolumeState] = useState<number>(() => readStoredPrefs().volume)
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(0)

  // Refs para áudio
  const bgAudioRef = useRef<HTMLAudioElement | null>(null)
  const sfxAudioRefs = useRef<Map<string, HTMLAudioElement>>(new Map())

  // Persiste mudanças de muted
  useEffect(() => {
    try {
      localStorage.setItem(LS_MUTED, String(muted))
    } catch {
      /* ignore */
    }
  }, [muted])

  // Persiste mudanças de volume
  useEffect(() => {
    try {
      localStorage.setItem(LS_VOLUME, String(volume))
    } catch {
      /* ignore */
    }
  }, [volume])

  // Aplica volume/mute no player de fundo
  useEffect(() => {
    const audio = bgAudioRef.current
    if (audio) {
      audio.volume = muted ? 0 : volume
    }
  }, [muted, volume])

  // ─── Helpers (declarados antes dos useEffects que dependem deles) ────────────

  const pickNextTrack = useCallback(() => {
    setCurrentTrackIndex((current) => {
      if (PLAYLIST.length <= 1) return 0
      let next = current
      // Garante que não repete a mesma faixa
      while (next === current) {
        next = Math.floor(Math.random() * PLAYLIST.length)
      }
      return next
    })
  }, [])

  // ─── SFX (preload ao montar) ──────────────────────────────────────────────
  useEffect(() => {
    const refs = sfxAudioRefs.current
    Object.entries(SFX).forEach(([key, src]) => {
      const audio = new Audio(src)
      audio.preload = 'auto'
      audio.volume = 0.6
      refs.set(key, audio)
    })
    return () => {
      refs.clear()
    }
  }, [])

  // ─── Música de fundo (setup inicial) ──────────────────────────────────────
  useEffect(() => {
    // Cria o elemento <audio> dinamicamente
    const audio = new Audio()
    audio.loop = false
    audio.preload = 'auto'
    audio.volume = muted ? 0 : volume
    bgAudioRef.current = audio

    // Quando a faixa atual terminar, vai pra próxima (com shuffle)
    const handleEnded = () => {
      pickNextTrack()
    }
    audio.addEventListener('ended', handleEnded)

    return () => {
      audio.removeEventListener('ended', handleEnded)
      audio.pause()
      audio.src = ''
      bgAudioRef.current = null
    }
    // pickNextTrack é estável (useCallback com deps []), não precisa estar aqui
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Carrega a faixa atual quando muda o índice
  useEffect(() => {
    const audio = bgAudioRef.current
    if (!audio) return
    const track = PLAYLIST[currentTrackIndex]
    if (!track) return
    audio.src = track.src
    audio.load()
  }, [currentTrackIndex])

  // ─── Mais helpers ──────────────────────────────────────────────────────────

  const toggleMute = useCallback(() => {
    setMuted((m) => !m)
  }, [])

  const setVolume = useCallback(
    (v: number) => {
      const clamped = Math.max(0, Math.min(1, v))
      setVolumeState(clamped)
      // Se o volume > 0 e está mutado, desmutar
      if (clamped > 0 && muted) setMuted(false)
    },
    [muted],
  )

  const playSfx = useCallback((key: keyof typeof SFX) => {
    const audio = sfxAudioRefs.current.get(key)
    if (!audio) return
    // Clona o nó pra permitir sobreposição rápida (vários acertos em sequência)
    const clone = audio.cloneNode(true) as HTMLAudioElement
    clone.volume = 0.6
    clone.play().catch(() => {
      /* Autoplay bloqueado — ignorar */
    })
    // Limpa o clone após tocar
    clone.addEventListener('ended', () => clone.remove())
  }, [])

  const startBackground = useCallback(() => {
    const audio = bgAudioRef.current
    if (!audio) return
    if (audio.paused) {
      audio.play().catch(() => {
        /* Autoplay bloqueado — usuário precisa interagir primeiro */
      })
    }
  }, [])

  const stopBackground = useCallback(() => {
    const audio = bgAudioRef.current
    if (!audio) return
    audio.pause()
  }, [])

  const nextTrack = useCallback(() => {
    pickNextTrack()
    // Reinicia a reprodução após trocar
    setTimeout(() => {
      const audio = bgAudioRef.current
      if (audio) {
        audio.play().catch(() => {
          /* ignore */
        })
      }
    }, 100)
  }, [pickNextTrack])

  const value = useMemo<AudioContextValue>(
    () => ({
      muted,
      volume,
      toggleMute,
      setVolume,
      playSfx,
      startBackground,
      stopBackground,
      nextTrack,
      currentTrackIndex,
    }),
    [
      muted,
      volume,
      toggleMute,
      setVolume,
      playSfx,
      startBackground,
      stopBackground,
      nextTrack,
      currentTrackIndex,
    ],
  )

  return <AudioContext.Provider value={value}>{children}</AudioContext.Provider>
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAudio(): AudioContextValue {
  const ctx = useContext(AudioContext)
  if (!ctx) {
    throw new Error('useAudio deve ser usado dentro de <AudioProvider>')
  }
  return ctx
}