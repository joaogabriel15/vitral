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

/** O que um arquivo exporta, com os `from` já resolvidos. Não depende de outros arquivos. */
export interface Parsed {
  /** Exports declarados no próprio arquivo: nome → origem. */
  local: Map<string, string>
  /** Reexports por nome: `export { a as b } from`, ou `import { a }` + `export { a as b }`. */
  named: { exported: string; source?: string; name: string; fallback: string }[]
  /** `export * from`. */
  star: string[]
}

/**
 * Nome exportado → origem. Primeiro lê cada arquivo alcançado pelos
 * reexports (a leitura de um arquivo nunca espera a de outro, então leituras
 * paralelas com ciclos não se travam); depois resolve as origens de uma vez.
 * `cache` guarda as leituras durante o build.
 */
export async function exportOrigins(ctx: ParseContext, file: string, cache: Map<string, Promise<Parsed>>): Promise<Origins> {
  const parsed = new Map<string, Parsed>()
  const queue = [file]
  while (queue.length) {
    const f = queue.shift()!
    if (parsed.has(f)) continue
    let p = cache.get(f)
    if (!p) cache.set(f, (p = read(ctx, f)))
    const done = await p
    parsed.set(f, done)
    queue.push(...done.star, ...done.named.flatMap((n) => (n.source ? [n.source] : [])))
  }
  return origins(file, parsed, new Map(), [])
}

function origins(file: string, parsed: Map<string, Parsed>, memo: Map<string, Origins>, stack: string[]): Origins {
  // Reexport circular: o arquivo que já está sendo resolvido conta como vazio aqui.
  if (stack.includes(file)) return new Map()
  const known = memo.get(file)
  if (known) return known
  const p = parsed.get(file)!
  const next = [...stack, file]
  const out: Origins = new Map(p.local)
  for (const n of p.named) out.set(n.exported, (n.source && origins(n.source, parsed, memo, next).get(n.name)) || n.fallback)
  // `export *` não leva `default` nem sobrescreve um nome explícito.
  for (const s of p.star) for (const [name, origin] of origins(s, parsed, memo, next)) if (name !== 'default' && !out.has(name)) out.set(name, origin)
  memo.set(file, out)
  return out
}

async function read(ctx: ParseContext, file: string): Promise<Parsed> {
  const out: Parsed = { local: new Map(), named: [], star: [] }
  const info = await ctx.load({ id: file })
  if (!info.code) return out
  const body: any[] = ctx.parse(info.code).body ?? []
  const target = async (source: string) => {
    // Sem skipSelf: os `paths` do tsconfig do pacote moram no próprio plugin.
    const r = await ctx.resolve(source, file, { skipSelf: false })
    return r && !r.external ? r.id : undefined
  }
  const imports = new Map<string, { source: string; name: string }>()
  for (const n of body)
    if (n.type === 'ImportDeclaration')
      for (const s of n.specifiers)
        if (s.type !== 'ImportNamespaceSpecifier')
          imports.set(s.local.name, { source: n.source.value, name: s.type === 'ImportDefaultSpecifier' ? 'default' : nameOf(s.imported) })
  for (const n of body) {
    if (n.type === 'ExportDefaultDeclaration') out.local.set('default', `${file}#default`)
    else if (n.type === 'ExportAllDeclaration') {
      if (n.exported) out.local.set(nameOf(n.exported), `${file}#${nameOf(n.exported)}`)
      else {
        const t = await target(n.source.value)
        if (t) out.star.push(t)
      }
    } else if (n.type === 'ExportNamedDeclaration') {
      if (n.exportKind === 'type') continue
      if (n.declaration) {
        const d = n.declaration
        const names = d.type === 'VariableDeclaration' ? d.declarations.flatMap((x: any) => bindings(x.id)) : d.id ? [d.id.name] : []
        for (const name of names) out.local.set(name, `${file}#${name}`)
      }
      for (const s of n.specifiers ?? []) {
        if (s.exportKind === 'type') continue
        const exported = nameOf(s.exported)
        const local = nameOf(s.local)
        const via = n.source ? { source: n.source.value, name: local } : imports.get(local)
        const fallback = `${file}#${n.source ? exported : local}`
        out.named.push({ exported, name: via?.name ?? local, source: via ? await target(via.source) : undefined, fallback })
      }
    }
  }
  return out
}
