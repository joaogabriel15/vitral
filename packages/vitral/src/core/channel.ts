/**
 * Canary e rollback por um arquivo-ponteiro (o canal), sem serviço pago:
 *
 *   // https://cdn.empresa.com/checkout/canal.json
 *   { "stable": "1.4.0", "canary": { "version": "1.5.0", "percent": 10 } }
 *
 *   configure({ remotes: { checkout: 'https://cdn.empresa.com/checkout/canal.json' } })
 *
 * Cada versão fica na própria pasta ao lado do canal (`1.5.0/vitral.json`) e
 * nunca muda depois de publicada; voltar uma versão é editar o canal. O host
 * sorteia quem recebe a canary por um número estável do navegador (ou de
 * `canaryKey`). Se a versão que não é a estável gerar `errors` erros numa
 * janela de `mounts` montagens, o host volta para a estável até o fim da
 * sessão, troca as montagens na tela e chama `onRollback`.
 *
 * O loader importa este módulo só quando o JSON baixado é um canal.
 */
import { tr } from './lang'
import { RemoteError } from './errors'
import { ctxHooks } from './hooks'
import { protocol } from './state'
import type { Channel, ChannelContext, RemoteEntry } from './types'
import { absolute } from './util'

/** Versões abandonadas nesta sessão, por remote (também no `sessionStorage`). */
const ROLLBACK_KEY = 'vitral:rollback'
/** Id aleatório deste navegador, base do sorteio sem `canaryKey`. */
const ID_KEY = 'vitral:id'

interface Watch {
  from: string
  to: string
  errors: number
  mounts: number
  max: { errors: number; mounts: number }
}

/** Remotes servidos agora por uma versão que não é a estável. */
const watching = new Map<string, Watch>()
let abandoned: Record<string, string> = {}
let id: string | undefined

/** Entrada que aponta para o `vitral.json` da versão escolhida no canal. */
export async function pick(name: string, entry: RemoteEntry & { url: string }, channel: Channel): Promise<RemoteEntry & { url: string }> {
  if (typeof channel.stable != 'string') throw new RemoteError('INVALID_MODULE', name, tr(`canal inválido em ${entry.url}: falta "stable"`, `invalid channel at ${entry.url}: missing "stable"`))
  ctxHooks.watch = watch
  const ctx: ChannelContext = { name, bucket: bucket(name) }
  const { canary, stable } = channel
  let version = (entry.resolve && (await chosen(name, entry, channel, ctx))) ?? (canary && ctx.bucket < canary.percent ? canary.version : stable)
  if (version !== stable && rolledBack()[name] === version) version = stable
  if (version === stable || entry.rollback === false) watching.delete(name)
  else if (watching.get(name)?.from !== version) {
    watching.set(name, { from: version, to: stable, errors: 0, mounts: 0, max: { errors: 3, mounts: 20, ...entry.rollback } })
  }
  // O hash do host e o manifesto embutido descreviam o canal, não a versão.
  return { ...entry, url: versionUrl(version, entry.url), integrity: undefined, manifest: undefined }
}

/**
 * Versão escolhida pelo `resolve` do host (serviço de flags). Se ele lançar
 * erro ou demorar mais que `resolveTimeout`, vale a estável: rota atrás de
 * flag não some quando o serviço cai.
 */
