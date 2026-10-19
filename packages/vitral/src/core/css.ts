import { protocol } from './state'
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

/**
 * Começa a baixar o CSS junto com o JS, sem aplicar nada ainda. No Shadow DOM
 * o texto fica em cache para virar stylesheet; fora dele, um
 * `<link rel=preload>` deixa o `<link rel=stylesheet>` da montagem pronto.
 */
export function prefetchCss(urls: string[], shadow: boolean, sri: Record<string, string> = {}, priority: RequestPriority = 'auto'): void {
  for (const href of urls) {
    if (shadow && adopts()) fetchCssText(href, sri[href], priority).catch(noop)
    else if (!document.querySelector(`link[href="${href}"]`)) addLink('preload', href, { as: 'style', integrity: sri[href] ?? '', fetchPriority: priority })
  }
}

/**
 * Põe o CSS do remote na página. Sem Shadow DOM, vira `<link>` no `<head>`.
 * Com Shadow DOM, o trabalho fica em `./shadow`, baixado só por quem usa.
 * Com hash em `sri`, o navegador confere os bytes antes de aplicar.
 * Devolve a função que desfaz o que precisa ser desfeito no unmount.
 */
export function injectStyles(
  urls: string[],
  root: ShadowRoot | null,
  el: HTMLElement,
  styles?: StyleOptions,
  sri: Record<string, string> = {},
): Promise<[release: () => void, portal?: HTMLElement]> {
  return root
    ? import('./shadow').then((m) => m.attachStyles(root, el, urls, protocol().settings().styles, styles, sri))
    : injectCss(urls, null, sri).then(() => [noop])
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
