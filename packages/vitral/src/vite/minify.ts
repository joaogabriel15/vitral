/**
 * Vite 5-7. Em modo lib com formato `es`, o Vite não tira os espaços do JS: guarda os
 * `/*#__PURE__*\/` para quem for empacotar a lib de novo. O remote é o
 * arquivo final que o navegador baixa, então o plugin tira os espaços e os
 * comentários (cerca de 10% a menos em brotli). Nomes e sintaxe o Vite já
 * minificou. O compile hint do V8, se houver, volta para a primeira linha.
 */
const HINT = '//# allFunctionsCalledOnLoad'

type Minified = { code: string; map?: any } | null

export async function minifyWhitespace(code: string, file: string, sourcemap: boolean): Promise<Minified> {
  const vite: any = await import('vite')
  const hint = code.startsWith(HINT)
  if (typeof vite.transformWithEsbuild !== 'function') return null
  const out: { code: string; map?: any } = await vite.transformWithEsbuild(code, file, { minifyWhitespace: true, legalComments: 'none', format: 'esm', loader: 'js', sourcemap })
  if (!hint || out.code.startsWith(HINT)) return { code: out.code, map: out.map }
  // A linha do hint desloca o código uma linha: o mapa ganha uma linha vazia no começo.
  const map = out.map && typeof out.map === 'object' ? { ...out.map, mappings: ';' + out.map.mappings } : out.map
  return { code: `${HINT}\n${out.code}`, map }
}
