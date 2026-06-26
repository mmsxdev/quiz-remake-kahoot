'use client'

import { useState, useRef, useEffect } from 'react'
import { Volume2, VolumeX, Music, ChevronRight } from 'lucide-react'
import { useAudio } from '@/lib/audio-manager'
import { PLAYLIST } from '@/lib/audio-config'

/**
 * Botão flutuante de controle de áudio.
 * Fica no canto inferior direito. Ao clicar, expande um painel com:
 *  - Botão de mute (toggle)
 *  - Slider de volume
 *  - Info da faixa atual
 *  - Botão "próxima faixa"
 *  - Botão "créditos"
 */
export function AudioControls() {
  const { muted, toggleMute, volume, setVolume, currentTrackIndex, nextTrack } = useAudio()
  const [expanded, setExpanded] = useState(false)
  const [showCredits, setShowCredits] = useState(false)
  const panelRef = useRef<HTMLDivElement | null>(null)

  // Fecha o painel ao clicar fora
  useEffect(() => {
    if (!expanded) return
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setExpanded(false)
        setShowCredits(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [expanded])

  const currentTrack = PLAYLIST[currentTrackIndex]

  return (
    <div
      ref={panelRef}
      className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2"
    >
      {/* Painel expandido */}
      {expanded && (
        <div className="bg-card text-card-foreground ring-foreground/10 ring-1 rounded-xl shadow-2xl p-4 w-72 animate-in slide-in-from-bottom-4 fade-in duration-200">
          {showCredits ? (
            <CreditsPanel onBack={() => setShowCredits(false)} />
          ) : (
            <ControlsPanel
              muted={muted}
              toggleMute={toggleMute}
              volume={volume}
              setVolume={setVolume}
              currentTrack={currentTrack}
              onNext={() => {
                nextTrack()
              }}
              onCredits={() => setShowCredits(true)}
            />
          )}
        </div>
      )}

      {/* Botão principal (sempre visível) */}
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-1 ring-foreground/10 transition-transform hover:scale-105 active:scale-95"
        aria-label={muted ? 'Ativar som' : 'Controles de áudio'}
        title={muted ? 'Áudio mutado' : 'Controles de áudio'}
      >
        {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
      </button>
    </div>
  )
}

// ─── Painel de controles ──────────────────────────────────────────────────────

function ControlsPanel({
  muted,
  toggleMute,
  volume,
  setVolume,
  currentTrack,
  onNext,
  onCredits,
}: {
  muted: boolean
  toggleMute: () => void
  volume: number
  setVolume: (v: number) => void
  currentTrack: { title: string; artist: string; genre?: string }
  onNext: () => void
  onCredits: () => void
}) {
  return (
    <div className="flex flex-col gap-3 text-sm">
      {/* Faixa atual */}
      <div className="flex flex-col gap-0.5 pb-2 border-b border-border/50">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Music className="h-3 w-3" />
          <span className="font-semibold uppercase tracking-wider">Tocando agora</span>
        </div>
        <div className="font-medium leading-tight">{currentTrack.title}</div>
        <div className="text-xs text-muted-foreground">{currentTrack.artist}</div>
      </div>

      {/* Slider de volume */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggleMute}
          className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted transition-colors"
          aria-label={muted ? 'Ativar som' : 'Mutar'}
          title={muted ? 'Ativar som' : 'Mutar'}
        >
          {muted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={muted ? 0 : volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          className="flex-1 accent-primary"
          aria-label="Volume"
        />
        <span className="text-xs text-muted-foreground w-8 text-right tabular-nums">
          {Math.round((muted ? 0 : volume) * 100)}%
        </span>
      </div>

      {/* Botões de ação */}
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={onNext}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Próxima faixa →
        </button>
        <button
          type="button"
          onClick={onCredits}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Créditos
          <ChevronRight className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}

// ─── Painel de créditos ───────────────────────────────────────────────────────

function CreditsPanel({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col gap-2 text-xs max-h-80 overflow-y-auto">
      <div className="flex items-center justify-between pb-2 border-b border-border/50 sticky top-0 bg-card">
        <button
          type="button"
          onClick={onBack}
          className="text-muted-foreground hover:text-foreground transition-colors text-xs"
        >
          ← Voltar
        </button>
        <span className="font-semibold">Créditos de Música</span>
        <span className="w-10" />
      </div>

      <p className="text-muted-foreground leading-relaxed">
        Trilha sonora fornecida por <strong>NoCopyrightSounds</strong>. Músicas usadas conforme a{' '}
        <a
          href="https://ncs.io/usage-policy"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-foreground"
        >
          política de uso
        </a>
        .
      </p>

      <div className="flex flex-col gap-1 pt-1">
        {PLAYLIST.map((track) => (
          <div
            key={track.src}
            className="flex flex-col py-1 border-b border-border/30 last:border-0"
          >
            <span className="font-medium text-foreground">{track.title}</span>
            <span className="text-muted-foreground">
              {track.artist}
              {track.genre && <> · {track.genre}</>}
            </span>
          </div>
        ))}
      </div>

      <p className="text-muted-foreground italic pt-2">
        Music provided by http://spoti.fi/NCS
      </p>
    </div>
  )
}