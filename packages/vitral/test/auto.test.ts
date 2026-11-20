// @vitest-environment happy-dom
// Uso sem build: `data-origins` no script do auto.js diz de onde os `src` podem vir.
import { afterEach, expect, it } from 'vitest'
import { checkOrigin, registerSrc } from '../src/core/registry'
import { cleanup } from './helpers'

afterEach(() => {
  cleanup()
  ;(window as any).happyDOM.setURL('http://localhost:3000/')
})

it('as origens de data-origins valem para o src em atributo', async () => {
  ;(window as any).happyDOM.setURL('https://loja.com/')
  const script = document.createElement('script')
  // Tipo que o happy-dom não tenta executar.
  script.type = 'text/plain'
  document.head.append(script)
  script.src = import.meta.url.replace(/test\/auto\.test\.ts$/, 'src/auto.ts')
  script.dataset.origins = 'https://cdn.loja.com https://parceiro.com/x/'
  await import('../src/auto')
  for (const ok of ['https://cdn.loja.com/c/vitral.json', 'https://parceiro.com/w/vitral.json']) {
    const key = registerSrc(ok, undefined, false)
    expect(() => checkOrigin(key, key)).not.toThrow()
  }
  const evil = registerSrc('https://injetado.com/c/vitral.json', undefined, false)
  expect(() => checkOrigin(evil, evil)).toThrow(/allowedOrigins/)
  expect(customElements.get('vitral-remote')).toBeTruthy()
})
