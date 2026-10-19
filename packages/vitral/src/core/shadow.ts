/**
 * Estilos no Shadow DOM. Fica num módulo à parte, baixado só por quem usa
 * `isolate: 'shadow'`.
 *
 * - O CSS vira `CSSStyleSheet` adotado, um objeto por arquivo, o mesmo em
 *   todos os shadow roots (o navegador faz o parse uma vez só).
 * - `@property` e `@font-face` são ignorados dentro de shadow roots, então
 *   sobem para o documento, sem duplicar.
 * - Folhas construídas não aceitam `@import`: cada import vira outra folha
 *   adotada antes da que importa.
 * - `class` e `data-theme` do `<html>` são copiados para a raiz do remote,
 *   para `.dark` e `[data-theme]` funcionarem lá dentro.
 *
 * Com manifesto novo (`shadow`), o plugin já separou tudo isso no build: o
 * CSS pronto é adotado como está e `@property`/`@font-face` entram num
 * `<link>` no documento. O CSS do host (`inherit`), o extra do registro e
 * manifestos antigos passam pelas expressões abaixo.
 */
import { fetchCssText, injectCss, type RemoteCss } from './css'
import type { StyleOptions } from './types'

const sheets = new Map<string, Promise<CSSStyleSheet[]>>()
const noop = () => {}
const hoisted = new Set<string>()
// Relativa ou só com o caminho (`/x.woff2`): numa folha construída ou num
// <style> do documento, valeria a partir da página, não do CSS do remote.
const RELATIVE_URL = /url\(\s*(['"]?)(?![a-z]+:|\/\/|#)([^'")]+)\1\s*\)/gi
// 1: nome do @property; 3 ou 4: URL do @import.
const GLOBAL_RULES = /@property\s+(--[\w-]+)\s*\{[^}]*\}|@font-face\s*\{[^}]*\}|@import\s+(?:url\(\s*)?(?:(['"])(.*?)\2|([^'"\s);]+))\s*\)?[^;]*;/gi

/**
 * Os arquivos do remote no Shadow DOM, na ordem: os `@import` que o build
 * deixou, o CSS pronto e o extra do registro (`css` além dos do manifesto).
 * `ready` são os prontos; `global`, os `@property`/`@font-face` separados.
 */
function plan({ css, shadow: s }: RemoteCss): [urls: string[], ready: string[], global: string[]] {
  // O plugin grava todo o CSS na mesma pasta, ao lado do primeiro arquivo.
  const at = (u: string) => new URL(u, css[0]).href
  const ready = s ? s.css.map(at) : []
  return [s ? [...(s.imports ?? []).map(at), ...ready, ...css.slice(ready.length)] : css, ready, (s?.global ?? []).map(at)]
}

/** Começa a baixar o CSS que a montagem vai usar (ver `prefetchCss`). */
export function prefetch(r: RemoteCss, priority?: RequestPriority): void {
  const [urls, , global] = plan(r)
  for (const u of urls) fetchCssText(u, r.sri?.[u], priority).catch(noop)
  injectCss(global, null, r.sri)
}

export async function attachStyles(root: ShadowRoot, el: HTMLElement, r: RemoteCss, global: StyleOptions = {}, local: StyleOptions = {}): Promise<() => void> {
  const sri = r.sri ?? {}
  const [css, ready, up] = plan(r)
  // CSS base do host primeiro: o do remote vence quando os dois definem algo.
  const urls = [...(global.inherit ?? []), ...(local.inherit ?? [])].map((u) => new URL(u, document.baseURI).href).concat(css)
  const props = injectCss(up, null, sri)
  if (typeof CSSStyleSheet !== 'undefined' && 'replaceSync' in CSSStyleSheet.prototype) {
    const loaded = await Promise.all(urls.map((u) => loadSheet(u, [], sri[u], ready.includes(u) ? !!r.shadow!.rebase : undefined)))
    root.adoptedStyleSheets = [...new Set([...root.adoptedStyleSheets, ...loaded.flat()])]
  } else {
    await injectCss(urls, root, sri)
  }
  await props
  return (local.mirrorTheme ?? global.mirrorTheme) === false ? () => {} : mirrorTheme(el)
}

/** `ready`: CSS preparado no build; `true` se ainda tem `url()` relativa. */
function loadSheet(href: string, chain: string[], integrity?: string, ready?: boolean): Promise<CSSStyleSheet[]> {
  let p = sheets.get(href)
  if (!p) {
    p = fetchCssText(href, integrity)
      .then((text) => {
        const sheet = new CSSStyleSheet()
        // URLs relativas (fontes, imagens) continuam apontando para o remote.
        if (ready !== false) text = text.replace(RELATIVE_URL, (_, q, u) => `url(${q}${new URL(u, href).href}${q})`)
        // Pronto no build: nada de @import nem de regra global para separar.
        if (ready != null) return sheet.replaceSync(text), [sheet]
        const up: string[] = []
        const imports: string[] = []
        const rest = text
          .replace(GLOBAL_RULES, (rule, prop?: string, _q?: string, quoted?: string, bare?: string) => {
            const url = quoted ?? bare
            if (url) imports.push(new URL(url, href).href)
            else if (!hoisted.has(prop ?? rule)) {
              hoisted.add(prop ?? rule)
              up.push(rule)
            }
            return ''
          })
        if (up.length) {
          const style = document.createElement('style')
          style.setAttribute('data-vitral-properties', '')
          style.textContent = up.join('\n')
          document.head.appendChild(style)
        }
        sheet.replaceSync(rest)
        const next = [...chain, href]
        return Promise.all(imports.filter((u) => !next.includes(u)).map((u) => loadSheet(u, next))).then((found) => [...found.flat(), sheet])
      })
      .catch(() => {
        // Sem folha nesta montagem; a próxima baixa de novo.
        sheets.delete(href)
        return []
      })
    sheets.set(href, p)
  }
  return p
}

function mirrorTheme(el: HTMLElement): () => void {
  const html = document.documentElement
  let added: string[] = []
  const sync = () => {
    el.classList.remove(...added)
    added = [...html.classList].filter((c) => !el.classList.contains(c))
    el.classList.add(...added)
    const theme = html.getAttribute('data-theme')
    if (theme === null) el.removeAttribute('data-theme')
    else el.setAttribute('data-theme', theme)
  }
  sync()
  const observer = new MutationObserver(sync)
  observer.observe(html, { attributeFilter: ['class', 'data-theme'] })
  return () => observer.disconnect()
}
