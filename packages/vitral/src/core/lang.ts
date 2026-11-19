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

/**
 * Os textos da lib estão em português? Vale `configure({ language })`, depois
 * o `lang` do `<html>` e depois a língua do navegador. Fora `pt`, inglês.
 */
export function isPt(): boolean {
  const lang =
    protocol().settings().language || (typeof document != 'undefined' && document.documentElement?.lang) || (typeof navigator != 'undefined' && navigator.language) || ''
  return /^pt\b/i.test(lang)
}

/** O texto na língua da lib. */
export const tr = (pt: string, en: string): string => (isPt() ? pt : en)

/** Textos da interface padrão, com os de `configure({ messages })` por cima. */
export const messages = (): Messages => ({ ...(isPt() ? PT : EN), ...protocol().settings().messages })
