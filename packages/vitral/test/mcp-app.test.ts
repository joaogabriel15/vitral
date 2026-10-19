// target: 'mcp-app': o build gera um HTML único, sem arquivo externo.
// O comportamento da ponte no navegador está em e2e/mcp-app.spec.ts.
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { build } from 'vite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import vitral from '../src/vite'

const outDir = mkdtempSync(join(tmpdir(), 'vitral-mcp-'))
let html = ''

beforeAll(async () => {
  await build({
    root: resolve(__dirname, 'fixtures', 'mcp-app'),
    configFile: false,
    logLevel: 'silent',
    plugins: [vitral({ adapter: false, target: 'mcp-app' })],
    build: { outDir, emptyOutDir: true },
  })
  html = readFileSync(join(outDir, 'mcp-app.html'), 'utf8')
}, 60_000)

afterAll(() => rmSync(outDir, { recursive: true, force: true }))

describe("target: 'mcp-app'", () => {
  it('gera só mcp-app.html, sem vitral.json nem JS ou CSS soltos', () => {
    expect(readdirSync(outDir)).toEqual(['mcp-app.html'])
  })

  it('o HTML não busca nada de fora: JS e CSS inline', () => {
    expect(html).toMatch(/^<!doctype html>/)
    expect(html).not.toMatch(/<script[^>]+src=|<link\b|import\(/)
    // CSS escopado como no build normal, e a raiz do remote com o mesmo escopo.
    expect(html).toContain('<style>[data-vitral-scope="-empresa-clima"] .clima{color:green}')
    expect(html).toContain('"scope":"-empresa-clima"')
    // O import() dinâmico do remote foi para o mesmo arquivo.
    expect(html).toContain('Clima <\\/script> agora')
  })

  it('nenhum texto do remote fecha a tag antes da hora', () => {
    const scripts = html.match(/<script>/g)!.length
    expect(html.match(/<\/script>/g)!.length).toBe(scripts)
    expect(html.match(/<\/style>/g)!.length).toBe(html.match(/<style>/g)!.length)
  })

  it('a ponte se apresenta com nome e versão do package.json', () => {
    expect(html).toContain("'ui/initialize'")
    expect(html).toContain("protocolVersion: '2026-01-26'")
    expect(html).toContain('{"name":"@empresa/clima","version":"2.0.1","scope":"-empresa-clima"}')
  })

  it('recusa opções que dependem de mais de um arquivo', () => {
    expect(() => vitral({ target: 'mcp-app', exposes: { './a': 'src/a.js' } })).toThrow(/não combina/)
    expect(() => vitral({ target: 'mcp-app', dedupe: ['react'] })).toThrow(/não combina/)
  })
})
