// Versões cruzadas: host e remote com versões diferentes da lib na mesma página.
// Cada remote é buildado com o plugin e a lib da sua versão (versoes/build.mjs),
// e o host carrega a cópia da sua versão (?lib=).
//
// O contrato (mount, ctx.events, manifesto, CSS com escopo) vale entre quaisquer
// versões. O protocolo em Symbol.for('vitral') existe da 0.2 em diante: os testes
// dele rodam para cada par de versões que o fala (a 0.1.0 publicada não fala).
//
// Casos que entram com outras fases:
// - Fase 2: shared() e provide() entre host e remote de versões diferentes
//   (mesmo valor, set do dono, writable: false).
// - Fase 4: manifesto v2 (chunks e dedupe) lido por host da v1, que usa o
//   arquivo único; dedupe entre versões.
// - Fase 5: exposes e loadModule() com host de versão anterior.
import { cdn, expect, test } from './fixtures/cenario'
import { rotulo, temProtocolo, VERSOES } from './versoes/libs.mjs'

const versoes = Object.keys(VERSOES)
const AZUL = 'rgb(0, 0, 255)'
const evaluate = <T>(page: import('@playwright/test').Page, fn: () => T) => page.evaluate(fn)

for (const hostV of versoes) {
  for (const remoteV of versoes) {
    test.describe(`host ${rotulo(hostV)} com remote ${rotulo(remoteV)}`, () => {
      test.use({ lib: hostV })

      for (const isolate of ['none', 'shadow'] as const) {
        test(`JS e React: monta, atualiza props, eventos pelo ctx, CSS e desmontagem (isolate ${isolate})`, async ({ host }) => {
          const { page } = host
          await host.configure({ remotes: { js: cdn(`v-${remoteV}-js`), react: cdn(`v-${remoteV}-react`) } })
          for (const name of ['js', 'react']) {
            await host.montar(name, { props: { texto: 'um' }, isolate })
            await host.pronto(name)
            const remote = host.slot(name).locator('.remote')
            await expect(remote.locator('.texto')).toHaveText('um')
            // CSS do manifesto, com o escopo do plugin daquela versão.
            await expect(remote).toHaveCSS('color', AZUL)
          }

          // Eventos pelo ctx, nos dois sentidos.
          await host.slot('react').locator('.emitir').click()
          expect(await evaluate(page, () => (window as any).vitral.events.last('remote:diz'))).toBe('react')
          await host.slot('js').locator('.emitir').click()
          expect(await evaluate(page, () => (window as any).vitral.events.last('remote:diz'))).toBe('js')
          await evaluate(page, () => (window as any).vitral.events.emit('host:diz', 'oi'))
          for (const name of ['js', 'react']) await expect(host.slot(name).locator('.recebido')).toHaveText('oi')

          // Props novas sem remontar: o estado do React continua.
          await evaluate(page, () => (window as any).slots.forEach((s: any) => s.update({ texto: 'dois' })))
          for (const name of ['js', 'react']) await expect(host.slot(name).locator('.texto')).toHaveText('dois')
          await expect(host.slot('react').locator('.cliques')).toHaveText('1')

          // Desmontar limpa o DOM e as assinaturas feitas pelo ctx.
          const recebidos = await evaluate(page, () => (window as any).__recebidos)
          await evaluate(page, () => (window as any).slots.forEach((s: any) => s.destroy()))
          for (const name of ['js', 'react']) await expect(host.slot(name).locator('.remote')).toHaveCount(0)
          await evaluate(page, () => (window as any).vitral.events.emit('host:diz', 'depois'))
          expect(await evaluate(page, () => (window as any).__recebidos)).toBe(recebidos)
        })
      }

      if (temProtocolo(hostV) && temProtocolo(remoteV)) {
        test('protocolo v1: a cópia da lib no remote vê os eventos e os remotes do host', async ({ host }) => {
          await host.configure({ remotes: { js: cdn(`v-${remoteV}-js`), filho: cdn('cartao') } })
          await host.montar('js', { props: { texto: 'pai' } })
          await host.pronto('js')
          const remote = host.slot('js')

          await remote.locator('.emitir-direto').click()
          expect(await evaluate(host.page, () => (window as any).vitral.events.last('remote:direto'))).toBe('js')

          // O remote monta outro remote pelo nome que só o host registrou.
          await remote.locator('.aninhar').click()
          await expect(remote.locator('.aninhado-status')).toHaveText('ready')
          await expect(remote.locator('.aninhado .cartao')).toHaveText('filho: aninhado')
        })
      }
    })
  }
}

test.describe('protocolo de uma versão futura', () => {
  test('a lib atual usa o objeto de um protocolo maior já instalado, sem trocá-lo', async ({ host }) => {
    const { page } = host
    await host.configure({ remotes: { js: cdn('v-atual-js'), filho: cdn('cartao') } })
    // Uma versão futura instalou o protocolo 2, com os métodos da 1 e um novo.
    await page.evaluate(() => {
      const key = Symbol.for('vitral')
      const g = globalThis as any
      g[key] = { ...g[key], protocol: 2, futuro: () => 'ok' }
    })
    await host.montar('js', { props: { texto: 'pai' } })
    await host.pronto('js')
    await host.slot('js').locator('.aninhar').click()
    await expect(host.slot('js').locator('.aninhado .cartao')).toHaveText('filho: aninhado')
    // Uma cópia nova da lib (outra URL) também usa o mesmo objeto.
    const visto = await page.evaluate(async () => {
      const copia = await import('/libs/copia/index.js' as string)
      copia.events.emit('da-copia', 1)
      const g = globalThis as any
      return { protocolo: g[Symbol.for('vitral')].protocol, futuro: g[Symbol.for('vitral')].futuro(), evento: g.vitral.events.last('da-copia') }
    })
    expect(visto).toEqual({ protocolo: 2, futuro: 'ok', evento: 1 })
  })
})
