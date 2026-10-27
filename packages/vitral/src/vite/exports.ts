/**
 * De onde vem cada export de um módulo, seguindo `export *`, `export { x } from`
 * e `import { x } ...; export { x }`. A origem é `arquivo#nome` do binding
 * declarado. Dois exports com a mesma origem são o mesmo valor em runtime:
 * é assim que o dedupe sabe que um arquivo interno do pacote também sai por
 * um especificador público.
 */
export interface ParseContext {
  resolve(id: string, importer?: string, options?: { skipSelf?: boolean }): Promise<{ id: string; external?: boolean | string } | null>
  load(options: { id: string }): Promise<{ code?: string | null }>
  parse(code: string): any
  warn?(message: string): void
}

type Origins = Map<string, string>

const nameOf = (n: any): string => (n.type === 'Identifier' ? n.name : String(n.value))

/** Identificadores declarados por um padrão (`const { a, b: [c] } = ...`). */
function bindings(node: any, out: string[] = []): string[] {
  if (!node) return out
  if (node.type === 'Identifier') out.push(node.name)
  else if (node.type === 'ObjectPattern') for (const p of node.properties) bindings(p.type === 'RestElement' ? p.argument : p.value, out)
  else if (node.type === 'ArrayPattern') for (const e of node.elements) bindings(e?.type === 'RestElement' ? e.argument : e, out)
  else if (node.type === 'AssignmentPattern') bindings(node.left, out)
  else if (node.type === 'RestElement') bindings(node.argument, out)
  return out
}

/** Nome exportado → origem. O resultado fica em `cache`, por arquivo, durante o build. */
export function exportOrigins(ctx: ParseContext, file: string, cache: Map<string, Promise<Origins>>, stack: string[] = []): Promise<Origins> {
  // Reexport circular: o arquivo que já está sendo lido conta como vazio aqui.
  // shortcut: dois ciclos que começam em leituras paralelas diferentes ainda se esperam; serializar as leituras se aparecer.
  if (stack.includes(file)) return Promise.resolve(new Map())
  let found = cache.get(file)
  if (!found) cache.set(file, (found = read(ctx, file, cache, [...stack, file])))
  return found
}

async function read(ctx: ParseContext, file: string, cache: Map<string, Promise<Origins>>, stack: string[]): Promise<Origins> {
  const out: Origins = new Map()
  const info = await ctx.load({ id: file })
  if (!info.code) return out
  const body: any[] = ctx.parse(info.code).body ?? []
  const target = async (source: string) => {
    // Sem skipSelf: os `paths` do tsconfig do pacote moram no próprio plugin.
    const r = await ctx.resolve(source, file, { skipSelf: false })
    return r && !r.external ? r.id : undefined
  }
  const from = async (source: string, name: string) => {
    const t = await target(source)
    return t && (await exportOrigins(ctx, t, cache, stack)).get(name)
  }
  const imports = new Map<string, { source: string; name: string }>()
  for (const n of body)
    if (n.type === 'ImportDeclaration')
      for (const s of n.specifiers)
        if (s.type !== 'ImportNamespaceSpecifier')
          imports.set(s.local.name, { source: n.source.value, name: s.type === 'ImportDefaultSpecifier' ? 'default' : nameOf(s.imported) })
  const star: string[] = []
  for (const n of body) {
    if (n.type === 'ExportDefaultDeclaration') out.set('default', `${file}#default`)
    else if (n.type === 'ExportAllDeclaration') {
      if (n.exported) out.set(nameOf(n.exported), `${file}#${nameOf(n.exported)}`)
      else star.push(n.source.value)
    } else if (n.type === 'ExportNamedDeclaration') {
      if (n.exportKind === 'type') continue
      if (n.declaration) {
        const d = n.declaration
        const names = d.type === 'VariableDeclaration' ? d.declarations.flatMap((x: any) => bindings(x.id)) : d.id ? [d.id.name] : []
        for (const name of names) out.set(name, `${file}#${name}`)
      }
      for (const s of n.specifiers ?? []) {
        if (s.exportKind === 'type') continue
        const exported = nameOf(s.exported)
        const local = nameOf(s.local)
        const via = n.source ? { source: n.source.value, name: local } : imports.get(local)
        out.set(exported, (via && (await from(via.source, via.name))) || `${file}#${n.source ? exported : local}`)
      }
    }
  }
  // `export *` não leva `default` nem sobrescreve um nome explícito.
  for (const source of star) {
    const t = await target(source)
    if (!t) continue
    for (const [name, origin] of await exportOrigins(ctx, t, cache, stack)) if (name !== 'default' && !out.has(name)) out.set(name, origin)
  }
  return out
}
