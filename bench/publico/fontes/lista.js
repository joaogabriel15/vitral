// Remotes de cada N: 3 React para cada Vue, na mesma ordem nos dois hosts.
export function remotes(n) {
  return Array.from({ length: n }, (_, i) => (i % 4 === 3 ? `vue${(i >> 2) + 1}` : `react${i - (i >> 2) + 1}`))
}

// Marca o fim quando os N cartões estão no DOM (o mesmo critério nos dois hosts).
export function quandoMontar(app, n) {
  const pronto = () => {
    if (app.querySelectorAll('.cartao').length < n) return false
    window.__ready = performance.now()
    return true
  }
  if (pronto()) return
  const obs = new MutationObserver(() => pronto() && obs.disconnect())
  obs.observe(app, { childList: true, subtree: true })
}

export function parametros() {
  const q = new URLSearchParams(location.search)
  return { n: Number(q.get('n') ?? 1), base: q.get('remotes') ?? '', maxStale: Number(q.get('stale')) || undefined }
}
