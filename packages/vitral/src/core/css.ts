import { addLink } from './util'

const loadedCss = new WeakMap<Document | ShadowRoot, Map<string, Promise<void>>>()
const cssText = new Map<string, Promise<CSSStyleSheet | null>>()
const hoistedProps = new Set<string>()

const adopts = () => typeof CSSStyleSheet !== 'undefined' && 'replaceSync' in CSSStyleSheet.prototype

/**
 * Começa a baixar o CSS junto com o JS, sem aplicar nada ainda. No Shadow DOM
 * o texto já fica em cache para virar stylesheet; fora dele, um
 * `<link rel=preload>` deixa o `<link rel=stylesheet>` da montagem pronto.
 */
export function prefetchCss(urls: string[], shadow: boolean): void {
  for (const href of urls) {
    if (shadow && adopts()) loadSheet(href)
    else if (!document.querySelector(`link[href="${href}"]`)) addLink('preload', href, 'style')
  }
}

export function injectCss(urls: string[], root: ShadowRoot | null): Promise<unknown> {
  if (root && adopts()) return injectShadowCss(urls, root)
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

/**
 * CSS dentro de Shadow DOM. `@property` (usado pelo Tailwind v4 em sombras,
 * rings, gradientes, transforms…) é ignorado dentro de shadow roots, então
 * essas regras sobem para o documento e o resto vira um stylesheet adotado.
 */
function injectShadowCss(urls: string[], root: ShadowRoot): Promise<unknown> {
  return Promise.all(urls.map(loadSheet)).then((sheets) => {
    const add = sheets.filter((s): s is CSSStyleSheet => !!s && !root.adoptedStyleSheets.includes(s))
    root.adoptedStyleSheets = [...root.adoptedStyleSheets, ...add]
  })
}

function loadSheet(href: string): Promise<CSSStyleSheet | null> {
  let p = cssText.get(href)
  if (!p) {
    p = fetch(href, { credentials: 'omit' })
      .then((r) => (r.ok ? r.text() : ''))
      .then((text) => {
        const props: string[] = []
        const rest = text.replace(/@property\s+(--[\w-]+)\s*\{[^}]*\}/g, (rule, prop: string) => {
          if (!hoistedProps.has(prop)) {
            hoistedProps.add(prop)
            props.push(rule)
          }
          return ''
        })
        if (props.length) {
          const style = document.createElement('style')
          style.setAttribute('data-vitral-properties', '')
          style.textContent = props.join('\n')
          document.head.appendChild(style)
        }
        const sheet = new CSSStyleSheet()
        // URLs relativas (fontes, imagens) continuam apontando para o remote.
        sheet.replaceSync(rest.replace(/url\(\s*(['"]?)(?![a-z]+:|\/|#)([^'")]+)\1\s*\)/gi, (_, q, u) => `url(${q}${new URL(u, href).href}${q})`))
        return sheet
      })
      .catch(() => null)
    cssText.set(href, p)
  }
  return p
}
