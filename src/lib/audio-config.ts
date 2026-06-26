// ─── Playlist NCS ──────────────────────────────────────────────────────────────
// Músicas fornecidas por NoCopyrightSounds
// Licença: https://ncs.io/usage-policy
// Attribution obrigatória: "Music provided by http://spoti.fi/NCS"

export interface PlaylistTrack {
  /** URL relativo ao public/ (servido pelo Next.js) */
  src: string
  /** Nome da música */
  title: string
  /** Artista(s) */
  artist: string
  /** Gênero (para exibição nos créditos) */
  genre?: string
}

export const PLAYLIST: PlaylistTrack[] = [
  {
    src: '/audio/playlist/cartoon-jeja-on-and-on.mp3',
    title: 'On & On',
    artist: 'Cartoon, Jéja (feat. Daniel Levi)',
    genre: 'Electronic Pop',
  },
  {
    src: '/audio/playlist/cartoon-jeja-why-we-lose.mp3',
    title: 'Why We Lose',
    artist: 'Cartoon, Jéja (feat. Coleman Trapp)',
    genre: 'Drum & Bass',
  },
  {
    src: '/audio/playlist/disfigure-blank.mp3',
    title: 'Blank',
    artist: 'Disfigure',
    genre: 'Melodic Dubstep',
  },
  {
    src: '/audio/playlist/egzod-maestro-chives-royalty.mp3',
    title: 'Royalty',
    artist: 'Egzod & Maestro Chives (feat. Neoni)',
    genre: 'Trap',
  },
  {
    src: '/audio/playlist/jo-cohen-sex-whales-we-are.mp3',
    title: 'We Are',
    artist: 'Jo Cohen & Sex Whales',
    genre: 'Future Bass',
  },
  {
    src: '/audio/playlist/julius-dreisig-zeus-x-crona-invisible.mp3',
    title: 'Invisible',
    artist: 'Julius Dreisig & Zeus X Crona',
    genre: 'Trap',
  },
  {
    src: '/audio/playlist/lost-sky-dreams-pt2.mp3',
    title: 'Dreams pt. II',
    artist: 'Lost Sky (feat. Sara Skinner)',
    genre: 'Trap',
  },
  {
    src: '/audio/playlist/lost-sky-fearless-pt2.mp3',
    title: 'Fearless pt.II',
    artist: 'Lost Sky (feat. Chris Linton)',
    genre: 'Trap',
  },
  {
    src: '/audio/playlist/robin-hustin-tobimorrow-light-it-up.mp3',
    title: 'Light It Up',
    artist: 'Robin Hustin x TobiMorrow (feat. Jex)',
    genre: 'Future Bounce',
  },
  {
    src: '/audio/playlist/ship-wrek-zookeepers-ark.mp3',
    title: 'Ark',
    artist: 'Ship Wrek & Zookeepers',
    genre: 'Future Bass',
  },
  {
    src: '/audio/playlist/spektrem-shine.mp3',
    title: 'Shine',
    artist: 'Spektrem',
    genre: 'Progressive House',
  },
  {
    src: '/audio/playlist/sub-urban-cradles.mp3',
    title: 'Cradles',
    artist: 'Sub Urban',
    genre: 'Pop',
  },
  {
    src: '/audio/playlist/unknown-brain-superhero.mp3',
    title: 'Superhero',
    artist: 'Unknown Brain (feat. Chris Linton)',
    genre: 'Trap',
  },
]

// ─── SFX ──────────────────────────────────────────────────────────────────────

export const SFX = {
  correct: '/audio/sfx/correct.mp3',
  wrong: '/audio/sfx/wrong.mp3',
  fanfare: '/audio/sfx/fanfare.mp3',
} as const

// ─── Attribution padrão ───────────────────────────────────────────────────────

export const NCS_ATTRIBUTION = {
  short: 'Music provided by http://spoti.fi/NCS',
  long: 'This application uses royalty-free music provided by NoCopyrightSounds (NCS). All tracks are used in accordance with the NCS usage policy.',
  url: 'https://ncs.io/usage-policy',
}