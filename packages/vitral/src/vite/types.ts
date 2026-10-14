/**
 * Tipos das props entre deploys: o plugin lê o tipo das props do
 * `export default` com o TypeScript do projeto e publica `vitral.d.ts` ao lado
 * do manifesto. `npx vitral types`, no host, junta esses arquivos.
 *
 * O tipo sai expandido (sem imports), para valer em outro repositório. Tipos
 * de bibliotecas (ReactNode, por exemplo) viram `unknown`.
 */
import { createRequire } from 'node:module'
import { join } from 'node:path'
import type * as TS from 'typescript'

/** Cabeçalho e formato do `vitral.d.ts`. O `vitral types` lê a linha `export type Props`. */
export function typesFile(name: string, props: string): string {
  return `// Props do remote ${JSON.stringify(name)}, geradas pelo vitral. Não edite.\nexport type Props = ${props}\n`
}

async function loadTs(root: string): Promise<typeof TS | null> {
  try {
    return createRequire(join(root, 'package.json'))('typescript')
  } catch {
    try {
      return (await import('typescript')).default
    } catch {
      return null
    }
  }
}

/**
 * Tipo das props do `export default` de `file`, já como texto. `null` quando
 * não há TypeScript no projeto ou a entrada não é TS/JS (`.vue`, `.svelte`).
 */
export async function extractProps(root: string, file: string): Promise<string | null> {
  if (!/\.[cm]?[jt]sx?$/.test(file)) return null
  const ts = await loadTs(root)
  if (!ts) return null
  const configPath = ts.findConfigFile(root, ts.sys.fileExists)
  const base: TS.CompilerOptions = configPath
    ? ts.parseJsonConfigFileContent(ts.readConfigFile(configPath, ts.sys.readFile).config, ts.sys, root).options
    : {}
  const options: TS.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.Preserve,
    strict: true,
    ...base,
    allowJs: true,
    skipLibCheck: true,
    noEmit: true,
  }
  const program = ts.createProgram([file], options)
  const checker = program.getTypeChecker()
  const source = program.getSourceFile(file)
  const moduleSymbol = source && checker.getSymbolAtLocation(source)
  let symbol = moduleSymbol && checker.getExportsOfModule(moduleSymbol).find((s) => s.escapedName === 'default')
  if (!source || !symbol) return null
  if (symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol)
  const type = checker.getTypeOfSymbolAtLocation(symbol, source)
  const props = propsOf(checker, type, source)
  return props ? new Printer(ts, checker, program).print(props, 0, true) : 'Record<string, unknown>'
}

/** `mount(el, props)`, componente-função `(props)` ou classe com `props`. */
function propsOf(checker: TS.TypeChecker, type: TS.Type, at: TS.Node): TS.Type | undefined {
  const param = (t: TS.Type, i: number) => {
    const p = t.getCallSignatures()[0]?.parameters[i]
    return p && checker.getTypeOfSymbolAtLocation(p, at)
  }
  const mount = type.getProperty('mount')
  if (mount) return param(checker.getTypeOfSymbolAtLocation(mount, at), 1)
  if (type.getCallSignatures().length) return param(type, 0)
  const ctor = type.getConstructSignatures()[0]
  const props = ctor?.getReturnType().getProperty('props')
  return props && checker.getTypeOfSymbolAtLocation(props, at)
}

class Printer {
  private seen = new Set<TS.Type>()
  constructor(
    private ts: typeof TS,
    private checker: TS.TypeChecker,
    private program: TS.Program,
  ) {}

  /** Declarado na lib padrão (Date, Map…): vale em qualquer projeto pelo nome. */
  private fromLib(type: TS.Type) {
    const decl = (type.aliasSymbol ?? type.getSymbol())?.declarations?.[0]
    return !!decl && this.program.isSourceFileDefaultLibrary(decl.getSourceFile())
  }

  private fromPackage(type: TS.Type) {
    const decl = (type.aliasSymbol ?? type.getSymbol())?.declarations?.[0]
    return !!decl && /[/\\]node_modules[/\\]/.test(decl.getSourceFile().fileName)
  }

  print(type: TS.Type, depth: number, top = false): string {
    const { ts, checker } = this
    const f = type.flags
    if (f & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) return 'unknown'
    if (f & (ts.TypeFlags.StringLike | ts.TypeFlags.NumberLike | ts.TypeFlags.BooleanLike | ts.TypeFlags.BigIntLike | ts.TypeFlags.Null | ts.TypeFlags.Undefined | ts.TypeFlags.Void | ts.TypeFlags.Never | ts.TypeFlags.ESSymbolLike)) {
      return checker.typeToString(type)
    }
    if (type.isUnion()) {
      const parts = [...new Set(type.types.map((t) => this.print(t, depth)))]
      // true | false vira boolean
      if (parts.includes('true') && parts.includes('false')) parts.splice(parts.indexOf('true'), 1, 'boolean'), parts.splice(parts.indexOf('false'), 1)
      return parts.join(' | ')
    }
    if (type.isIntersection()) return type.types.map((t) => this.wrap(t, depth)).join(' & ')
    if (depth > 6 || this.seen.has(type)) return 'unknown'
    if (checker.isArrayType(type)) return `Array<${this.print(checker.getTypeArguments(type as TS.TypeReference)[0], depth + 1)}>`
    if (checker.isTupleType(type)) return `[${checker.getTypeArguments(type as TS.TypeReference).map((t) => this.print(t, depth + 1)).join(', ')}]`
    if (this.fromLib(type)) {
      // Date, Map<…>, Record<…>: o nome vale em qualquer projeto; os argumentos são expandidos.
      const args = type.aliasTypeArguments ?? ((type as TS.ObjectType).objectFlags & ts.ObjectFlags.Reference ? checker.getTypeArguments(type as TS.TypeReference) : [])
      const name = (type.aliasSymbol ?? type.getSymbol())!.name
      return args.length ? `${name}<${args.map((t) => this.print(t, depth + 1)).join(', ')}>` : checker.typeToString(type)
    }
    if (this.fromPackage(type)) return 'unknown'
    this.seen.add(type)
    try {
      const calls = type.getCallSignatures()
      const props = checker.getPropertiesOfType(type).filter((p) => !(top && p.name === 'vitral'))
      if (calls.length && !props.length) return this.signature(calls[0], depth)
      const fields = props.map((p) => {
        const optional = p.flags & ts.SymbolFlags.Optional ? '?' : ''
        const key = /^[A-Za-z_$][\w$]*$/.test(p.name) ? p.name : JSON.stringify(p.name)
        const t = checker.getTypeOfSymbol(p)
        return `${key}${optional}: ${this.print(optional ? checker.getNonNullableType(t) : t, depth + 1)}`
      })
      const index = type.getStringIndexType()
      if (index) fields.push(`[key: string]: ${this.print(index, depth + 1)}`)
      for (const c of calls) fields.push(this.signature(c, depth).replace(' =>', ':'))
      return fields.length ? `{ ${fields.join('; ')} }` : '{}'
    } finally {
      this.seen.delete(type)
    }
  }

  private wrap(type: TS.Type, depth: number) {
    const s = this.print(type, depth)
    return type.isUnion() ? `(${s})` : s
  }

  private signature(sig: TS.Signature, depth: number) {
    const params = sig.parameters.map((p, i) => `${/^[A-Za-z_$][\w$]*$/.test(p.name) ? p.name : `a${i}`}: ${this.print(this.checker.getTypeOfSymbol(p), depth + 1)}`)
    return `(${params.join(', ')}) => ${this.print(sig.getReturnType(), depth + 1)}`
  }
}
