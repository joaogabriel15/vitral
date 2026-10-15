/**
 * Manifesto v2: o build dividido sai ao lado do arquivo único.
 *
 * O arquivo único (`entry` + `integrity`) continua servindo hosts antigos e o
 * caminho com `blob:`. O build dividido (`split/`) só é publicado quando o
 * remote tem import dinâmico; aí o manifesto ganha `files` (hash de cada
 * arquivo, CSS incluído) e `split` (entrada e chunks que ela usa logo).
 */
import { createHash } from 'node:crypto'
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, posix } from 'node:path'
import type { RemoteManifest } from '../core/types'
import type { Group } from './dedupe'

export const SPLIT = 'split/'

interface Chunk {
  type: 'chunk'
  fileName: string
  isEntry: boolean
  imports: string[]
  dynamicImports: string[]
  facadeModuleId?: string | null
}
type Bundle = Record<string, { type: string; fileName: string }>

export interface Split {
  entry: string
  /** Chunks que a entrada importa estaticamente (direta ou indiretamente). */
  chunks: string[]
  /** Todos os JS do build dividido. */
  files: string[]
  /** Cópia própria de cada grupo de `dedupe`: o arquivo e o que ele importa. */
  own: Record<string, { file: string; chunks: string[] }>
}

export const sri = (file: string): string => 'sha384-' + createHash('sha384').update(readFileSync(file)).digest('base64')

/** As duas saídas do build: arquivo único e build dividido. */
export function outputs(rolldown: boolean): Record<string, unknown>[] {
  return [
    { format: 'es', ...(rolldown ? { codeSplitting: false } : { inlineDynamicImports: true }) },
    // Os assets saem com o mesmo nome nas duas (o Vite só aceita um padrão).
    { format: 'es', entryFileNames: `${SPLIT}remote-[hash].js`, chunkFileNames: `${SPLIT}[name]-[hash].js` },
  ]
}

/** A saída é o build dividido? */
export const isSplit = (bundle: Bundle): boolean =>
  Object.values(bundle).some((f) => f.type === 'chunk' && (f as Chunk).isEntry && f.fileName.startsWith(SPLIT))

/**
 * `import()` do remote no build dividido. Onde a lib usou o caminho 2
 * (`modulepreload` com `integrity`), o protocolo guarda os hashes em `sri`:
 * os chunks entram antes do arquivo pedido, na mesma tarefa, e o `import()`
 * só acontece depois que todos carregaram. Arquivo sem hash não roda. Nos
 * outros casos (caminho 1, o import map já confere), é um `import()` comum.
 * `load` e `base` existem para os testes.
 */
export const helper = (load = 'import', base = 'import.meta.url'): string =>
  `function __vitralImport(u,d){var p=globalThis[Symbol.for("vitral")],s=p&&p.sri,a=d.concat(u).map(function(x){return new URL(x,${base}).href});` +
  `return Promise.all(s?a.map(function(h){return new Promise(function(ok,no){if(!s[h])return no(new Error("vitral: arquivo sem integrity: "+h));` +
  `var l=document.createElement("link");l.rel="modulepreload";l.crossOrigin="anonymous";l.integrity=s[h];l.href=h;l.onload=ok;l.onerror=function(){no(new Error("vitral: integrity não confere: "+h))};document.head.appendChild(l)})}):[])` +
  `.then(function(){return ${load}(a[a.length-1])})}`

/**
 * Lê o build dividido já gravado e troca os `import()` pelo helper. Sem
 * `import()` de verdade no código ele não traz ganho: a pasta é apagada e o
 * manifesto fica só com o arquivo único.
 */
