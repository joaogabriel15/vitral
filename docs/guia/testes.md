# Testes

## Testes do host

`vitral/testing` registra remotes falsos. O host renderiza sem baixar nada.

```ts
import { mockRemote, failingRemote, resetVitral } from 'vitral/testing'
import { render, screen } from '@testing-library/react'

afterEach(() => resetVitral())

test('passa os itens para o carrinho', async () => {
  const carrinho = mockRemote('carrinho', (el, props) => (el.textContent = `itens: ${props.itens}`))
  render(<App />)
  await screen.findByText('itens: 2')
  expect(carrinho.lastProps).toEqual({ itens: 2 })
  expect(carrinho.mounts).toBe(1)
})

test('mostra o erro quando o remote falha', async () => {
  failingRemote('recomendacoes')
  render(<App />)
  await screen.findByText('Tentar de novo')
})
```

| Função | O que faz |
| --- | --- |
| `mockRemote(nome, render?)` | Registra um remote local. `render(el, props, ctx)` roda no mount e a cada update |
| `failingRemote(nome, mensagem?)` | Registra um remote que lança erro ao montar |
| `resetVitral()` | Apaga o estado global da lib entre testes |

O objeto de `mockRemote` tem `mounts`, `lastProps`, `ctx` e `mounted`.

Rode em um ambiente com DOM (happy-dom ou jsdom).

## Testes do remote

Monte o remote como o host montaria, com `register` e `mountRemote`:

```ts
import { register, mountRemote } from 'vitral'
import remote from '../src/remote'

test('mostra o nome', async () => {
  register('carrinho', { module: remote })
  const el = document.createElement('div')
  const montado = await mountRemote(el, 'carrinho', { nome: 'Ana' })
  expect(el.textContent).toContain('Ana')
  montado.update?.({ nome: 'Bia' })
  montado.unmount()
})
```

## Testes no navegador

Para testar o host com o remote de verdade, sirva o `dist` do remote e o host em portas diferentes e use Playwright. Os exemplos do repositório fazem isso com 9 hosts e 8 remotes: veja [`e2e/`](https://github.com/joaogabriel15/vitral/tree/main/e2e).
