// @vitest-environment happy-dom
// O helper que o plugin põe no build dividido para os import() do remote.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { helper } from '../src/vite/manifest'
import { protocol, resetProtocol } from '../src/core/state'

const BASE = 'https://cdn.empresa.com/grafico/split/remote.js'
const LAZY = 'https://cdn.empresa.com/grafico/split/lazy.js'
const DEP = 'https://cdn.empresa.com/grafico/split/comum.js'

/** O helper com `import()` e `import.meta.url` trocados por valores de teste. */
function make() {
  const load = vi.fn(async (url: string) => ({ url }))
  const fn = new Function('load', `${helper('load', JSON.stringify(BASE))}; return __vitralImport`)(load)
  return { load, run: (u: string, d: string[]) => fn(u, d) as Promise<unknown> }
}

/** Dispara load (ou error) nos modulepreload que entrarem. */
function answer(ok: (href: string) => boolean) {
  const seen: { href: string; integrity: string }[] = []
  const obs = new MutationObserver((list) => {
    for (const r of list)
      for (const n of r.addedNodes) {
        const l = n as HTMLLinkElement
        if (l.rel !== 'modulepreload') continue
        seen.push({ href: l.href, integrity: l.integrity })
        setTimeout(() => l.dispatchEvent(new Event(ok(l.href) ? 'load' : 'error')))
      }
  })
  obs.observe(document.head, { childList: true })
  return { seen, stop: () => obs.disconnect() }
}

afterEach(() => {
  resetProtocol()
  document.head.replaceChildren()
})

describe('helper de import() do build dividido', () => {
  it('sem hashes no protocolo (caminho 1 ou sem SRI), é um import() comum', async () => {
    const { load, run } = make()
    expect(await run('./lazy.js', ['./comum.js'])).toEqual({ url: LAZY })
    expect(load).toHaveBeenCalledWith(LAZY)
    expect(document.head.querySelector('link')).toBeNull()
  })

  it('no caminho 2, pré-carrega dependências e arquivo com integrity antes do import()', async () => {
    protocol().sri = { [LAZY]: 'sha384-lazy', [DEP]: 'sha384-dep' }
    const { seen, stop } = answer(() => true)
    const { load, run } = make()
    const p = run('./lazy.js', ['./comum.js'])
    expect(load).not.toHaveBeenCalled()
    await p
    stop()
    expect(seen).toEqual([
      { href: DEP, integrity: 'sha384-dep' },
      { href: LAZY, integrity: 'sha384-lazy' },
    ])
    expect(load).toHaveBeenCalledWith(LAZY)
  })

  it('arquivo sem hash ou com hash que não confere não chega no import()', async () => {
    protocol().sri = { [DEP]: 'sha384-dep' }
    const { load, run } = make()
    await expect(run('./lazy.js', ['./comum.js'])).rejects.toThrow(/sem integrity: .*lazy\.js/)

    protocol().sri = { [LAZY]: 'sha384-lazy', [DEP]: 'sha384-dep' }
    const { stop } = answer((href) => href !== LAZY)
    await expect(run('./lazy.js', ['./comum.js'])).rejects.toThrow(/não confere: .*lazy\.js/)
    stop()
    expect(load).not.toHaveBeenCalled()
  })
})
