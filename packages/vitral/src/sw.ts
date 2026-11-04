/**
 * Para o service worker do host: os arquivos que um remote publica, para
 * guardar no cache e o remote abrir offline.
 *
 *   // sw.js do host
 *   import { remoteFiles } from 'vitral/sw'
 *   self.addEventListener('install', (e) => e.waitUntil(
 *     remoteFiles('/conta/vitral.json').then((urls) => caches.open('remotes').then((c) => c.addAll(urls))),
 *   ))
 */
import type { RemoteManifest } from './core/types'

/**
 * URLs absolutas do manifesto e de tudo que ele lista: arquivo único, CSS,
 * build dividido (inclusive os `import()` das rotas), cópias de `dedupe` e os
 * módulos de teste do SRI.
 */
export async function remoteFiles(manifestUrl: string, init?: RequestInit): Promise<string[]> {
  const base = new URL(manifestUrl, globalThis.location?.href)
  const res = await fetch(base, { cache: 'no-cache', ...init })
  if (!res.ok) throw new Error(`vitral: ${base.href} respondeu ${res.status}`)
  return filesOf(await res.json(), base.href)
}

/** O mesmo que `remoteFiles`, para um manifesto já lido. */
export function filesOf(m: RemoteManifest, manifestUrl: string): string[] {
  const base = new URL(manifestUrl, globalThis.location?.href)
  const files = [
    m.entry,
    ...(m.css ?? []),
    ...(m.shadow?.css ?? []),
    ...(m.shadow?.global ?? []),
    ...Object.keys(m.files ?? {}),
    ...(m.split ? [m.split.entry, ...(m.split.chunks ?? [])] : []),
    ...(m.dedupe ?? []).flatMap((d) => [d.file, ...(d.chunks ?? [])]),
    ...(m.probe ?? []),
  ]
  return [base.href, ...new Set(files.filter(Boolean).map((f) => new URL(f, base).href))]
}

export interface RemoteWorkerOptions {
  /** URLs dos `vitral.json` dos remotes. */
  manifests: string[]
  /** Nome do cache. Padrão `vitral-remotes`. */
  cache?: string
}

/** O que o service worker precisa do `self`. */
interface Scope {
  addEventListener(type: string, fn: (e: any) => void): void
  location?: { href: string }
}

const hashed = (u: string, manifests: Set<string>) => !manifests.has(u) && /\.(js|mjs|css|wasm)$/.test(new URL(u).pathname)

/**
 * Service worker do host para os remotes. No `install`, baixa o manifesto e
 * todos os arquivos de cada remote para o CacheStorage: o Chrome gera o cache
 * de código completo para scripts gravados durante o `install`, e a volta à
 * página compila menos. Onde há Static Routing API (Chrome 123+), os arquivos
 * com hash vão direto ao cache, sem acordar o service worker; nos outros
 * navegadores, o `fetch` responde do cache.
 *
 * O manifesto vai sempre à rede primeiro (o cache só vale offline). Quando
 * ele muda (deploy do remote), os arquivos novos entram no cache por trás, e
 * a próxima visita já os encontra. Arquivos de versões que nenhum manifesto
 * lista saem do cache no `activate` e a cada manifesto novo.
 *
 *   // sw.js do host
 *   import { remoteWorker } from 'vitral/sw'
 *   remoteWorker(self, { manifests: ['/conta/vitral.json'] })
 */
export function remoteWorker(self: Scope, o: RemoteWorkerOptions): void {
  const name = o.cache ?? 'vitral-remotes'
  const base = self.location?.href ?? globalThis.location?.href
  const manifests = new Set(o.manifests.map((m) => new URL(m, base).href))
  const scopes = [...manifests].map((m) => new URL('./', m).href)
  const mine = (u: string) => scopes.some((s) => u.startsWith(s))

  /** Baixa o que falta de cada remote; devolve o conjunto de URLs atuais. */
  const fill = async (known?: [string, RemoteManifest]): Promise<Set<string>> => {
    const c = await caches.open(name)
    const keep = new Set<string>()
    // O manifesto também fica guardado, para abrir offline.
    const read = async (m: string): Promise<string[]> => {
      const res = await fetch(m, { cache: 'no-cache' })
      if (!res.ok) return []
      await c.put(m, res.clone())
      return filesOf(await res.json(), m)
    }
    for (const m of manifests) {
      const urls = known?.[0] === m ? filesOf(known[1], m) : await read(m).catch(() => [] as string[])
      for (const u of urls) keep.add(u)
      const missing: string[] = []
      for (const u of urls) if (hashed(u, manifests) && !(await c.match(u))) missing.push(u)
      // Um arquivo que falha não impede os outros nem o install.
      await Promise.all(missing.map((u) => c.add(u).catch(() => {})))
    }
    return keep
  }
  const complete = (keep: Set<string>) => [...manifests].every((m) => keep.has(m))
  const prune = async (keep: Set<string>) => {
    // Um manifesto que não chegou deixa a lista incompleta: nada sai.
    if (!complete(keep)) return
    const c = await caches.open(name)
    for (const req of await c.keys()) if (hashed(req.url, manifests) && mine(req.url) && !keep.has(req.url)) await c.delete(req)
  }

  self.addEventListener('install', (e) => {
    const routes = scopes.map((s) => ({ condition: { urlPattern: new URL('split/*', s).href }, source: { cacheName: name } }))
    e.waitUntil(
      Promise.all([
        fill(),
        // Static Routing API: o arquivo com hash não passa pelo fetch do worker.
        Promise.resolve()
          .then(() => e.addRoutes?.(routes))
          .catch(() => {}),
      ]),
    )
  })
  self.addEventListener('activate', (e) => e.waitUntil(fill().then(prune)))
  self.addEventListener('fetch', (e) => {
    const req: Request = e.request
    if (req.method !== 'GET') return
    const url = req.url.split('#')[0]
    if (manifests.has(url)) {
      // Rede primeiro; com versão nova, os arquivos dela entram por trás.
      e.respondWith(
        fetch(req).then(
          (res) => {
            if (res.ok) {
              const copy = res.clone()
              e.waitUntil?.(
                copy
                  .clone()
                  .json()
                  .then(async (m: RemoteManifest) => {
                    await (await caches.open(name)).put(url, copy)
                    await prune(await fill([url, m]))
                  })
                  .catch(() => {}),
              )
            }
            return res
          },
          () => caches.open(name).then((c) => c.match(url)).then((hit) => hit ?? Response.error()),
        ),
      )
      return
    }
    if (mine(url) && hashed(url, manifests)) e.respondWith(caches.open(name).then((c) => c.match(req)).then((hit) => hit ?? fetch(req)))
  })
}
