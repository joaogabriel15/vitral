/**
 * Caminho rápido dos tipos das props: o Oxc (`isolatedDeclarationSync`) gera
 * a declaração da entrada sem checar tipos, e as props saem só da sintaxe
 * dessa declaração, sem montar um programa do TypeScript.
 *
 * O Oxc vem do `oxc-transform` do projeto ou do Vite 8 (rolldown). Ele só
 * funciona com tipos explícitos nos exports: se reclamar, ou se a declaração
 * tiver algo que este leitor não conhece (tipo de pacote com namespace,
 * genérico próprio, `typeof`, tipo condicional…), `propsFromOxc` devolve
 * `null` e o plugin usa o TypeScript, como antes.
 */
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import type * as TS from 'typescript'

export interface Oxc {
  isolatedDeclarationSync(filename: string, source: string, options?: object): { code: string; errors: { message: string }[] }
}

/** `oxc-transform` do projeto ou o Oxc do Vite 8 (`rolldown/experimental`). `null` sem nenhum. */
export async function loadOxc(root: string): Promise<Oxc | null> {
  const req = createRequire(join(root, 'package.json'))
  const ids = [() => req.resolve('oxc-transform'), () => createRequire(req.resolve('vite/package.json')).resolve('rolldown/experimental')]
  for (const id of ids) {
    try {
      const mod = (await import(pathToFileURL(id()).href)) as Partial<Oxc>
      if (typeof mod.isolatedDeclarationSync === 'function') return mod as Oxc
    } catch {
      // não instalado: tenta o próximo
    }
  }
  return null
}

/** Tipos da lib padrão que valem pelo nome em qualquer projeto (os argumentos são expandidos). */
const GLOBAL = /^(Date|RegExp|Error|Map|Set|WeakMap|WeakSet|Promise|PromiseLike|Record|Partial|Required|Readonly|Pick|Omit|URL|URLSearchParams|Blob|File|FormData|Headers|AbortSignal|EventTarget|Node|Element|Document|DocumentFragment|ShadowRoot|Window|(HTML|SVG)\w*Element|\w*Event)$/
const IDENT = /^[A-Za-z_$][\w$]*$/

/** Forma que o leitor não conhece: o plugin usa o TypeScript. */
class Unsupported extends Error {}
const unsupported = (): never => {
  throw new Unsupported()
}

type Decl = TS.InterfaceDeclaration | TS.TypeAliasDeclaration
interface Scope {
  file: string
  types: Map<string, Decl>
  values: Map<string, TS.Node>
  imports: Map<string, { from: string; name: string }>
  default?: TS.Node
}
type Found = { decl: Decl; scope: Scope } | 'package' | undefined

/**
 * Tipo das props do `export default` de `file`, já como texto, no mesmo
 * formato do caminho do TypeScript. `null` quando o Oxc reclama ou a forma
 * não é conhecida.
 */
export function propsFromOxc(ts: typeof TS, oxc: Oxc, file: string): string | null {
  try {
    const reader = new Reader(ts, oxc)
    const scope = reader.scope(file)
    const props = reader.defaultProps(scope)
    return props ? reader.print(props.node, props.scope, 0, { top: true }) : 'Record<string, unknown>'
  } catch {
    return null
  }
}

class Reader {
  private scopes = new Map<string, Scope>()
  private seen = new Set<Decl>()
  constructor(
    private ts: typeof TS,
    private oxc: Oxc,
  ) {}

