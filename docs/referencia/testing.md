# vitral/testing

Remotes falsos para testar o host sem rede, harness para testar o remote e contratos entre os dois.

```ts
mockRemote<P>(name: string, render?: (el, props, ctx) => void): MockRemote<P>
failingRemote(name: string, message?: string): void
resetVitral(): void
harness<P>(mod: RemoteModule<P>, options: HarnessOptions<P>): Promise<Harness<P>>
record(options?: { host?: string; max?: number }): Recorder
verify(contract: Contract, mod: RemoteModule, options?: { sources?: string[]; wait?: number }): Promise<VerifyResult>
```

## Uso

```ts
import { mockRemote, failingRemote, resetVitral } from 'vitral/testing'

afterEach(() => resetVitral())

test('passa os itens', async () => {
  const carrinho = mockRemote('carrinho', (el, props) => (el.textContent = `itens: ${props.itens}`))
  render(<App />)
  await screen.findByText('itens: 2')
  expect(carrinho.lastProps).toEqual({ itens: 2 })
})
```

## Funções

| Função | O que faz |
| --- | --- |
| `mockRemote(nome, render?)` | Registra um remote local. `render` roda no mount e em cada update |
| `failingRemote(nome, mensagem?)` | Registra um remote que falha ao montar |
| `resetVitral()` | Limpa o estado da lib entre testes |
| `harness(mod, { props })` | Monta um remote com `ctx` simulado. Veja [Contratos](/aprender/contratos#_1-testar-o-remote-sozinho) |
| `record({ host })` | Grava o contrato do consumidor no host: `contracts()`, `save(pasta)` e `stop()` |
| `verify(contrato, mod)` | Reproduz um contrato. Devolve `{ cases, failures, warnings }`. É o que `vitral test --contract` roda |
| `CONTRACT_SCHEMA` | URL do JSON Schema do contrato |

## Retorno de mockRemote

| Campo | O que é |
| --- | --- |
| `mounts` | Quantas vezes montou |
| `lastProps` | Props mais recentes |
| `ctx` | Contexto da última montagem |
| `mounted` | Está montado agora |
