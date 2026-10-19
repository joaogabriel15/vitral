import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import type { RemoteManifest } from '../core/types'

/**
 * Canais no CDN: cada versão fica num caminho que nunca muda
 * (`/chat/1.4.2/`) e cada canal (`/chat/stable/`, `/chat/beta/`) tem só um
 * `vitral.json` que aponta para os arquivos de uma versão. Os caminhos do
 * manifesto são relativos a ele, então o do canal ganha o prefixo
 * `../<versão>/`. Caminhos absolutos (`https://…`, `/…`) ficam como estão.
 */
export function channelManifest(m: RemoteManifest, prefix: string): RemoteManifest {
  const at = (u: string) => (/^([a-z][a-z\d+.-]*:|\/)/i.test(u) ? u : prefix + u.replace(/^\.\//, ''))
  const out: RemoteManifest = { ...m, entry: at(m.entry) }
  if (m.css) out.css = m.css.map(at)
  if (m.files) out.files = Object.fromEntries(Object.entries(m.files).map(([file, hash]) => [at(file), hash]))
  if (m.split) out.split = { ...m.split, entry: at(m.split.entry), ...(m.split.chunks && { chunks: m.split.chunks.map(at) }) }
  if (m.dedupe) out.dedupe = m.dedupe.map((d) => ({ ...d, file: at(d.file), ...(d.chunks && { chunks: d.chunks.map(at) }) }))
  // `shadow` é relativo ao primeiro CSS, que já aponta para a versão.
  return out
}

export interface CanalOptions {
  /** `vitral.json` da versão: arquivo local ou URL já publicada. */
  source: string
  /** Pasta da versão no CDN. Padrão: `version` do manifesto. */
  version?: string
  /** Arquivo gerado. Sem ele, vai para a saída padrão. */
  out?: string
  fetch?: typeof fetch
  log?: (text: string) => void
}

/** `npx vitral canal`: gera o `vitral.json` de um canal a partir do de uma versão. */
export async function canal(o: CanalOptions): Promise<void> {
  const m: RemoteManifest = /^https?:/.test(o.source)
    ? await (o.fetch ?? fetch)(o.source).then((r) => {
        if (!r.ok) throw new Error(`[vitral] ${o.source}: HTTP ${r.status}`)
        return r.json()
      })
    : JSON.parse(readFileSync(o.source, 'utf8'))
  const version = o.version ?? m.version
  if (!version) throw new Error('[vitral] o manifesto não tem version: use --versao')
  const text = JSON.stringify(channelManifest(m, `../${version}/`), null, 2) + '\n'
  if (!o.out) return void (o.log ?? console.log)(text.trimEnd())
  mkdirSync(dirname(o.out), { recursive: true })
  writeFileSync(o.out, text)
}