  /** Declarações de um arquivo: `.d.ts` como está, o resto pelo Oxc. */
  scope(file: string): Scope {
    const cached = this.scopes.get(file)
    if (cached) return cached
    const { ts } = this
    let code = readFileSync(file, 'utf8')
    if (!/\.d\.[cm]?ts$/.test(file)) {
      const out = this.oxc.isolatedDeclarationSync(file, code, {})
      if (out.errors.length) unsupported()
      code = out.code
    }
    const source = ts.createSourceFile(file + '.d.ts', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
    const scope: Scope = { file, types: new Map(), values: new Map(), imports: new Map() }
    const isDefault = (n: TS.Node) => ts.canHaveModifiers(n) && !!ts.getModifiers(n)?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)
    let defaultName: string | undefined
    for (const st of source.statements) {
      if (ts.isInterfaceDeclaration(st) || ts.isTypeAliasDeclaration(st)) {
        // Interfaces que se juntam (duas declarações) ficam com o TypeScript.
        if (scope.types.has(st.name.text)) unsupported()
        scope.types.set(st.name.text, st)
      } else if (ts.isImportDeclaration(st) && ts.isStringLiteral(st.moduleSpecifier)) {
        const from = st.moduleSpecifier.text
        const clause = st.importClause
        if (clause?.name) scope.imports.set(clause.name.text, { from, name: 'default' })
        const bindings = clause?.namedBindings
        if (bindings && ts.isNamespaceImport(bindings)) scope.imports.set(bindings.name.text, { from, name: '*' })
        if (bindings && ts.isNamedImports(bindings)) for (const el of bindings.elements) scope.imports.set(el.name.text, { from, name: (el.propertyName ?? el.name).text })
      } else if (ts.isFunctionDeclaration(st) || ts.isClassDeclaration(st)) {
        if (isDefault(st)) scope.default ??= st
        else if (st.name && !scope.values.has(st.name.text)) scope.values.set(st.name.text, st)
      } else if (ts.isVariableStatement(st)) {
        for (const d of st.declarationList.declarations) if (ts.isIdentifier(d.name)) scope.values.set(d.name.text, d)
      } else if (ts.isExportAssignment(st) && !st.isExportEquals) {
        defaultName = ts.isIdentifier(st.expression) ? st.expression.text : unsupported()
      } else if (ts.isExportDeclaration(st) && !st.moduleSpecifier && st.exportClause && ts.isNamedExports(st.exportClause)) {
        const el = st.exportClause.elements.find((e) => e.name.text === 'default')
        if (el) defaultName = (el.propertyName ?? el.name).text
      }
    }
    if (defaultName) scope.default = scope.values.get(defaultName)
    this.scopes.set(file, scope)
    return scope
  }

  /** `mount(el, props)`, componente-função `(props)` ou classe com `props`. `undefined`: sem props. */
  defaultProps(scope: Scope): { node: TS.TypeNode; scope: Scope } | undefined {
    const { ts } = this
    const node = scope.default ?? unsupported()
    const param = (params: TS.NodeArray<TS.ParameterDeclaration>, i: number) => {
      const p = params[i]
      return p && { node: p.type ?? unsupported(), scope }
    }
    if (ts.isFunctionDeclaration(node)) return param(node.parameters, 0)
    if (ts.isClassDeclaration(node)) {
      if (node.heritageClauses?.length) unsupported()
      const props = node.members.find((m) => ts.isPropertyDeclaration(m) && m.name.getText() === 'props') as TS.PropertyDeclaration | undefined
      return props && { node: props.type ?? unsupported(), scope }
    }
    if (ts.isVariableDeclaration(node)) return this.propsOfType(node.type ?? unsupported(), scope)
    return unsupported()
  }

  private propsOfType(node: TS.TypeNode, scope: Scope): { node: TS.TypeNode; scope: Scope } | undefined {
    const { ts } = this
    const param = (params: TS.NodeArray<TS.ParameterDeclaration>, i: number, at: Scope) => {
      const p = params[i]
      return p && { node: p.type ?? unsupported(), scope: at }
    }
    if (ts.isParenthesizedTypeNode(node)) return this.propsOfType(node.type, scope)
    if (ts.isFunctionTypeNode(node)) return param(node.parameters, 0, scope)
    let members: TS.NodeArray<TS.TypeElement>
    let at = scope
    if (ts.isTypeLiteralNode(node)) members = node.members
    else if (ts.isTypeReferenceNode(node) && ts.isIdentifier(node.typeName) && !node.typeArguments) {
      const found = this.lookup(node.typeName.text, scope)
      if (!found || found === 'package' || found.decl.typeParameters) return unsupported()
      if (ts.isTypeAliasDeclaration(found.decl)) return this.propsOfType(found.decl.type, found.scope)
      if (found.decl.heritageClauses?.length) unsupported()
      members = found.decl.members
      at = found.scope
    } else return unsupported()
    const mount = members.find((m) => m.name?.getText() === 'mount')
    if (mount) {
      if (ts.isMethodSignature(mount)) return param(mount.parameters, 1, at)
      if (ts.isPropertySignature(mount) && mount.type) return this.mountProps(mount.type, at)
      return unsupported()
    }
    const call = members.find(ts.isCallSignatureDeclaration)
    if (call) return param(call.parameters, 0, at)
    // Sem mount e sem assinatura: o TypeScript também não acha props.
    if (members.some(ts.isConstructSignatureDeclaration)) unsupported()
    return undefined
  }

