export interface Produto {
  id: number
  nome: string
  /** Produtos relacionados: tipo recursivo. */
  relacionados?: Produto[]
}
