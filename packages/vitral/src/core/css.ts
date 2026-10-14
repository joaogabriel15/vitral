import { protocol } from './state'
import type { StyleOptions } from './types'

const loadedCss = new WeakMap<Document | ShadowRoot, Map<string, Promise<void>>>()
const noop = () => {}

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
          const link = document.createElement('link')
          link.rel = 'stylesheet'
          link.href = href
          link.crossOrigin = 'anonymous'
          // CSS quebrado não deve impedir o remote de aparecer.
          link.onload = link.onerror = () => resolve()
          parent.appendChild(link)
        })
        seen!.set(href, p)
      }
      return p
    }),
  )
}
