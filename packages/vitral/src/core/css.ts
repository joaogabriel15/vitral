import { protocol } from './state'
import type { StyleOptions } from './types'
import { addLink } from './util'

const loadedCss = new WeakMap<Document | ShadowRoot, Map<string, Promise<void>>>()
const cssText = new Map<string, Promise<string>>()
const noop = () => {}

const adopts = () => typeof CSSStyleSheet !== 'undefined' && 'replaceSync' in CSSStyleSheet.prototype

/** Texto do CSS, baixado uma vez só. CSS quebrado vira texto vazio. */
export function fetchCssText(href: string): Promise<string> {
  let p = cssText.get(href)
  if (!p) {
    p = fetch(href, { credentials: 'omit' })
      .then((r) => (r.ok ? r.text() : ''))
      .catch(() => '')
    cssText.set(href, p)
  }
  return p
}

/**
 * Começa a baixar o CSS junto com o JS, sem aplicar nada ainda. No Shadow DOM
 * o texto fica em cache para virar stylesheet; fora dele, um
 * `<link rel=preload>` deixa o `<link rel=stylesheet>` da montagem pronto.
 */
export function prefetchCss(urls: string[], shadow: boolean): void {
  for (const href of urls) {
    if (shadow && adopts()) void fetchCssText(href)
    else if (!document.querySelector(`link[href="${href}"]`)) addLink('preload', href, 'style')
  }
}

/**
 * Põe o CSS do remote na página. Sem Shadow DOM, vira `<link>` no `<head>`.
 * Com Shadow DOM, o trabalho fica em `./shadow`, baixado só por quem usa.
 * Devolve a função que desfaz o que precisa ser desfeito no unmount.
 */
export function injectStyles(urls: string[], root: ShadowRoot | null, el: HTMLElement, styles?: StyleOptions): Promise<() => void> {
  return root
    ? import('./shadow').then((m) => m.attachStyles(root, el, urls, protocol().settings().styles, styles))
    : injectCss(urls, null).then(() => noop)
}

/** `<link>` para cada URL, uma vez só por documento ou shadow root. */
export function injectCss(urls: string[], root: ShadowRoot | null): Promise<unknown> {
  const owner = root ?? document
  let seen = loadedCss.get(owner)
  if (!seen) loadedCss.set(owner, (seen = new Map()))
  const parent = root ?? document.head
  return Promise.all(
    urls.map((href) => {
      let p = seen!.get(href)
      if (!p) {
        p = new Promise<void>((resolve) => {
          // CSS quebrado não deve impedir o remote de aparecer.
          const link = addLink('stylesheet', href, '', parent)
          link.onload = link.onerror = () => resolve()
        })
        seen!.set(href, p)
      }
      return p
    }),
  )
}
