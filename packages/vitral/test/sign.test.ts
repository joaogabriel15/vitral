import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { signCli } from '../src/cli/sign'
import { hintsOf } from '../src/core/next-hints'
import { keygen, publicKeyOf, signBody, signDir, verifyBody } from '../src/sign'

const body = new TextEncoder().encode('export const a = 1')

describe('assinatura Ed25519', () => {
  it('assina no formato que o Chrome confere e confere de volta', () => {
    const k = keygen()
    const h = signBody(body, k.privateKey)
    expect(h['Unencoded-Digest']).toMatch(/^sha-256=:[A-Za-z0-9+/]+=*:$/)
    expect(h['Signature-Input']).toBe(`signature=("unencoded-digest";sf);keyid="${k.publicKey}";tag="sri"`)
    expect(h.Signature).toMatch(/^signature=:[A-Za-z0-9+/]+=*:$/)
    expect(publicKeyOf(k.privateKey)).toBe(k.publicKey)
    expect(Buffer.from(k.publicKey, 'base64')).toHaveLength(32)
    expect(verifyBody(body, h, [k.publicKey])).toBe(true)
    expect(verifyBody(body, new Headers(h), ['ed25519-' + k.publicKey])).toBe(true)
  })

  it('recusa conteúdo trocado, outra chave e resposta sem assinatura', () => {
    const k = keygen()
    const h = signBody(body, k.privateKey)
    expect(verifyBody(new TextEncoder().encode('export const a = 2'), h, [k.publicKey])).toBe(false)
    expect(verifyBody(body, h, [keygen().publicKey])).toBe(false)
    expect(verifyBody(body, {}, [k.publicKey])).toBe(false)
    // Digest certo, assinatura de outra chave com o keyid desta.
    const forged = { ...h, Signature: signBody(body, keygen().privateKey).Signature }
    expect(verifyBody(body, forged, [k.publicKey])).toBe(false)
  })

  it('signDir assina manifesto, JS e CSS, com o caminho público, e mantém o resto do _headers', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vitral-sign-'))
    mkdirSync(join(dir, 'split'))
    writeFileSync(join(dir, 'vitral.json'), '{"entry":"remote-a.js"}')
    writeFileSync(join(dir, 'remote-a.js'), 'export{}')
    writeFileSync(join(dir, 'split/x-b.js'), 'export{}')
    writeFileSync(join(dir, 'remote.css'), 'a{}')
    writeFileSync(join(dir, 'logo.svg'), '<svg/>')
    writeFileSync(join(dir, '_headers'), '/*\n  X-Frame-Options: DENY\n')
    const k = keygen()
    const out = signDir(dir, k.privateKey, { base: '/carrinho' })
    expect(Object.keys(out).sort()).toEqual(['/carrinho/remote-a.js', '/carrinho/remote.css', '/carrinho/split/x-b.js', '/carrinho/vitral.json'])
    expect(verifyBody(readFileSync(join(dir, 'split/x-b.js')), out['/carrinho/split/x-b.js'], [k.publicKey])).toBe(true)
    expect(JSON.parse(readFileSync(join(dir, 'vitral-signatures.json'), 'utf8'))).toEqual(out)
    const headers = readFileSync(join(dir, '_headers'), 'utf8')
    expect(headers).toContain('X-Frame-Options: DENY')
    expect(headers).toContain('/carrinho/vitral.json\n  Unencoded-Digest: sha-256=:')
    // De novo: o bloco é trocado, não repetido.
    signDir(dir, k.privateKey, { base: '/carrinho' })
    const again = readFileSync(join(dir, '_headers'), 'utf8')
    expect(again.match(/# vitral sign\n/g)).toHaveLength(1)
    expect(again).toContain('X-Frame-Options: DENY')
  })

  it('vitral sign --keygen mostra as duas chaves; sem chave, explica', () => {
    const lines: string[] = []
    signCli(undefined, { keygen: true }, (s) => lines.push(s))
    expect(lines.join('\n')).toMatch(/Chave pública[\s\S]*BEGIN PRIVATE KEY/)
    const env = process.env.VITRAL_SIGNING_KEY
    delete process.env.VITRAL_SIGNING_KEY
    expect(() => signCli('dist', {})).toThrow(/chave privada/)
    process.env.VITRAL_SIGNING_KEY = env
  })

  it('hintsOf leva as assinaturas para o preload, igual ao loader', () => {
    const m = { name: 'x', entry: 'remote.js', files: { 'remote.js': 'sha384-A', 'remote.css': 'sha384-B' }, css: ['remote.css'] }
    const h = hintsOf(m as never, '/x/vitral.json', {}, undefined, ['K1', 'ed25519-K2'])
    expect(h.js[0][1]).toBe('sha384-A ed25519-K1 ed25519-K2')
    expect(h.css[0][1]).toBe('sha384-B ed25519-K1 ed25519-K2')
    expect(h.signed).toBe('ed25519-K1 ed25519-K2')
  })
})
