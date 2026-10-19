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
 * - `class` e `data-theme` do `<html>` são copiados para a raiz do remote e
 *   para o destino de portais, para `.dark` e `[data-theme]` funcionarem lá.
 */
import { fetchCssText, injectCss } from './css'
import type { StyleOptions } from './types'

const sheets = new Map<string, Promise<CSSStyleSheet[]>>()
const hoisted = new Set<string>()
// Relativa ou só com o caminho (`/x.woff2`): numa folha construída ou num
// <style> do documento, valeria a partir da página, não do CSS do remote.
const RELATIVE_URL = /url\(\s*(['"]?)(?![a-z]+:|\/\/|#)([^'")]+)\1\s*\)/gi
// 1: nome do @property; 3 ou 4: URL do @import.
const GLOBAL_RULES = /@property\s+(--[\w-]+)\s*\{[^}]*\}|@font-face\s*\{[^}]*\}|@import\s+(?:url\(\s*)?(?:(['"])(.*?)\2|([^'"\s);]+))\s*\)?[^;]*;/gi

export async function attachStyles(
  root: ShadowRoot,
  el: HTMLElement,
  css: string[],
  global: StyleOptions = {},
  local: StyleOptions = {},
  sri: Record<string, string> = {},
): Promise<[release: () => void, portal: HTMLElement]> {
  // Destino de portais (popovers, menus, dialogs): irmão da raiz, com os
  // mesmos atributos, para o CSS adotado e o escopo valerem lá também.
  const portal = el.cloneNode() as HTMLElement
  portal.setAttribute('data-vitral-portal', '')
  el.after(portal)
  // CSS base do host primeiro: o do remote vence quando os dois definem algo.
  const urls = [...(global.inherit ?? []), ...(local.inherit ?? [])].map((u) => new URL(u, document.baseURI).href).concat(css)
  if (typeof CSSStyleSheet !== 'undefined' && 'replaceSync' in CSSStyleSheet.prototype) {
    const loaded = await Promise.all(urls.map((u) => loadSheet(u, [], sri[u])))
    root.adoptedStyleSheets = [...new Set([...root.adoptedStyleSheets, ...loaded.flat()])]
  } else {
    await injectCss(urls, root, sri)
  }
  const stop = (local.mirrorTheme ?? global.mirrorTheme) === false ? [] : [mirrorTheme(el), mirrorTheme(portal)]
  return [() => (stop.forEach((fn) => fn()), portal.remove()), portal]
}

function loadSheet(href: string, chain: string[], integrity?: string): Promise<CSSStyleSheet[]> {
  let p = sheets.get(href)
  if (!p) {
    p = fetchCssText(href, integrity)
      .then((text) => {
        const up: string[] = []
        const imports: string[] = []
        // URLs relativas (fontes, imagens) continuam apontando para o remote.
        const rest = text
          .replace(RELATIVE_URL, (_, q, u) => `url(${q}${new URL(u, href).href}${q})`)
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
        const sheet = new CSSStyleSheet()
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
