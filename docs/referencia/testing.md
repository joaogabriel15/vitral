# vitral/testing

Remotes falsos para testar o host sem rede.

```ts
mockRemote<P>(name: string, render?: (el, props, ctx) => void): MockRemote<P>
failingRemote(name: string, message?: string): void
resetVitral(): void
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

## Retorno de mockRemote

| Campo | O que é |
| --- | --- |
| `mounts` | Quantas vezes montou |
| `lastProps` | Props mais recentes |
| `ctx` | Contexto da última montagem |
| `mounted` | Está montado agora |
