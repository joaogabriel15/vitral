/**
 * Transformações que o plugin aplica no CSS final do remote, na ordem:
 * tema do host, depois escopo.
 */
import postcss from 'postcss'
import { scopeRoot } from './css-scope'
import { hostTheme } from './css-theme'

export interface CssBuildOptions {
  /**
   * `'host'`: as variáveis globais do remote (`:root`, `:host`) viram só
   * fallback. O remote usa o valor do host quando ele existe e o próprio
   * quando não existe. Para quem não tem um pacote de tokens compartilhado.
   */
  theme?: 'host'
}

export function transformCss(css: string, options: CssBuildOptions & { scopeCss?: boolean }, scope: string): string {
  const root = postcss.parse(css)
  if (options.theme === 'host') hostTheme(root)
  if (options.scopeCss !== false) scopeRoot(root, scope)
  return root.toString()
}
