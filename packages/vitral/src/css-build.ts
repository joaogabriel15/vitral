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
