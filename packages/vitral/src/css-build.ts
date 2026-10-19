/**
 * Transformações que o plugin aplica no CSS final do remote, na ordem:
 * tema do host, camadas, propriedades registradas e escopo.
 */
import postcss from 'postcss'
import { flattenLayers, renameRegisteredProperties } from './css-layers'
import { scopeRoot } from './css-scope'
import { hostTheme } from './css-theme'

export interface CssBuildOptions {
  /**
   * `'host'`: as variáveis globais do remote (`:root`, `:host`) viram só
   * fallback. O remote usa o valor do host quando ele existe e o próprio
   * quando não existe. Para quem não tem um pacote de tokens compartilhado.
   */
  theme?: 'host'
  /**
   * `'flatten'`: tira os `@layer` do CSS do remote mantendo a ordem. Use quando
   * o host tem CSS sem camada (Tailwind v3, CSS legado), que no modo escopo
   * venceria todo o CSS em camada do remote.
   */
  layers?: 'flatten'
  /**
   * Renomeia as propriedades `--tw-*` registradas com `@property` para
   * `--tw-<escopo>-*`. Use quando o host tem Tailwind v3 e o remote, v4:
   * sem isso os gradientes do host quebram.
   */
  renameRegisteredProperties?: boolean
}

export function transformCss(css: string, options: CssBuildOptions & { scopeCss?: boolean }, scope: string): string {
  const root = postcss.parse(css)
  if (options.theme === 'host') hostTheme(root)
  if (options.layers === 'flatten') flattenLayers(root)
  if (options.renameRegisteredProperties) renameRegisteredProperties(root, scope)
  if (options.scopeCss !== false) scopeRoot(root, scope)
  return root.toString()
}

export interface ShadowSplit {
  /** O CSS sem `@import`, `@property` e `@font-face`. */
  css: string
  /** `@property` e `@font-face`, para o documento. Vazio quando não há. */
  global: string
  /** URLs dos `@import` que sobraram (o Vite já embute os locais). */
  imports: string[]
  /** Ainda há `url()` relativa ou só com o caminho. */
  rebase: boolean
}

// Mesmo critério do runtime (core/shadow.ts): relativa ou só com o caminho.
const RELATIVE_URL = /url\(\s*(['"]?)(?![a-z]+:|\/\/|#)([^'")]+)\1\s*\)/i
const IMPORT_URL = /^\s*(?:url\(\s*(['"]?)([^'")]+)\1\s*\)|(['"])(.*?)\3)/i

/**
 * Prepara o CSS final do remote para `isolate: 'shadow'`, o que o runtime
 * faria a cada página: folhas construídas não aceitam `@import`, e
 * `@property`/`@font-face` só valem no documento. Os `@import` que sobram
 * perdem a media query, como no runtime.
 */
export function splitShadowCss(text: string): ShadowSplit {
  const root = postcss.parse(text)
  const global: string[] = []
  const imports: string[] = []
  root.walkAtRules((rule) => {
    const name = rule.name.toLowerCase()
    if (name === 'import' && rule.parent === root) {
      const m = IMPORT_URL.exec(rule.params)
      if (m) imports.push(m[2] ?? m[4])
      rule.remove()
    } else if (name === 'property' || name === 'font-face') {
      global.push(rule.toString())
      rule.remove()
    }
  })
  const css = global.length || imports.length ? root.toString() : text
  return { css, global: global.join('\n'), imports, rebase: RELATIVE_URL.test(css) }
}
