# Props e eventos

Props levam dados do host para um remote. Eventos levam avisos entre quaisquer partes da página.

## Quando usar

| Use | Para | Exemplo |
| --- | --- | --- |
| props | Dados de uma instância do remote | `userId`, `produtoId`, callbacks |
| `events` | Avisos pontuais entre host e remotes | "item adicionado", "usuário saiu" |
| `navigate` | Trocar de página de dentro de um remote | `/pedidos/42` |
| [Contexto compartilhado](./contexto) | Estado que vários leem | usuário logado, tema |

## Props

```jsx
<Remote name="carrinho" props={{ userId, aoFinalizar: (pedido) => irPara(pedido) }} />
```

O remote recebe em `mount` e depois em `update`. Funções também passam. Mudar props não remonta o remote.

No `<vitral-remote>`, o atributo `props` só aceita JSON. Para funções, use a propriedade `el.props`.

## Eventos

```ts
import { events } from 'vitral'

events.emit('carrinho:total', 120)
const parar = events.on('carrinho:total', (total) => console.log(total))
events.last('carrinho:total') // 120
parar()
```

Dentro do remote, use `ctx.events`. O que o remote assina por ele é cancelado no unmount:

```ts
mount(el, props, ctx) {
  ctx.events.on('auth:usuario', (u) => (el.dataset.usuario = u.nome))
  return { unmount() {} }
}
```

- Host e todos os remotes usam o mesmo barramento.
- `last(tipo)` devolve o último valor, mesmo para quem assinou depois do `emit`.
- Um handler que lança erro não impede os outros.
- Use um prefixo no nome (`carrinho:`) para saber quem emite.

| Método | O que faz |
| --- | --- |
| `emit(tipo, valor)` | Envia o evento |
| `on(tipo, fn)` | Assina. Devolve a função que cancela |
| `last(tipo)` | Último valor emitido |

Hooks: `useEvent` e `useEventValue` em [React](/frameworks/react) e [Vue](/frameworks/vue).

Para um barramento separado, só seu: `createEventBus()`.

## Navegação

```ts
import { navigate } from 'vitral'

navigate('/pedidos/42')
navigate('/login', { replace: true })
```

`navigate` atualiza o histórico e dispara `popstate`. React Router, Vue Router, Next, Nuxt e os outros roteadores leem a URL nova. URL de outra origem recarrega a página. Dentro do remote, `ctx.navigate` faz o mesmo.
