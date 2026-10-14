// Contexto compartilhado: host React (dono de usuário e carrinho) e remotes
// Vue, Svelte e Angular, cada um com a própria cópia da lib.
import { expect, test, type Page } from '@playwright/test'

const REMOTES = ['vue', 'svelte', 'angular']

/** Textos de `seletor` no host e em cada remote, atravessando shadow roots. */
function textos(page: Page, seletor: string) {
  return page.evaluate(
    ([seletor, remotes]) => {
      const deep = (root: ParentNode): Element | null => {
        const found = root.querySelector(seletor)
        if (found) return found
        for (const el of root.querySelectorAll('*')) {
          const inner = el.shadowRoot && deep(el.shadowRoot)
          if (inner) return inner
        }
        return null
      }
      return (remotes as string[]).map((n) => deep(document.querySelector(`[data-remote="${n}"]`)!)?.textContent)
    },
    [seletor, REMOTES] as const,
  )
}

const assinaturas = (page: Page) =>
  page.evaluate(() => (globalThis as any)[Symbol.for('vitral')].shared().list().reduce((n: number, e: any) => n + e.subscribers, 0))

test.describe('contexto compartilhado (host React)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4202')
    for (const n of REMOTES) await expect(page.locator(`[data-remote="${n}"] .usuario`), n).toHaveText('Ana')
  })

  test('troca de usuário aparece no host e em todos os remotes no mesmo frame', async ({ page }) => {
    const noFrame = await page.evaluate(
      (remotes) =>
        new Promise<(string | null | undefined)[]>((resolve) => {
          const deep = (root: ParentNode): Element | null =>
            root.querySelector('.usuario') ?? [...root.querySelectorAll('*')].map((el) => el.shadowRoot && deep(el.shadowRoot)).find(Boolean) ?? null
          document.querySelector<HTMLButtonElement>('#trocar-usuario')!.click()
          // Lido antes da pintura do próximo frame.
          requestAnimationFrame(() =>
            resolve([document.querySelector('#usuario')!.textContent, ...remotes.map((n) => deep(document.querySelector(`[data-remote="${n}"]`)!)?.textContent)]),
          )
        }),
      REMOTES,
    )
    expect(noFrame).toEqual(['Bia', 'Bia', 'Bia', 'Bia'])
  })

  test('remotes compram pela ação do dono; escrita direta é bloqueada', async ({ page }) => {
    const avisos: string[] = []
    page.on('console', (m) => m.type() === 'warning' && avisos.push(m.text()))
    for (const n of REMOTES) await page.locator(`[data-remote="${n}"] .comprar`).click()
    await expect(page.locator('#carrinho')).toHaveText('3')
    expect(await textos(page, '.carrinho')).toEqual(['3', '3', '3'])

    await page.locator('[data-remote="svelte"] .forcar').click()
    await expect.poll(() => avisos.some((a) => a.includes('SHARED_READONLY'))).toBe(true)
    await expect(page.locator('#carrinho')).toHaveText('3')
    expect(await textos(page, '.carrinho')).toEqual(['3', '3', '3'])
  })

  test('nenhuma assinatura sobra depois do unmount', async ({ page }) => {
    const comRemotes = await assinaturas(page)
    // O host assina usuário e carrinho; cada remote assina os dois também.
    expect(comRemotes).toBe(2 + REMOTES.length * 2)
    for (let i = 0; i < 3; i++) {
      await page.locator('#alternar-remotes').click()
      await expect.poll(() => assinaturas(page)).toBe(2)
      await page.locator('#alternar-remotes').click()
      for (const n of REMOTES) await expect(page.locator(`[data-remote="${n}"] .usuario`), n).toHaveText('Ana')
      await expect.poll(() => assinaturas(page)).toBe(comRemotes)
    }
  })
})
