// App shell do vitral com duas rotas, uma por equipe: /<base>/a monta o
// remote `a` e /<base>/b monta o remote `b`. É o par do Multi-Zones com duas
// zonas. `?remotes=<cenário>` escolhe os builds; `&prefetch` liga
// vitral/prefetch. Pelo gateway (/g/), os remotes vêm de /_vitral/.
import { configure, navigate } from 'vitral'
import { routes } from 'vitral/routes'

const q = new URLSearchParams(location.search)
const base = location.pathname.split('/')[1]
const url = (nome) => (base === 'g' ? `/_vitral/${nome}/vitral.json` : `/${q.get('remotes')}/${nome}/vitral.json`)
configure({ remotes: { a: url('a'), b: url('b') } })
routes({ [`/${base}/a`]: 'a', [`/${base}/b`]: 'b' })
window.__prefetched = []
if (q.has('prefetch')) {
  const { prefetch } = await import('vitral/prefetch')
  prefetch({ onPrefetch: (names) => window.__prefetched.push(...names) })
}
// Navega e devolve o tempo até o remote da rota nova ficar pronto.
window.__go = (path) =>
  new Promise((resolve) => {
    const t = performance.now()
    addEventListener('vitral-ready', () => resolve(performance.now() - t), { once: true })
    navigate(path.replace(/^\/v\//, `/${base}/`) + location.search)
  })
addEventListener('vitral-ready', () => (window.__ready ??= performance.now()), { once: true })
