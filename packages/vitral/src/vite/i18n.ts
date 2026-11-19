/**
 * Traduções do remote (`vitral({ i18n: 'src/locales/{lng}/{ns}.json' })`).
 * Cada arquivo sai com hash no nome em `i18n/<lng>/`, e o `vitral.json` lista
 * tudo em `i18n`, com o SRI de cada um em `files`. O host baixa só a língua aberta.
 */
import { createHash } from 'node:crypto'
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

type Files = Record<string, Record<string, string>>

/** Arquivos do padrão: `{ lng, ns, file }`. Sem `{ns}` no padrão, o namespace é `fallbackNs`. */
export function findTranslations(root: string, pattern: string, fallbackNs: string): { lng: string; ns: string; file: string }[] {
  const norm = pattern.replace(/\\/g, '/').replace(/^\.\//, '')
  if (!norm.includes('{lng}')) throw new Error(`[vitral] i18n: o padrão precisa de {lng} (ex.: 'src/locales/{lng}/{ns}.json'), recebeu '${pattern}'`)
  const base = norm.slice(0, norm.indexOf('{')).replace(/[^/]*$/, '')
  const re = new RegExp(
    '^' +
      norm
        .split(/(\{lng\}|\{ns\})/)
        .map((part) => (part === '{lng}' ? '(?<lng>[^/]+)' : part === '{ns}' ? '(?<ns>[^/]+)' : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
        .join('') +
      '$',
  )
  let names: string[]
  try {
    names = readdirSync(resolve(root, base), { recursive: true }) as string[]
  } catch {
    return []
  }
  const out: { lng: string; ns: string; file: string }[] = []
  for (const n of names) {
    const rel = (base + n).replace(/\\/g, '/')
    const m = re.exec(rel)
    if (m?.groups) out.push({ lng: m.groups.lng, ns: m.groups.ns ?? fallbackNs, file: resolve(root, rel) })
  }
  return out.sort((a, b) => (a.lng + a.ns < b.lng + b.ns ? -1 : 1))
}

/** Grava as traduções em `outDir/i18n/<lng>/<ns>-<hash>.json` (JSON sem espaços) e devolve o mapa do manifesto. */
export function emitTranslations(root: string, outDir: string, pattern: string, fallbackNs: string): Files | undefined {
  const found = findTranslations(root, pattern, fallbackNs)
  if (!found.length) return
  const files: Files = {}
  for (const { lng, ns, file } of found) {
    let text: string
    try {
      text = JSON.stringify(JSON.parse(readFileSync(file, 'utf8')))
    } catch (e) {
      throw new Error(`[vitral] i18n: JSON inválido em ${relative(root, file)}: ${(e as Error).message}`)
    }
    const hash = createHash('sha256').update(text).digest('base64url').slice(0, 8)
    const name = `i18n/${lng}/${ns}-${hash}.json`
    mkdirSync(join(outDir, 'i18n', lng), { recursive: true })
    writeFileSync(join(outDir, name), text)
    ;(files[lng] ??= {})[ns] = name
  }
  return files
}

/** Em `vite dev`: os arquivos de origem, servidos pelo Vite como estão. */
export function devTranslations(root: string, pattern: string, fallbackNs: string): Files | undefined {
  const found = findTranslations(root, pattern, fallbackNs)
  if (!found.length) return
  const files: Files = {}
  for (const { lng, ns, file } of found) (files[lng] ??= {})[ns] = '/' + relative(root, file).replace(/\\/g, '/')
  return files
}
