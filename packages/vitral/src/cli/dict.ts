import { execFileSync } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import * as zlib from 'node:zlib'
import { dictMatch, type DictIndex, type DictVariant } from '../dict'

export const INDEX = 'vitral-dict.json'
const TYPES: Record<string, string> = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css' }
// Cabeçalhos do RFC 9842: magic + SHA-256 do dicionário.
const DCZ_MAGIC = Buffer.from([0x5e, 0x2a, 0x4d, 0x18, 0x20, 0x00, 0x00, 0x00])
const DCB_MAGIC = Buffer.from([0xff, 0x44, 0x43, 0x42])

type Zstd = (input: Buffer, o: { dictionary?: Buffer; params?: Record<number, number> }) => Buffer

export interface DictCliOptions {
  /** Dist da versão nova (o que vai para o deploy). */
  dist: string
  /** Dists das versões anteriores, que os navegadores podem ter em cache. */
  from: string[]
  /** Comprime em brotli com dicionário (`.dcb`). Padrão: se o binário `brotli` existir. */
  brotli?: false | ((input: string, dictionary: string) => Buffer)
  /** Nível do zstd. Padrão: 19. */
  level?: number
  log?: (text: string) => void
}

/** Arquivos `.js`, `.mjs` e `.css` do dist, por caminho relativo com `/`. */
function files(dist: string): Map<string, string> {
  const out = new Map<string, string>()
  const walk = (dir: string) => {
    for (const name of readdirSync(dir).sort()) {
      const full = join(dir, name)
      if (statSync(full).isDirectory()) walk(full)
      else if (TYPES[ext(name)]) out.set(relative(dist, full).split(sep).join('/'), full)
    }
  }
  walk(dist)
  return out
}

const ext = (name: string) => name.slice(name.lastIndexOf('.'))

/** O zstd do Node, se ele aceita dicionário (22.19+ e 24.6+). */
export function nodeZstd(): Zstd | undefined {
  const z = (zlib as unknown as { zstdCompressSync?: Zstd }).zstdCompressSync
  if (!z) return undefined
  // Versões sem suporte ignoram o dicionário: com ele, dados aleatórios iguais ao dicionário viram poucos bytes.
  const sample = randomBytes(256)
  return z(sample, { dictionary: sample }).length < 64 ? z : undefined
}

/** O binário `brotli` (1.1+), se estiver no PATH. */
export function brotliBin(): ((input: string, dictionary: string) => Buffer) | undefined {
  try {
    execFileSync('brotli', ['--version'], { stdio: 'ignore' })
  } catch {
    return undefined
  }
  return (input, dictionary) => execFileSync('brotli', ['-q', '11', '-c', '-D', dictionary, input], { maxBuffer: 1 << 30 })
}

const kb = (n: number) => (n / 1024).toFixed(1).padStart(7) + ' kB'

/**
 * `npx vitral dict`: pré-comprime cada arquivo do dist com a versão anterior
 * dele como dicionário e grava o índice `vitral-dict.json` para `vitral/dict`.
 */
export function dict(o: DictCliOptions): DictIndex {
  const log = o.log ?? console.log
  const zstd = nodeZstd()
  if (!zstd) throw new Error(`[vitral] dict precisa do zstd com dicionário do Node (22.19+ ou 24.6+). Este é ${process.version}.`)
  const brotli = o.brotli === false ? undefined : (o.brotli ?? brotliBin())
  const level = o.level ?? 19
  if (!existsSync(o.dist)) throw new Error(`[vitral] ${o.dist} não existe`)

  const novos = files(o.dist)
  // Arquivos antigos pelo padrão de match: remote-*.js -> [caminhos].
  const antigos = new Map<string, string[]>()
  for (const from of o.from) {
    if (!existsSync(from)) throw new Error(`[vitral] ${from} não existe`)
    for (const [rel, full] of files(from)) {
      const key = dictMatch('/' + rel)
      antigos.set(key, [...(antigos.get(key) ?? []), full])
    }
  }

  const index: DictIndex = { version: 1, files: {} }
  const linhas: string[] = []
  for (const [rel, full] of novos) {
    const deltas: Record<string, DictVariant> = {}
    index.files[rel] = { type: TYPES[ext(rel)], deltas }
    const input = readFileSync(full)
    const vistos = new Set<string>()
    for (const old of antigos.get(dictMatch('/' + rel)) ?? []) {
      const dictionary = readFileSync(old)
      const sha = createHash('sha256').update(dictionary).digest()
      const hash = `:${sha.toString('base64')}:`
      // Mesmo conteúdo: mesmo nome, o navegador usa o cache.
      if (vistos.has(hash) || dictionary.equals(input)) continue
      vistos.add(hash)
      const id = sha.toString('hex').slice(0, 12)
      const variant: DictVariant = {}
      const dcz = Buffer.concat([DCZ_MAGIC, sha, zstd(input, { dictionary, params: { [zlib.constants.ZSTD_c_compressionLevel]: level } })])
      writeFileSync(join(o.dist, `${rel}.${id}.dcz`), dcz)
      variant.dcz = `${rel}.${id}.dcz`
      let dcb: Buffer | undefined
      if (brotli) {
        dcb = Buffer.concat([DCB_MAGIC, sha, brotli(full, old)])
        writeFileSync(join(o.dist, `${rel}.${id}.dcb`), dcb)
        variant.dcb = `${rel}.${id}.dcb`
      }
      deltas[hash] = variant
      const br = zlib.brotliCompressSync(input, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } }).length
      linhas.push(`${rel}  br ${kb(br)}  dcz ${kb(dcz.length)}${dcb ? `  dcb ${kb(dcb.length)}` : ''}  (de ${relative(process.cwd(), old) || old})`)
    }
  }
  writeFileSync(join(o.dist, INDEX), JSON.stringify(index, null, 2) + '\n')
  const n = Object.values(index.files).reduce((s, f) => s + Object.keys(f.deltas).length, 0)
  for (const l of linhas) log(l)
  log(`[vitral] ${Object.keys(index.files).length} arquivos, ${n} deltas${brotli ? '' : ' (só .dcz: falta o binário brotli para .dcb)'}. Índice: ${join(o.dist, INDEX)}`)
  return index
}
