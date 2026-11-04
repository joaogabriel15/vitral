/**
 * Ordem de download do build dividido, calculada no build (`split.order` e
 * `split.critical` do manifesto). Manifestos antigos não têm: a ordem fica a
 * de antes e nenhum arquivo ganha prioridade.
 */
import type { RemoteManifest } from './types'

/** `files` na ordem do build; o que não está nela vai no fim, na ordem dada. */
export function ordered(files: string[], order?: string[]): string[] {
  if (!order) return files
  const at = new Map(order.map((f, i) => [f, i]))
  return files
    .map((f, i) => [f, at.get(f) ?? order.length + i] as const)
    .sort((a, b) => a[1] - b[1])
    .map(([f]) => f)
}

/** Arquivos do caminho crítico, relativos ao manifesto. */
export function critical(m: RemoteManifest): Set<string> {
  const { order = [], critical = [] } = m.split ?? {}
  return new Set(critical.map((i) => order[i]).filter(Boolean))
}
