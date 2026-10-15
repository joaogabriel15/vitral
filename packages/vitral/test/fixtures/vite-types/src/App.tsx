import type { Produto } from './tipos'

type Modo = 'compacto' | 'completo'

interface Props {
  userId: number
  itens?: Produto[]
  modo: Modo
  ativo: boolean
  criado: Date
  par: [string, number]
  extras: Record<string, number>
  onSair?: (motivo: string) => void
  'data-x'?: string
  vitral?: unknown
}

export default function App(_props: Props) {
  return null
}
