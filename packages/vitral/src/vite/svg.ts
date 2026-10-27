/**
 * `import Icon from './icon.svg'` como no Next com `@svgr/webpack`: o
 * `export default` é um componente React. Usa o SVGR já instalado no projeto
 * (vem com o `@svgr/webpack`); sem ele, o SVG continua sendo URL, como no Vite.
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { basename, join } from 'node:path'
import { pathToFileURL } from 'node:url'

type Svgr = (code: string, config: object, state: object) => Promise<string>

export interface SvgComponents {
  transform(file: string): Promise<{ code: string; map: null }>
}

/** O transformador, se o projeto tem `@svgr/core` e `@svgr/plugin-jsx`; senão, nada. */
export async function svgComponents(root: string): Promise<SvgComponents | undefined> {
  const req = createRequire(join(root, 'package.json'))
  const load = async (id: string) => import(pathToFileURL(req.resolve(id)).href).then((m) => m.default ?? m)
  let svgr: Svgr
  let plugins: unknown[]
  try {
    svgr = (await load('@svgr/core')).transform
    plugins = [await load('@svgr/plugin-jsx')]
  } catch {
    return
  }
  try {
    // A mesma otimização do @svgr/webpack, quando instalada.
    plugins.unshift(await load('@svgr/plugin-svgo'))
  } catch {}
  const vite: any = await import('vite')
  return {
    async transform(file) {
      const name = basename(file, '.svg').replace(/(^|[^a-zA-Z0-9])([a-zA-Z0-9])/g, (_, _s, c: string) => c.toUpperCase())
      const jsx = await svgr(readFileSync(file, 'utf8'), { plugins, jsxRuntime: 'automatic' }, { filePath: file, componentName: `Svg${name}` })
      const out = vite.transformWithOxc
        ? await vite.transformWithOxc(jsx, file + '.jsx', { lang: 'jsx', jsx: { runtime: 'automatic' } })
        : await vite.transformWithEsbuild(jsx, file + '.jsx', { loader: 'jsx', jsx: 'automatic' })
      return { code: out.code, map: null }
    },
  }
}
