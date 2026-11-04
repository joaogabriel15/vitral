/**
 * Assinatura dos arquivos do remote (SRI por assinatura, Chrome 141+).
 *
 * O host fixa a chave pública do remote em `configure({ remotes: { x: { url,
 * keys } } })`. O servidor do remote manda, em cada arquivo, os headers
 * `Unencoded-Digest`, `Signature-Input` e `Signature` (RFC 9421 com Ed25519).
 * Um arquivo trocado no CDN sem a chave privada não roda, mesmo que o
 * `vitral.json` trocado traga os hashes novos.
 *
 * A assinatura cobre só o hash do conteúdo, então dá para gerar os headers no
 * build (`vitral sign dist`) e servir como arquivo estático (`_headers` do
 * Netlify e do Cloudflare Pages, ou `vitral-signatures.json` para outro servidor).
 */
import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify, type KeyObject } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, posix, relative, sep } from 'node:path'

export type SignatureHeaders = { 'Unencoded-Digest': string; 'Signature-Input': string; Signature: string }

/** Chave pública em base64 (os 32 bytes da chave), o formato de `keys` e do `keyid`. */
export function publicKeyOf(key: KeyObject | string): string {
  const k = typeof key === 'string' ? createPublicKey(key) : key.type === 'private' ? createPublicKey(key) : key
  return Buffer.from(k.export({ format: 'jwk' }).x as string, 'base64url').toString('base64')
}

/** Novo par de chaves: a privada em PEM (guarde como segredo do CI), a pública para o host. */
export function keygen(): { privateKey: string; publicKey: string } {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519')
  return { privateKey: privateKey.export({ format: 'pem', type: 'pkcs8' }) as string, publicKey: publicKeyOf(publicKey) }
}

const digestOf = (body: Uint8Array): string => `sha-256=:${createHash('sha256').update(body).digest('base64')}:`
const paramsOf = (keyid: string): string => `("unencoded-digest";sf);keyid="${keyid}";tag="sri"`
const baseOf = (digest: string, params: string): Buffer => Buffer.from(`"unencoded-digest";sf: ${digest}\n"@signature-params": ${params}`)

/** Headers de assinatura de um arquivo. */
export function signBody(body: Uint8Array, privateKey: KeyObject | string): SignatureHeaders {
  const key = typeof privateKey === 'string' ? createPrivateKey(privateKey) : privateKey
  const digest = digestOf(body)
  const params = paramsOf(publicKeyOf(key))
  return { 'Unencoded-Digest': digest, 'Signature-Input': `signature=${params}`, Signature: `signature=:${sign(null, baseOf(digest, params), key).toString('base64')}:` }
}

/**
 * Confere, no servidor, a assinatura de uma resposta: o hash de `body` bate
 * com o `Unencoded-Digest`, e a assinatura é de uma das `keys`.
 */
export function verifyBody(body: Uint8Array, headers: Headers | Record<string, string | undefined>, keys: string[]): boolean {
  const get = (h: string) => (headers instanceof Headers ? headers.get(h) : (headers[h] ?? headers[h.toLowerCase()])) ?? ''
  const digest = get('Unencoded-Digest')
  if (digest !== digestOf(body)) return false
  const input = /(?:^|,)\s*([\w-]+)=(\("unencoded-digest";sf\);keyid="([^"]+)";tag="sri")/.exec(get('Signature-Input'))
  if (!input) return false
  const [, label, params, keyid] = input
  const sig = new RegExp(`(?:^|,)\\s*${label}=:([^:]+):`).exec(get('Signature'))?.[1]
  const want = keys.map((k) => k.replace(/^ed25519-/, ''))
  if (!sig || !want.includes(keyid)) return false
  const pub = createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x: Buffer.from(keyid, 'base64').toString('base64url') }, format: 'jwk' })
  return verify(null, baseOf(digest, params), pub, Buffer.from(sig, 'base64'))
}

export interface SignDirOptions {
  /** Caminho público da pasta no servidor (ex.: `/carrinho/`). Padrão: `/`. */
  base?: string
  /** Grava `_headers` (Netlify, Cloudflare Pages). Padrão: true. */
  headersFile?: boolean
}

const BEGIN = '# vitral sign'
const END = '# /vitral sign'

/** Arquivos que o host baixa: o manifesto, JS e CSS. */
const SIGNED = /(^|\/)vitral\.json$|\.(m?js|css)$/

/**
 * Assina os arquivos de `dir` e grava `vitral-signatures.json` (caminho
 * público → headers) e `_headers`. Rode depois do build e de `vitral dict`:
 * qualquer mudança num arquivo depois disso invalida a assinatura.
 */
export function signDir(dir: string, privateKey: string, o: SignDirOptions = {}): Record<string, SignatureHeaders> {
  const key = createPrivateKey(privateKey)
  const base = ('/' + (o.base ?? '/').replace(/^\/+|\/+$/g, '') + '/').replace(/^\/\/$/, '/')
  const out: Record<string, SignatureHeaders> = {}
  const walk = (d: string): void => {
    for (const f of readdirSync(d).sort()) {
      const p = join(d, f)
      if (statSync(p).isDirectory()) walk(p)
      else {
        const rel = relative(dir, p).split(sep).join(posix.sep)
        if (SIGNED.test(rel)) out[base + rel] = signBody(readFileSync(p), key)
      }
    }
  }
  walk(dir)
  writeFileSync(join(dir, 'vitral-signatures.json'), JSON.stringify(out, null, 2) + '\n')
  if (o.headersFile !== false) {
    // O bloco da assinatura troca o anterior; o resto do `_headers` fica.
    const file = join(dir, '_headers')
    const block = [BEGIN, ...Object.entries(out).flatMap(([path, h]) => [path, ...Object.entries(h).map(([k, v]) => `  ${k}: ${v}`)]), END].join('\n')
    const old = existsSync(file) ? readFileSync(file, 'utf8').replace(new RegExp(`\\n?${BEGIN}[\\s\\S]*?${END}\\n?`), '\n').trim() : ''
    writeFileSync(file, (old ? old + '\n\n' : '') + block + '\n')
  }
  return out
}
