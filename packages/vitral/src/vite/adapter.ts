/**
 * Remote sem adaptador: o plugin olha os plugins de framework do projeto e
 * gera uma entrada virtual que embrulha o `export default` com o adaptador
 * certo. Um export que já tem `mount` é usado como está.
 */
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

export type AdapterName = 'react' | 'vue' | 'svelte' | 'solid' | 'preact' | 'angular' | 'element'

/** Nome do plugin do Vite → adaptador. A ordem importa: o preset do Preact vem antes do React. */
const PLUGINS: Array<[RegExp, AdapterName]> = [
  [/^(preact:|prefresh$)/, 'preact'],
  [/^vite:react/, 'react'],
  [/^vite:vue$/, 'vue'],
  [/^vite-plugin-svelte/, 'svelte'],
  [/^solid$/, 'solid'],
  [/^@analogjs\/vite-plugin-angular$/, 'angular'],
]

/** Descobre o framework pelos plugins do Vite. Sem nenhum, usa `element` (Web Component ou JS puro). */
export function detectAdapter(plugins: readonly { name: string }[]): AdapterName {
  for (const [re, adapter] of PLUGINS) if (plugins.some((p) => re.test(p.name))) return adapter
  return 'element'
}

/** Função que embrulha um componente, por adaptador. */
const WRAP: Record<Exclude<AdapterName, 'element'>, [string, string]> = {
  react: ['vitral/react', 'reactRemote'],
  vue: ['vitral/vue', 'vueRemote'],
  svelte: ['vitral/svelte', 'svelteRemote'],
  solid: ['vitral/solid', 'solidRemote'],
  preact: ['vitral/preact', 'preactRemote'],
  angular: ['vitral/angular', 'angularRemote'],
}

/** Id que vai em `build.lib.entry`; o `resolveId` do plugin troca pelo módulo virtual. */
export const ENTRY_ID = '__vitral_entry__.js'
export const VIRTUAL_ENTRY = '\0vitral:entry'

/**
 * Código da entrada virtual. `scope` dá nome à tag de um Web Component que
 * ainda não foi registrado.
 */
export function entryCode(file: string, adapter: AdapterName, scope: string): string {
  const head = `import * as m from ${JSON.stringify(file)}\nconst c = m.default ?? m\n`
  if (adapter !== 'element') {
    const [from, fn] = WRAP[adapter]
    return `${head}import { ${fn} as wrap } from '${from}'\nexport default typeof c?.mount === 'function' ? c : wrap(c)\n`
  }
  // Sem framework: Web Component (Lit, Stencil, vanilla) ou função que devolve html``.
  return `${head}import { elementRemote } from 'vitral/element'
import { component } from 'vitral'
function wrap(c) {
  if (typeof c === 'function' && typeof HTMLElement !== 'undefined' && c.prototype instanceof HTMLElement) {
    const base = ${JSON.stringify(`${scope}-remote`.toLowerCase().replace(/^[^a-z]+/, 'x-'))}
    let tag = customElements.getName?.(c) || base
    // Uma tag não aceita outra classe: no HMR, a classe nova ganha tag nova.
    for (let n = 2; customElements.get(tag) && customElements.get(tag) !== c; n++) tag = base + '-' + n
    return elementRemote(tag, () => customElements.get(tag) || customElements.define(tag, c))
  }
  if (typeof c === 'function') return component(c)
  throw new Error('[vitral] o export default não é um remote: exporte um componente, uma função ou um objeto com mount()')
}
export default typeof c?.mount === 'function' ? c : wrap(c)
`
}

const CANDIDATES = ['src/remote', 'src/App', 'src/app']
const EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js', '.vue', '.svelte']

/** Entrada padrão quando o projeto não informa `entry`. */
export function findEntry(root: string): string | undefined {
  for (const base of CANDIDATES) {
    for (const ext of EXTENSIONS) if (existsSync(resolve(root, base + ext))) return base + ext
  }
}
