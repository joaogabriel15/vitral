/**
 * `npx vitral mcp`: servidor MCP (Model Context Protocol) por stdio, para
 * agentes consultarem o registro de remotes e adicionarem um ao host. É o
 * JSON-RPC mínimo do protocolo (uma mensagem por linha), sem dependência:
 * `initialize`, `ping`, `tools/list` e `tools/call`.
 */
import { createInterface } from 'node:readline'
import { add, defaultRegistry, loadRegistry, type RegistryItem } from './registry'

export interface McpOptions {
  /** Diretório do host, onde `add_remote` escreve. Padrão: `process.cwd()`. */
  cwd?: string
  /** URL ou arquivo do registro. Padrão: `VITRAL_REGISTRY` ou `vitral-registry.json`. */
  registry?: string
  /** Versão informada ao cliente. */
  version?: string
  fetch?: typeof fetch
}

interface Message {
  jsonrpc: '2.0'
  id?: string | number | null
  method?: string
  params?: Record<string, any>
}

type Response = { jsonrpc: '2.0'; id: string | number | null } & ({ result: unknown } | { error: { code: number; message: string } })

const PROTOCOL = '2025-06-18'

const registryArg = { registry: { type: 'string', description: 'URL ou arquivo do vitral-registry.json. Padrão: o do servidor.' } }

/** Ferramentas expostas. As descrições são o que o agente lê para escolher. */
export const TOOLS = [
  {
    name: 'list_remotes',
    description: 'Lista os remotes (micro-frontends) do registro vitral: nome, versão, dono, framework e descrição.',
    inputSchema: {
      type: 'object',
      properties: { ...registryArg, query: { type: 'string', description: 'Filtra por trecho do nome, dono, framework ou descrição.' } },
    },
  },
  {
    name: 'get_remote',
    description: 'Mostra um remote do registro: URL do manifesto, versão, hash e o tipo TypeScript das props, com um exemplo de uso no host.',
    inputSchema: { type: 'object', properties: { ...registryArg, name: { type: 'string', description: 'Nome do remote.' } }, required: ['name'] },
  },
  {
    name: 'add_remote',
    description: 'Adiciona um remote do registro ao remotes.json do host e gera os tipos das props (vitral-env.d.ts), como `npx vitral add`.',
    inputSchema: {
      type: 'object',
      properties: {
        ...registryArg,
        name: { type: 'string', description: 'Nome do remote.' },
        force: { type: 'boolean', description: 'Troca a URL se o remote já está no remotes.json com outra.' },
      },
      required: ['name'],
    },
  },
]

const text = (value: unknown, isError = false) => ({
  content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }],
  ...(isError && { isError: true }),
})

/** Exemplo de uso do remote no host, com as props do registro. */
function usage(item: RegistryItem): string {
  return [
    `import { Remote } from 'vitral/react'`,
    `<Remote name=${JSON.stringify(item.name)} props={props} />`,
    '',
    `// ou, sem framework:`,
    `import { mountRemote } from 'vitral'`,
    `await mountRemote(elemento, ${JSON.stringify(item.name)}, props)`,
    '',
    `// props: ${item.props ?? 'sem tipo publicado (o remote não publica vitral.d.ts)'}`,
  ].join('\n')
}

/** Cria o servidor. `handle` responde uma mensagem (ou nada, para notificações). */
export function mcpServer(options: McpOptions = {}): { handle(msg: Message): Promise<Response | undefined> } {
  const cwd = options.cwd ?? process.cwd()
  const get = options.fetch ?? fetch
  const source = (args: Record<string, any>) => (typeof args.registry === 'string' && args.registry) || options.registry || defaultRegistry()

  async function call(name: string, args: Record<string, any>) {
    const reg = await loadRegistry(source(args), cwd, get)
    if (name === 'list_remotes') {
      const q = typeof args.query === 'string' ? args.query.toLowerCase() : ''
      const items = reg.remotes
        .filter((r) => !q || [r.name, r.owner, r.framework, r.description].some((v) => v?.toLowerCase().includes(q)))
        .map(({ name, version, owner, framework, description }) => ({ name, version, owner, framework, description }))
      return text(items)
    }
    const item = reg.remotes.find((r) => r.name === args.name)
    if (!item) return text(`"${args.name}" não está no registro. Disponíveis: ${reg.remotes.map((r) => r.name).join(', ') || 'nenhum'}.`, true)
    if (name === 'get_remote') return text(`${JSON.stringify(item, null, 2)}\n\nUso:\n${usage(item)}`)
    const logs: string[] = []
    const falhas = await add({ cwd, names: [item.name], registry: source(args), force: args.force === true, fetch: get, log: (m) => logs.push(m) })
    return text(logs.join('\n'), falhas > 0)
  }

  return {
    async handle(msg) {
      const { id, method, params = {} } = msg
      // Notificação (sem id): não tem resposta.
      if (id === undefined) return undefined
      const ok = (result: unknown): Response => ({ jsonrpc: '2.0', id, result })
      const fail = (code: number, message: string): Response => ({ jsonrpc: '2.0', id, error: { code, message } })
      switch (method) {
        case 'initialize':
          return ok({
            protocolVersion: typeof params.protocolVersion === 'string' ? params.protocolVersion : PROTOCOL,
            capabilities: { tools: {} },
            serverInfo: { name: 'vitral', version: options.version ?? '0.0.0' },
            instructions: 'Registro de micro-frontends vitral. Use list_remotes para achar um remote, get_remote para ver as props e add_remote para adicioná-lo ao host.',
          })
        case 'ping':
          return ok({})
        case 'tools/list':
          return ok({ tools: TOOLS })
        case 'tools/call': {
          if (!TOOLS.some((t) => t.name === params.name)) return fail(-32602, `ferramenta desconhecida: ${params.name}`)
          try {
            return ok(await call(params.name, params.arguments ?? {}))
          } catch (err) {
            return ok(text((err as Error).message, true))
          }
        }
        default:
          return fail(-32601, `método desconhecido: ${method}`)
      }
    },
  }
}

/** Liga o servidor a um par de streams (stdin/stdout), uma mensagem JSON por linha. */
export function serveMcp(
  input: NodeJS.ReadableStream = process.stdin,
  output: NodeJS.WritableStream = process.stdout,
  options: McpOptions = {},
): Promise<void> {
  const server = mcpServer(options)
  const lines = createInterface({ input })
  const write = (res: Response | undefined) => res && output.write(JSON.stringify(res) + '\n')
  const pending: Promise<unknown>[] = []
  lines.on('line', (line) => {
    if (!line.trim()) return
    let msg: Message
    try {
      msg = JSON.parse(line)
    } catch {
      write({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'JSON inválido' } })
      return
    }
    pending.push(server.handle(msg).then(write))
  })
  // Termina quando a entrada fecha e as respostas em andamento saem.
  return new Promise((done) => lines.on('close', () => Promise.all(pending).then(() => done())))
}