  private mountProps(node: TS.TypeNode, scope: Scope): { node: TS.TypeNode; scope: Scope } | undefined {
    const { ts } = this
    if (ts.isParenthesizedTypeNode(node)) return this.mountProps(node.type, scope)
    if (!ts.isFunctionTypeNode(node)) return unsupported()
    const p = node.parameters[1]
    return p && { node: p.type ?? unsupported(), scope }
  }

  /** Acha um tipo pelo nome: no arquivo, num import relativo ou num pacote. */
  private lookup(name: string, scope: Scope): Found {
    const decl = scope.types.get(name)
    if (decl) return { decl, scope }
    const imp = scope.imports.get(name)
    if (!imp) return undefined
    if (!imp.from.startsWith('.')) return 'package'
    if (imp.name === 'default' || imp.name === '*') return unsupported()
    const found = this.lookup(imp.name, this.scope(resolveFile(scope.file, imp.from)))
    return found ?? unsupported()
  }

  print(node: TS.TypeNode, scope: Scope, depth: number, opts: { top?: boolean; nonNull?: boolean } = {}): string {
    const { ts } = this
    const K = ts.SyntaxKind
    switch (node.kind) {
      case K.AnyKeyword:
      case K.UnknownKeyword:
        return 'unknown'
      case K.StringKeyword:
      case K.NumberKeyword:
      case K.BooleanKeyword:
      case K.BigIntKeyword:
      case K.SymbolKeyword:
      case K.UndefinedKeyword:
      case K.VoidKeyword:
      case K.NeverKeyword:
        return node.getText()
    }
    if (ts.isLiteralTypeNode(node)) {
      const lit = node.literal
      if (ts.isStringLiteral(lit)) return JSON.stringify(lit.text)
      if (lit.kind === K.NullKeyword || lit.kind === K.TrueKeyword || lit.kind === K.FalseKeyword || ts.isNumericLiteral(lit) || ts.isPrefixUnaryExpression(lit)) return lit.getText()
      return unsupported()
    }
    if (ts.isParenthesizedTypeNode(node)) return this.print(node.type, scope, depth, opts)
    if (ts.isUnionTypeNode(node)) {
      // Prop opcional: sem null/undefined, como o getNonNullableType do TypeScript.
      const types = opts.nonNull ? node.types.filter((t) => t.kind !== K.UndefinedKeyword && !(ts.isLiteralTypeNode(t) && t.literal.kind === K.NullKeyword)) : node.types
      const parts = [...new Set(types.map((t) => this.print(t, scope, depth)))]
      // true | false vira boolean
      if (parts.includes('true') && parts.includes('false')) parts.splice(parts.indexOf('true'), 1, 'boolean'), parts.splice(parts.indexOf('false'), 1)
      return parts.join(' | ')
    }
    if (ts.isIntersectionTypeNode(node)) {
      return node.types.map((t) => {
        const s = this.print(t, scope, depth)
        return ts.isUnionTypeNode(t) ? `(${s})` : s
      }).join(' & ')
    }
    if (depth > 6) return 'unknown'
    if (ts.isArrayTypeNode(node)) return `Array<${this.print(node.elementType, scope, depth + 1)}>`
    if (ts.isTypeOperatorNode(node) && node.operator === K.ReadonlyKeyword && (ts.isArrayTypeNode(node.type) || ts.isTupleTypeNode(node.type))) return this.print(node.type, scope, depth)
    if (ts.isTupleTypeNode(node)) {
      if (node.elements.some((e) => ts.isNamedTupleMember(e) || ts.isOptionalTypeNode(e) || ts.isRestTypeNode(e))) unsupported()
      return `[${node.elements.map((e) => this.print(e, scope, depth + 1)).join(', ')}]`
    }
    if (ts.isTypeLiteralNode(node)) return this.object(node.members, scope, depth, !!opts.top)
    if (ts.isFunctionTypeNode(node)) return this.signature(node, scope, depth)
    if (ts.isTypeReferenceNode(node)) return this.reference(node, scope, depth, opts)
    return unsupported()
  }

