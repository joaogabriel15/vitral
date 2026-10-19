# Testes

`vitral/testing` registra remotes falsos para testar o host sem rede.

## Quando usar

Em testes de unidade do host e do remote, com happy-dom ou jsdom.

## Host

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

test('mostra o erro', async () => {
  failingRemote('recomendacoes')
  render(<App />)
  await screen.findByText('Tentar de novo')
})
```

| Função | O que faz |
| --- | --- |
| `mockRemote(nome, render?)` | Registra um remote local. `render(el, props, ctx)` roda no mount e em cada update |
| `failingRemote(nome, mensagem?)` | Registra um remote que falha ao montar |
| `resetVitral()` | Limpa o estado da lib entre testes |

O objeto de `mockRemote` tem `mounts`, `lastProps`, `ctx` e `mounted`.

## Remote

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
