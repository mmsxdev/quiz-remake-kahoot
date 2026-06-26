export interface Avatar {
  id: string
  name: string
  src: string
}

export const AVATARS: Avatar[] = [
  { id: 'joaninha',       name: 'Joaninha',       src: '/avatars/joaninha.svg' },
  { id: 'agua',           name: 'Água',           src: '/avatars/agua.svg' },
  { id: 'axolote_brasil', name: 'Axolote Brasil', src: '/avatars/axolote_brasil.svg' },
  { id: 'axolote',        name: 'Axolote',        src: '/avatars/axolote.svg' },
  { id: 'cacto',          name: 'Cacto',          src: '/avatars/cacto.svg' },
  { id: 'camaleao',       name: 'Camaleão',       src: '/avatars/camaleao.svg' },
  { id: 'chocolate',      name: 'Chocolate',      src: '/avatars/chocolate.svg' },
  { id: 'ciclope',        name: 'Ciclope',        src: '/avatars/ciclope.svg' },
  { id: 'donut',          name: 'Donut',          src: '/avatars/donut.svg' },
  { id: 'dragao',         name: 'Dragão',         src: '/avatars/dragao.svg' },
  { id: 'fada',           name: 'Fada',           src: '/avatars/fada.svg' },
  { id: 'fogo',           name: 'Fogo',           src: '/avatars/fogo.svg' },
  { id: 'girassol',       name: 'Girassol',       src: '/avatars/girassol.svg' },
  { id: 'louvadeus',      name: 'Louva-a-deus',   src: '/avatars/louvadeus.svg' },
  { id: 'luz',            name: 'Luz',            src: '/avatars/luz.svg' },
  { id: 'morango',        name: 'Morango',        src: '/avatars/morango.svg' },
  { id: 'nuvem',          name: 'Nuvem',          src: '/avatars/nuvem.svg' },
  { id: 'pedra',          name: 'Pedra',          src: '/avatars/pedra.svg' },
  { id: 'pizza',          name: 'Pizza',          src: '/avatars/pizza.svg' },
  { id: 'preguica',       name: 'Preguiça',       src: '/avatars/preguica.svg' },
  { id: 'robo',           name: 'Robô',           src: '/avatars/robo.svg' },
  { id: 'sereia',         name: 'Sereia',         src: '/avatars/sereia.svg' },
  { id: 'tatu',           name: 'Tatu',           src: '/avatars/tatu.svg' },
]

/** Chave do localStorage onde a escolha de avatar é persistida. */
export const AVATAR_STORAGE_KEY = 'quizdida:player:avatar'
