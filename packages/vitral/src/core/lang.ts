import type { Protocol } from './state'

/**
 * Os textos da lib estão em português? Vale `configure({ language })`, depois
 * o `lang` do `<html>` e depois a língua do navegador. Fora `pt`, inglês.
 */
export const isPt = (): boolean =>
  // Lê o protocolo sem `protocol()`: quem só lança um erro não carrega o estado da lib.
  /^pt\b/i.test(
    (globalThis as Record<symbol, Protocol | undefined>)[Symbol.for('vitral')]?.settings().language || globalThis.document?.documentElement.lang || globalThis.navigator?.language || '',
  )

/** O texto na língua da lib. */
export const tr = (pt: string, en: string): string => (isPt() ? pt : en)
