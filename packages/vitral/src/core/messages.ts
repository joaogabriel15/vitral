import { isPt } from './lang'
import { protocol } from './state'

/** Textos da interface padrão (carregando e erro), em `configure({ messages })`. */
export interface Messages {
  /** Enquanto o remote baixa. */
  loading: string
  /** Quando o remote falha. */
  error: string
  /** Botão para tentar de novo. */
  retry: string
}

const PT: Messages = { loading: 'Carregando…', error: 'Não foi possível carregar.', retry: 'Tentar de novo' }
const EN: Messages = { loading: 'Loading…', error: 'Could not load.', retry: 'Try again' }

/** Textos da interface padrão, com os de `configure({ messages })` por cima. */
export const messages = (): Messages => ({ ...(isPt() ? PT : EN), ...protocol().settings().messages })
