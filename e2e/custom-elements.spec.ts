// Registro de custom elements por remote (ctx.customElements) no Shadow DOM.
// Com Scoped Custom Element Registries (Chrome 146+, Safari 26+), cada remote
// tem o seu <ds-button>; sem, os dois dividem o global e o segundo recebe um
// aviso em dev. O teste confere o caminho que o navegador da bateria tem.
import { cdn, expect, test } from './fixtures/cenario'

test('dois remotes no Shadow DOM definem <ds-button> de versões diferentes sem quebrar', async ({ host }) => {
  const avisos: string[] = []
  host.page.on('console', (m) => m.type() === 'warning' && avisos.push(m.text()))
  // A lib servida sem bundler está em produção; o aviso só sai em dev.
  await host.page.evaluate(() => ((window as any).process = { env: { NODE_ENV: 'development' } }))
  await host.configure({ remotes: { v1: cdn('botao-v1'), v2: cdn('botao-v2') } })
  await host.montar('v1', { isolate: 'shadow' })
  await host.pronto('v1')
  await host.montar('v2', { isolate: 'shadow' })
  await host.pronto('v2')

  const scoped = await host.page.evaluate(() => 'initialize' in CustomElementRegistry.prototype)
  test.info().annotations.push({ type: 'scoped registries', description: String(scoped) })
  await expect(host.slot('v1').locator('ds-button')).toHaveText('ds-button v1')
  if (scoped) {
    await expect(host.slot('v2').locator('ds-button')).toHaveText('ds-button v2')
    expect(await host.page.evaluate(() => customElements.get('ds-button'))).toBeUndefined()
    expect(avisos.filter((a) => a.includes('ds-button'))).toEqual([])
  } else {
    // Fica a primeira definição, e o segundo remote monta mesmo assim.
    await expect(host.slot('v2').locator('ds-button')).toHaveText('ds-button v1')
    expect(avisos.filter((a) => a.includes('v2: <ds-button> já foi definido por v1'))).toHaveLength(1)
  }
  await host.continuaFuncionando()
})