export function collect(outDir: string, bundle: Bundle): Split | undefined {
  // O CSS vem do arquivo único (o plugin põe escopo e hash); o daqui é igual.
  for (const f of Object.values(bundle)) if (f.fileName.endsWith('.css')) rmSync(join(outDir, f.fileName), { force: true })
  const chunks = Object.values(bundle).filter((f): f is Chunk => f.type === 'chunk')
  const byName = new Map(chunks.map((c) => [c.fileName, c]))
  const deps = (name: string, seen = new Set<string>()) => {
    for (const d of byName.get(name)?.imports ?? []) if (byName.has(d) && !seen.has(d)) seen.add(d), deps(d, seen)
    return seen
  }
  // O rolldown lista em dynamicImports chunks cujo import() o tree-shaking
  // tirou (o da própria lib, por exemplo); só conta o que está no código.
  const live = new Map<string, string[]>()
  for (const c of chunks) live.set(c.fileName, rewrite(join(outDir, c.fileName), c, byName, deps))
  const entry = chunks.find((c) => c.isEntry)!.fileName
  const used = new Set([entry])
  for (const name of used) for (const d of [...deps(name), ...live.get(name)!]) used.add(d)
  if (![...used].some((n) => live.get(n)!.length)) {
    rmSync(join(outDir, SPLIT), { recursive: true, force: true })
    return
  }
  // Chunk que nada alcança não é publicado.
  for (const c of chunks) if (!used.has(c.fileName)) rmSync(join(outDir, c.fileName), { force: true })
  // Cópias próprias do dedupe: o loader decide se baixa.
  const own: Split['own'] = {}
  for (const c of chunks) if (used.has(c.fileName) && c.facadeModuleId?.startsWith('\0vitral-own:'))
    own[c.facadeModuleId.slice('\0vitral-own:'.length)] = { file: c.fileName, chunks: [...deps(c.fileName)] }
  // O que a entrada usa logo: os imports dela e o import() do remote, que a
  // inicialização do dedupe faz assim que resolve as dependências.
  const soon = deps(entry)
  if (Object.keys(own).length) for (const d of live.get(entry)!) if (!Object.values(own).some((o) => o.file === d)) soon.add(d), deps(d, soon)
  soon.delete(entry)
  return { entry, chunks: [...soon], files: [...used], own }
}

/** Troca os `import()` de `c` pelo helper. Devolve os chunks importados assim. */
function rewrite(file: string, c: Chunk, byName: Map<string, Chunk>, deps: (name: string) => Set<string>): string[] {
  const targets = c.dynamicImports.filter((d) => byName.has(d))
  if (!targets.length) return []
  const dir = posix.dirname(c.fileName)
  const rel = (to: string) => {
    const r = posix.relative(dir, to)
    return r.startsWith('.') ? r : `./${r}`
  }
  const done = new Set<string>()
  const source = readFileSync(file, 'utf8')
  let rest = source
  let code = source.replace(/\bimport\(\s*(["'`])([^"'`]+)\1\s*\)/g, (all, _q, spec: string) => {
    const target = posix.join(dir, spec)
    if (!targets.includes(target)) return all
    done.add(target)
    rest = rest.replace(all, '')
    return `__vitralImport(${JSON.stringify(spec)},${JSON.stringify([...deps(target)].map(rel))})`
  })
  // Um import() que ficasse sem o helper rodaria sem conferência no caminho 2:
  // se o nome do chunk ainda aparece no código, o build para.
  const missing = targets.filter((t) => !done.has(t) && !c.imports.includes(t) && rest.includes(posix.basename(t)))
  if (missing.length) throw new Error(`vitral: não foi possível preparar o import() de ${missing.join(', ')} em ${c.fileName}`)
  if (!done.size) return []
  // No fim do arquivo (declarações de função sobem), antes do source map.
  const map = /\n\/\/# sourceMappingURL=[^\n]*\n?$/.exec(code)
  const at = map ? map.index : code.length
  code = `${code.slice(0, at)}\n${helper()}${code.slice(at)}`
  writeFileSync(file, code)
  return [...done]
}

/** Acrescenta `files`, `split` e `dedupe` ao manifesto. */
export function withSplit(m: RemoteManifest, outDir: string, s?: Split, groups: Group[] = []): RemoteManifest {
  const files: Record<string, string> = {}
  for (const f of [m.entry, ...(m.css ?? []), ...(s?.files ?? [])]) files[f] = sri(join(outDir, f))
  const dedupe = groups
    .filter((g) => s?.own[g.name])
    .map(({ name, range, version }) => ({ name, range, version, ...s!.own[name] }))
  return { ...m, files, ...(s && { split: { entry: s.entry, chunks: s.chunks } }), ...(dedupe.length && { dedupe }) }
}