  private reference(node: TS.TypeReferenceNode, scope: Scope, depth: number, opts: { top?: boolean; nonNull?: boolean }): string {
    const { ts } = this
    if (!ts.isIdentifier(node.typeName)) return unsupported()
    const name = node.typeName.text
    const args = node.typeArguments ?? []
    const found = this.lookup(name, scope)
    // Tipos de bibliotecas (ReactNode…) viram unknown, como no caminho do TypeScript.
    if (found === 'package') return 'unknown'
    if (found) {
      if (args.length || found.decl.typeParameters) unsupported()
      if (this.seen.has(found.decl)) return 'unknown'
      this.seen.add(found.decl)
      try {
        const decl = found.decl
        if (ts.isTypeAliasDeclaration(decl)) return this.print(decl.type, found.scope, depth, opts)
        if (decl.heritageClauses?.length) unsupported()
        return this.object(decl.members, found.scope, depth, !!opts.top)
      } finally {
        this.seen.delete(found.decl)
      }
    }
    if ((name === 'Array' || name === 'ReadonlyArray') && args.length === 1) return `Array<${this.print(args[0], scope, depth + 1)}>`
    if (!GLOBAL.test(name)) return unsupported()
    return args.length ? `${name}<${args.map((t) => this.print(t, scope, depth + 1)).join(', ')}>` : name
  }

  private object(members: TS.NodeArray<TS.TypeElement>, scope: Scope, depth: number, top: boolean): string {
    const { ts } = this
    const fields: string[] = []
    const calls: string[] = []
    let index: string | undefined
    for (const m of members) {
      if (ts.isPropertySignature(m) || ts.isMethodSignature(m)) {
        const name = ts.isIdentifier(m.name) || ts.isStringLiteral(m.name) || ts.isNumericLiteral(m.name) ? m.name.text : unsupported()
        if (top && name === 'vitral') continue
        const optional = m.questionToken ? '?' : ''
        const key = IDENT.test(name) ? name : JSON.stringify(name)
        const type = ts.isMethodSignature(m) ? this.signature(m, scope, depth + 1) : m.type ? this.print(m.type, scope, depth + 1, { nonNull: !!optional }) : 'unknown'
        fields.push(`${key}${optional}: ${type}`)
      } else if (ts.isIndexSignatureDeclaration(m)) {
        const key = m.parameters[0]?.type
        if (!key || key.kind !== ts.SyntaxKind.StringKeyword) unsupported()
        index = `[key: string]: ${this.print(m.type, scope, depth + 1)}`
      } else if (ts.isCallSignatureDeclaration(m)) {
        calls.push(this.signature(m, scope, depth))
      } else unsupported()
    }
    if (calls.length && !fields.length) return calls[0]
    if (index) fields.push(index)
    for (const c of calls) fields.push(c.replace(' =>', ':'))
    return fields.length ? `{ ${fields.join('; ')} }` : '{}'
  }

  private signature(sig: TS.SignatureDeclarationBase, scope: Scope, depth: number): string {
    const { ts } = this
    if (sig.typeParameters?.length || !sig.type) unsupported()
    const params = sig.parameters.map((p, i) => {
      if (p.dotDotDotToken || (ts.isIdentifier(p.name) && p.name.text === 'this')) unsupported()
      const name = ts.isIdentifier(p.name) && IDENT.test(p.name.text) ? p.name.text : `a${i}`
      const type = p.type ? this.print(p.type, scope, depth + 1) : 'unknown'
      return `${name}: ${p.questionToken || p.initializer ? `${type} | undefined` : type}`
    })
    return `(${params.join(', ')}) => ${this.print(sig.type!, scope, depth + 1)}`
  }
}

/** `./tipos` → `./tipos.ts`, `./tipos.tsx`, `./tipos/index.ts`… (e `./tipos.js` → `./tipos.ts`). */
function resolveFile(from: string, spec: string): string {
  const base = resolve(dirname(from), spec)
  const stem = base.replace(/\.[cm]?jsx?$/, '')
  const candidates = [base, ...['.ts', '.tsx', '.mts', '.cts', '.d.ts'].map((ext) => stem + ext), ...['index.ts', 'index.tsx', 'index.d.ts'].map((f) => join(base, f))]
  const file = candidates.find((f) => /\.[cm]?tsx?$/.test(f) && existsSync(f))
  return file ?? unsupported()
}
