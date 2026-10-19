/**
 * Isolamento por iframe, para código de terceiros ou legado que suja `window`:
 *
 *   import { enableIframe } from 'vitral/iframe'
 *   enableIframe()
 *
 *   <vitral-remote name="widget-parceiro" isolate="iframe"></vitral-remote>
 *   <Remote name="widget-parceiro" isolate="iframe" props={{ cor }} />
 *
 * O remote roda num iframe `sandbox="allow-scripts"`, com origem opaca: não lê
 * `parent.document`, cookies nem o storage do host. A página baixa o JS, confere
 * a origem e o SRI e manda os bytes verificados para o iframe. Props, eventos
 * (`ctx.events`) e `ctx.navigate` passam por `postMessage` (só dados
 * serializáveis), e a altura do iframe acompanha o conteúdo.
 */
import { report } from './core/errors'
import { splitName } from './core/expose'
import { verifyIntegrity } from './core/integrity'
import { resolveEntry } from './core/loader'
import { setFrameMounter, type MountOptions } from './core/mount'
import { protocol } from './core/state'
import { track } from './core/updates'
import { fetchBytes, withRetry, withTimeout } from './core/util'
import { FRAME_HTML } from './iframe-frame'
import { events, navigate, RemoteError, type MountedRemote, type Props, type RemoteEntry, type RemoteErrorCode } from './index'

export { FRAME_SCRIPT } from './iframe-frame'

/** Canal com um iframe montado, para pontes novas (ex.: estado compartilhado). */
export interface FramePort {
  /** Manda `data` (serializável) para o iframe com o tipo `type`. */
  post(type: string, data?: unknown): void
  /** Recebe as mensagens do iframe com o tipo `type`. */
  on(type: string, handler: (data: unknown) => void): () => void
}

/** Chamada a cada iframe montado. Devolve a limpeza. */
export type FrameBridge = (port: FramePort, info: { name: string }) => void | (() => void)

export interface IframeOptions {
  /**
   * Valor do atributo `sandbox`. Padrão `'allow-scripts'`. Acrescente o que o
   * remote precisa (`'allow-scripts allow-forms allow-popups'`). Com
   * `allow-same-origin` o iframe ganha a origem da página e deixa de isolar.
   */
  sandbox?: string
  /** Pontes extras, além de props e eventos. */
  bridges?: FrameBridge[]
}

const CODES: RemoteErrorCode[] = ['LOAD_FAILED', 'NOT_EXPOSED', 'INVALID_MODULE', 'MOUNT_FAILED']

/** Liga `isolate="iframe"` em todos os componentes de host e em `mountRemote`. */
export function enableIframe(options: IframeOptions = {}): void {
  const sandbox = options.sandbox ?? 'allow-scripts'
  if (/\ballow-same-origin\b/.test(sandbox) && /\ballow-scripts\b/.test(sandbox)) {
    console.warn('[vitral] sandbox com allow-scripts e allow-same-origin não isola o remote da página.')
  }
  setFrameMounter((target, name, props, mountOptions) => mountFrame(target, name, props, mountOptions, sandbox, options.bridges ?? []))
}

type Msg = { vitral?: number; type: string; data?: any }

