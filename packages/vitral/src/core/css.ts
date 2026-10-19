import { protocol, type LoadedRemote } from './state'
import type { StyleOptions } from './types'
import { addLink, fetchBytes } from './util'

const loadedCss = new WeakMap<Document | ShadowRoot, Map<string, Promise<void>>>()
const cssText = new Map<string, Promise<string>>()
const noop = () => {}

const adopts = () => typeof CSSStyleSheet !== 'undefined' && 'replaceSync' in CSSStyleSheet.prototype

/**
 * Texto do CSS, baixado uma vez só por URL e hash. Falha (HTTP de erro, rede,
 * hash diferente ou `timeout`) rejeita e sai do cache: a próxima montagem
 * tenta de novo. Com integrity, um CSS trocado faz o fetch falhar.
 */
export function fetchCssText(href: string, integrity?: string, priority?: RequestPriority): Promise<string> {
  const key = `${href} ${integrity ?? ''}`
  let p = cssText.get(key)
  if (!p) {
    p = fetchBytes(href, protocol().settings().timeout, href, { integrity, priority }).then((b) => new TextDecoder().decode(b))
    p.catch(() => cssText.delete(key))
    cssText.set(key, p)
  }
  return p
}

/** CSS de um remote resolvido: URLs absolutas e hashes por URL. */
export type RemoteCss = Pick<LoadedRemote, 'css' | 'shadow' | 'sri'>

/**
 * Começa a baixar o CSS junto com o JS, sem aplicar nada ainda. No Shadow DOM
 * quem escolhe os arquivos é `./shadow` (o CSS pode vir preparado no build), e
 * o texto fica em cache para virar stylesheet; o módulo, que a montagem usaria
 * depois do JS, já vem junto. Fora dele, um `<link rel=preload>` deixa o
 * `<link rel=stylesheet>` da montagem pronto.
 */
export function prefetchCss(r: RemoteCss, shadow: boolean, priority: RequestPriority = 'auto'): void {
  if (shadow && adopts()) import('./shadow').then((m) => m.prefetch(r, priority), noop)
  else for (const href of r.css) if (!document.querySelector(`link[href="${href}"]`)) addLink('preload', href, { as: 'style', integrity: r.sri?.[href] ?? '', fetchPriority: priority })
}

/**
 * Põe o CSS do remote na página. Sem Shadow DOM, vira `<link>` no `<head>`.
 * Com Shadow DOM (`shadow` é o alvo), o trabalho fica em `./shadow`, baixado
 * só por quem usa, que também cria o shadow root e o elemento raiz (`make`)
 * com o registro de custom elements do remote. Com hash em `sri`, o navegador
 * confere os bytes antes de aplicar. Devolve a função que desfaz o que
 * precisa ser desfeito no unmount e, no Shadow DOM, o destino de portais, o
 * shadow root, o registro e o elemento raiz.
 */
export function injectStyles(
  r: RemoteCss,
  shadow: HTMLElement | false,
  make: (options?: ElementCreationOptions) => HTMLElement,
  styles?: StyleOptions,
): Promise<[release: () => void, portal?: HTMLElement, root?: ShadowRoot, registry?: CustomElementRegistry, el?: HTMLElement]> {
  return shadow
    ? import('./shadow').then((m) => m.attachShadowRoot(shadow, make, r, protocol().settings().styles, styles))
    : injectCss(r.css, null, r.sri).then(() => [noop])
}

/**
 * `<link>` para cada URL, uma vez só por documento ou shadow root. CSS quebrado
 * não impede o remote de aparecer: a promessa resolve no erro e, no máximo,
 * depois de `timeout`. No erro o `<link>` sai e a próxima montagem tenta de novo.
 */
export function injectCss(urls: string[], root: ShadowRoot | null, sri: Record<string, string> = {}): Promise<unknown> {
  const owner = root ?? document
  let seen = loadedCss.get(owner)
  if (!seen) loadedCss.set(owner, (seen = new Map()))
  const parent = root ?? document.head
  const timeout = protocol().settings().timeout
  return Promise.all(
    urls.map((href) => {
      let p = seen!.get(href)
      if (!p) {
        p = new Promise<void>((resolve) => {
          const link = addLink('stylesheet', href, { integrity: sri[href] ?? '' }, parent)
          setTimeout(resolve, timeout)
          link.onload = () => resolve()
          link.onerror = () => {
            link.remove()
            seen!.delete(href)
            resolve()
          }
        })
        seen!.set(href, p)
      }
      return p
    }),
  )
}
