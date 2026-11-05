import { test } from '@playwright/test'

// Temporário: descobre quando o WebKit reaproveita um preload as=fetch.
test('sonda: preload as=fetch reaproveitado pelo fetch', async ({ page }) => {
  await page.goto('http://localhost:4211/ns-login')
  const out = await page.evaluate(async () => {
    const res: Record<string, string[]> = {}
    const variants: Record<string, RequestInit> = {
      padrao: {},
      cors: { mode: 'cors', credentials: 'same-origin' },
      omit: { credentials: 'omit' },
      sinal: { credentials: 'same-origin', signal: new AbortController().signal },
      noCache: { credentials: 'same-origin', cache: 'no-cache' },
      integrity: { credentials: 'same-origin', integrity: '' },
    }
    for (const [k, init] of Object.entries(variants)) {
      for (const co of ['anonymous', 'use-credentials', null]) {
        const url = `/ns-remote/vitral.json?sonda=${k}-${co}`
        const l = document.createElement('link')
        l.rel = 'preload'; l.as = 'fetch'; l.href = url
        if (co) l.crossOrigin = co
        await new Promise((r) => { l.onload = l.onerror = r; document.head.appendChild(l) })
        await (await fetch(url, init)).text()
        await new Promise((r) => setTimeout(r, 50))
        res[`${k} / crossorigin=${co}`] = performance.getEntriesByType('resource').filter((e) => e.name.includes(`sonda=${k}-${co}`)).map((e) => (e as PerformanceResourceTiming).initiatorType)
      }
    }
    return res
  })
  console.log('SONDA ' + JSON.stringify(out, null, 1))
})
