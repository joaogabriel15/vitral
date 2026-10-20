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
 * - Cada remote ganha um `CustomElementRegistry` próprio, usado pelo shadow
 *   root, onde o navegador tem Scoped Custom Element Registries. Sem isso, o
 *   global, com um aviso em dev quando dois remotes definem a mesma tag.
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

/**
 * Cria (ou reusa) o shadow root de `target` e o elemento raiz do remote
 * (`make`), os dois com o registro de custom elements do remote, e aplica os
 * estilos. Devolve também o shadow root, o registro e o elemento, para o `ctx`.
 */
export async function attachShadowRoot(
  target: HTMLElement,
  make: (options?: ElementCreationOptions) => HTMLElement,
  r: RemoteCss,
  global: StyleOptions = {},
  local: StyleOptions = {},
): Promise<[release: () => void, portal: HTMLElement, root: ShadowRoot, registry: CustomElementRegistry, el: HTMLElement]> {
  // O nome do remote vem de um elemento descartável: um argumento a menos no host.
  const name = make().getAttribute('data-vitral-root')!
  let registry = registryFor(name)
  // Um shadow root reusado fica com o registro com que foi criado.
  let root = target.shadowRoot
  if (!root && !fake(registry))
    try {
      root = target.attachShadow({ mode: 'open', customElementRegistry: registry })
    } catch {
      // Suporte pela metade: este e os próximos remotes ficam no global.
      broken = true
      registries.delete(name)
      registry = registryFor(name)
    }
  root ??= target.attachShadow({ mode: 'open' })
  const own = (root as { customElementRegistry?: CustomElementRegistry }).customElementRegistry ?? registry
  // O que o remote criar com `innerHTML` dentro de `el` usa o registro de `el`.
  // O objeto do caminho sem suporte não vai na opção: quem a conhece o recusa.
  let el = make()
  if (!fake(own))
    try {
      el = make({ customElementRegistry: own })
    } catch {}
  // A raiz que veio do servidor (hidratação) já está no shadow root.
  if (!el.isConnected) root.appendChild(el)
  return [...(await attachStyles(root, el, r, global, local)), root, own, el]
}

declare const process: { env: Record<string, string | undefined> }

const registries = new Map<string, CustomElementRegistry>()
// O navegador recusou um registro próprio: os próximos remotes vão direto ao global.
let broken = false
/** O objeto do caminho sem suporte, que tem o registro global de protótipo. */
const fake = (registry: CustomElementRegistry) => Object.getPrototypeOf(registry) === customElements
// Remote que definiu cada tag pelo `ctx.customElements` global (para o aviso).
const owners = new Map<string, string>()

/**
 * Registro de custom elements do remote `name`, um por remote e reusado nas
 * remontagens (uma definição não pode ser desfeita). Com suporte, um
 * `CustomElementRegistry` novo; sem, o global. Nos dois, `define` de uma tag
 * já definida não lança: o remote fica com a definição que já existe. No
 * global, se a tag veio de outro remote, avisa em dev.
 */
export function registryFor(name: string): CustomElementRegistry {
  let registry = registries.get(name)
  if (registry) return registry
  let real = customElements
  // Detecção recomendada (`initialize`), mais o construtor: ele existe e lança
  // no Chromium antes do 146 e no WebKit do Playwright. Depois de lançar uma
  // vez, não tenta de novo.
  if (!broken && 'initialize' in CustomElementRegistry.prototype)
    try {
      real = new CustomElementRegistry()
    } catch {
      broken = true
    }
  const shared = real === customElements
  // No global, um objeto com o registro de protótipo: `instanceof` continua
  // valendo e o `define` trocado não afeta quem usa `customElements` direto.
  const own: any = (registry = shared ? Object.create(real) : real)
  if (shared) for (const k of ['get', 'getName', 'upgrade', 'whenDefined'] as const) if (k in real) own[k] = (real[k] as Function).bind(real)
  const define = real.define
  own.define = (tag: string, ctor: CustomElementConstructor, options?: ElementDefinitionOptions) => {
    const had = real.get(tag)
    const owner = owners.get(tag)
    if (!had) return shared && owners.set(tag, name), define.call(real, tag, ctor, options)
    if (shared && had !== ctor && owner !== name && dev())
      console.warn(`[vitral] ${name}: <${tag}> já foi definido por ${owner ?? 'outro código'}; fica essa definição. Sem Scoped Custom Element Registries, os remotes dividem o registro global.`)
  }
  registries.set(name, registry!)
  return registry!
}

// O mesmo teste de `isDev` (./shared), copiado: importar de lá separaria
// `shared` num chunk próprio, um download a mais para o host.
function dev(): boolean {
  try {
    return process.env.NODE_ENV !== 'production'
  } catch {
    return false
  }
}

async function attachStyles(
  root: ShadowRoot,
  el: HTMLElement,
  r: RemoteCss,
  global: StyleOptions = {},
  local: StyleOptions = {},
): Promise<[release: () => void, portal: HTMLElement]> {
  const sri = r.sri ?? {}
  const [css, ready, up] = plan(r)
  // Destino de portais (popovers, menus, dialogs): irmão da raiz, com os
  // mesmos atributos, para o CSS adotado e o escopo valerem lá também.
  const portal = el.cloneNode() as HTMLElement
  portal.setAttribute('data-vitral-portal', '')
  el.after(portal)
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
  const stop = (local.mirrorTheme ?? global.mirrorTheme) === false ? [] : [mirrorTheme(el), mirrorTheme(portal)]
  return [() => (stop.forEach((fn) => fn()), portal.remove()), portal]
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