async function chosen(name: string, entry: RemoteEntry, channel: Channel, ctx: ChannelContext): Promise<string | undefined> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const late = new Promise<never>((_, no) => (timer = setTimeout(() => no(new Error(`sem resposta em ${entry.resolveTimeout ?? 1500} ms`)), entry.resolveTimeout ?? 1500)))
  try {
    return await Promise.race([entry.resolve!(channel, ctx), late])
  } catch (e) {
    console.warn(`[vitral] ${name}: resolve do canal falhou (${(e as Error)?.message ?? e}); usando a estável ${channel.stable}`)
    return channel.stable
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Segue pela versão do canal; se o `vitral.json` dela não carregar (pasta
 * não publicada, JSON inválido, contrato), volta para a estável nesta sessão.
 */
export async function follow<T>(name: string, entry: RemoteEntry & { url: string }, channel: Channel, resolve: (entry: RemoteEntry & { url: string }) => Promise<T>): Promise<T> {
  const picked = await pick(name, entry, channel)
  try {
    return await resolve(picked)
  } catch (e) {
    const stable = versionUrl(channel.stable, entry.url)
    if (picked.url === stable) throw e
    const w = watching.get(name)
    console.warn(`[vitral] ${name}: a versão ${w?.from ?? picked.url} não carregou; usando a estável ${channel.stable}`, e)
    if (w) rollback(name, w, false)
    return resolve({ ...picked, url: stable })
  }
}

/** `'1.5.0'` → `1.5.0/vitral.json` ao lado do canal; caminhos e URLs ficam como estão. */
export const versionUrl = (version: string, channel: string): string =>
  absolute(/[/:]|\.(m?js|json)$/.test(version) ? version : `${version}/vitral.json`, channel)

/** Número de 0 a 99, estável por chave do usuário e por remote (FNV-1a). */
export function bucket(name: string): number {
  const key = protocol().settings().canaryKey ?? browserId()
  let h = 0x811c9dc5
  for (const c of `${key}:${name}`) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193)
  return (h >>> 0) % 100
}

function browserId(): string {
  try {
    id ??= localStorage.getItem(ID_KEY) ?? undefined
  } catch {}
  if (!id) {
    id = Math.random().toString(36).slice(2)
    try {
      localStorage.setItem(ID_KEY, id)
    } catch {}
  }
  return id
}

function rolledBack(): Record<string, string> {
  try {
    return { ...JSON.parse(sessionStorage.getItem(ROLLBACK_KEY) || '{}'), ...abandoned }
  } catch {
    return abandoned
  }
}

/** Conta montagens e erros de cada remote que está numa versão canary. */
function watch(name: string, error?: RemoteError): void {
  for (const [key, w] of watching) {
    // Partes (`checkout/Mini`) contam como o remote.
    if (name !== key && !name.startsWith(key + '/')) continue
    if (!error) {
      if (++w.mounts > w.max.mounts) (w.mounts = 1), (w.errors = 0)
    } else if (++w.errors >= w.max.errors) {
      rollback(key, w)
    }
  }
}

/** O JS da versão canary de `name` não carregou: volta para a estável nesta sessão (sem trocar montagens). */
export function abandon(name: string): void {
  const w = watching.get(name)
  if (w) rollback(name, w, false)
}

/** `swap`: troca as montagens na tela (com a canary já montada); sem montagem, só marca. */
function rollback(name: string, w: Watch, swap = true): void {
  watching.delete(name)
  abandoned = { ...rolledBack(), [name]: w.from }
  try {
    sessionStorage.setItem(ROLLBACK_KEY, JSON.stringify(abandoned))
  } catch {}
  if (swap) console.warn(`[vitral] ${name}: ${w.errors} erros em ${w.mounts} montagens da versão ${w.from}; voltando para ${w.to}`)
  try {
    protocol().settings().onRollback?.({ name, from: w.from, to: w.to, errors: w.errors, mounts: w.mounts })
  } catch {}
  if (!swap) return
  // Registrar de novo descarta o módulo em cache; o `vitral:refresh` troca
  // as montagens na tela pela estável (o mesmo que `refresh`, sem importar
  // `updates`, que viraria um chunk a mais no host). Se a estável falhar, a
  // montagem antiga fica.
  const p = protocol()
  p.register(name, p.entry(name)!)
  p.events.emit('vitral:refresh', name)
}

/** Só para testes: esquece os rollbacks e o id desta cópia. */
export function resetChannels(): void {
  watching.clear()
  abandoned = {}
  id = undefined
}
