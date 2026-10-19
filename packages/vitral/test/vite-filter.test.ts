import type { Plugin } from 'vite'
import { describe, expect, it } from 'vitest'
import vitral from '../src/vite'

type Pattern = RegExp | RegExp[] | { include?: RegExp | RegExp[]; exclude?: RegExp | RegExp[] }

// Mesma regra do Vite e do Rolldown para `filter.id` com RegExp: barras normalizadas, exclude vence.
function matches(pattern: Pattern, id: string): boolean {
  const { include, exclude } = pattern instanceof RegExp || Array.isArray(pattern) ? { include: pattern, exclude: undefined } : pattern
  const list = (p?: RegExp | RegExp[]) => (p ? [p].flat() : [])
  const norm = id.replace(/\\/g, '/')
  if (list(exclude).some((re) => re.test(norm))) return false
  return list(include).some((re) => re.test(norm))
}

const filterOf = (plugin: Plugin, hook: 'resolveId' | 'load' | 'transform') => {
  const h = plugin[hook] as { filter?: { id?: Pattern }; handler?: unknown }
  expect(typeof h.handler).toBe('function')
  expect(h.filter?.id).toBeDefined()
  return (id: string) => matches(h.filter!.id!, id)
}

const unrelated = ['/app/node_modules/x/index.js', '/app/src/App.tsx', 'react', '/app/src/style.css']

describe('filtros de hook do plugin', () => {
  const plugin = vitral({ entry: 'src/App.tsx', dedupe: ['react', 'vue'], exposes: { './Mini': 'src/Mini.tsx' } })

  it('resolveId aceita os ids do vitral e ignora o resto', () => {
    const ok = filterOf(plugin, 'resolveId')
    for (const id of [
      '__vitral_entry__.js',
      '/app/__vitral_entry__.js',
      '__vitral_exposes__.js',
      'C:\\app\\__vitral_exposes__.js',
      '/app/@vitral/entry.js',
      'virtual:vitral-react-preamble',
      'virtual:vitral-boot',
      '/app/virtual:vitral-boot',
      '\0vitral-deps',
      '\0vitral-own:react',
      '\0vitral-shim:react-dom/client',
      'react-dom/client',
      'react/jsx-runtime',
      'vue',
    ])
      expect(ok(id), id).toBe(true)
    for (const id of ['/app/node_modules/x.js', './App.tsx', 'react-router', 'vue-router', 'my__vitral_exposes__.js', '/app/src/style.css'])
      expect(ok(id), id).toBe(false)
  })

  it('resolveId sem dedupe nem exposes não aceita esses ids', () => {
    const ok = filterOf(vitral({ entry: 'src/App.tsx' }), 'resolveId')
    expect(ok('__vitral_entry__.js')).toBe(true)
    for (const id of ['react', 'virtual:vitral-boot', '\0vitral-shim:react', '__vitral_exposes__.js']) expect(ok(id), id).toBe(false)
  })

  it('load só aceita os módulos virtuais do vitral', () => {
    const ok = filterOf(plugin, 'load')
    for (const id of [
      '\0vitral:entry',
      '\0vitral:dev-entry',
      '\0vitral-exposes',
      '\0virtual:vitral-boot',
      '\0vitral-deps',
      '\0vitral-own:react',
      '\0vitral-shim:react',
      '\0virtual:vitral-react-preamble',
    ])
      expect(ok(id), id).toBe(true)
    for (const id of [...unrelated, '\0vite/preload-helper.js', 'vitral:entry']) expect(ok(id), id).toBe(false)
  })

  it('transform só aceita CSS, sem ?raw/?url/?inline', () => {
    const ok = filterOf(plugin, 'transform')
    for (const id of ['/app/src/style.css', '/app/src/a.scss?direct', 'C:\\app\\b.less']) expect(ok(id), id).toBe(true)
    for (const id of ['/app/node_modules/x.js', '/app/src/App.tsx', '/app/src/style.css?raw', '/app/src/style.css?url', '/app/src/a.css?inline'])
      expect(ok(id), id).toBe(false)
  })
})