async function mountFrame<P extends Props>(
  target: HTMLElement,
  name: string,
  props: P,
  options: MountOptions,
  sandbox: string,
  bridges: FrameBridge[],
): Promise<MountedRemote<P>> {
  const p = protocol()
  const { timeout, retries } = p.settings()
  const [remote, key] = splitName(name)
  const entry = p.entry(remote)
  if (!entry) throw new RemoteError('NOT_REGISTERED', name, 'remote não registrado. Use configure({ remotes }).')
  if (!entry.url) throw new RemoteError('MOUNT_FAILED', name, 'remote local (module) não roda em iframe: registre a URL dele')
  const { integrity, ...resolved } = await resolveEntry(remote, entry as RemoteEntry & { url: string })
  // Com SRI, a página confere os bytes e o iframe executa exatamente esses bytes.
  const code = integrity
    ? await withRetry(retries, async () => {
        const bytes = await fetchBytes(resolved.entry, timeout, name)
        await verifyIntegrity(name, bytes, integrity)
        return bytes
      })
    : undefined
  // `data:` e `blob:` não têm pasta: a base é a própria URL.
  const baseUrl = /^https?:/.test(resolved.entry) ? new URL('.', resolved.entry).href : resolved.entry

  const frame = document.createElement('iframe')
  frame.setAttribute('sandbox', sandbox)
  frame.setAttribute('data-vitral-root', name)
  frame.title = name
  frame.style.cssText = 'display:block;width:100%;height:0;border:0'
  frame.srcdoc = FRAME_HTML

  let warned = false
  const post = (type: string, data?: unknown) => {
    const win = frame.contentWindow
    if (!win) return
    try {
      win.postMessage({ vitral: 1, type, data }, '*')
    } catch {
      // Funções e outros valores que não passam por postMessage somem.
      if (!warned) console.warn(`[vitral] ${name}: props e eventos no modo iframe precisam ser serializáveis; o que não é foi descartado.`)
      warned = true
      win.postMessage({ vitral: 1, type, data: JSON.parse(JSON.stringify(data ?? null)) }, '*')
    }
  }
  const subs = new Map<string, () => void>()
  const channel = new Map<string, Set<(data: unknown) => void>>()
  const port: FramePort = {
    post,
    on(type, handler) {
      if (!channel.has(type)) channel.set(type, new Set())
      channel.get(type)!.add(handler)
      return () => channel.get(type)?.delete(handler)
    },
  }
  let settle: { ok(): void; fail(e: RemoteError): void } | null = null
  const ready = new Promise<void>((ok, fail) => (settle = { ok, fail }))

  const onMessage = (e: MessageEvent) => {
    const m = e.data as Msg
    if (e.source !== frame.contentWindow || !m || m.vitral !== 1) return
    const d = m.data
    switch (m.type) {
      case 'ready':
        if (settle) post('mount', { name, key, code, url: resolved.entry, css: resolved.css, scope: resolved.scope, baseUrl, props })
        break
      case 'mounted':
        settle?.ok()
        settle = null
        break
      case 'error':
        settle?.fail(new RemoteError(CODES.includes(d?.code) ? d.code : 'MOUNT_FAILED', name, String(d?.message)))
        settle = null
        break
      case 'size':
        frame.style.height = `${Math.max(0, Number(d?.height) || 0)}px`
        break
      case 'emit':
        events.emit(String(d?.type), d?.payload)
        break
      case 'on': {
        const type = String(d?.type)
        if (subs.has(type)) break
        subs.set(type, events.on(type, (payload) => post('event', { type, payload })))
        const value = events.last(type)
        if (value !== undefined) post('last', { type, payload: value })
        break
      }
      case 'navigate': {
        // O iframe só navega dentro da página: nunca leva o usuário para outra origem.
        const url = new URL(String(d?.url), location.href)
        if (url.origin === location.origin) navigate(url.href, { replace: !!d?.replace })
        else console.warn(`[vitral] ${name}: navegação para outra origem bloqueada (${url.origin})`)
        break
      }
      case 'report': {
        const err = report(new RemoteError('RENDER_FAILED', name, String(d?.message)), resolved)
        if (options.onError) options.onError(err)
        else console.error(err)
        break
      }
      default:
        for (const h of [...(channel.get(m.type) ?? [])]) h(d)
    }
  }

  const disposers: Array<() => void> = []
  const cleanup = () => {
    removeEventListener('message', onMessage)
    for (const off of subs.values()) off()
    for (const off of disposers) off()
    subs.clear()
    frame.remove()
  }
  addEventListener('message', onMessage)
  for (const bridge of bridges) {
    const off = bridge(port, { name })
    if (off) disposers.push(off)
  }
  target.appendChild(frame)
  try {
    await withTimeout(timeout, name, ready)
  } catch (e) {
    cleanup()
    throw e
  }
  disposers.push(track(name, resolved))

  let alive = true
  return {
    update(next) {
      if (alive) post('update', next)
    },
    unmount() {
      if (!alive) return
      alive = false
      post('unmount')
      cleanup()
    },
  }
}
