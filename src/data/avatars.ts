export interface Avatar {
  id: string
  name: string
  src: string
}

export const AVATARS: Avatar[] = [
  { id: 'axolote',  name: 'Axolote',  src: '/avatars/axolote.svg' },
  { id: 'camaleao', name: 'Camaleão', src: '/avatars/camaleao.svg' },
  { id: 'preguica', name: 'Preguiça', src: '/avatars/preguica.svg' },
]

/** Chave do localStorage onde a escolha de avatar é persistida. */
export const AVATAR_STORAGE_KEY = 'quizdida:player:avatar'
