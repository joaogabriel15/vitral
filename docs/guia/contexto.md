# Comunicação e contexto

Host e remotes conversam de três jeitos:

| Use | Para | Exemplo |
| --- | --- | --- |
| props | Dados de uma instância, do host para o remote | `userId`, `produtoId` |
| `events` | Avisos pontuais entre quaisquer partes | "item adicionado", "usuário saiu" |
| `navigate` | Trocar de página de dentro de um remote | `/pedidos/42` |

## Props

O host passa, o remote recebe em `mount` e depois em `update`. Funções também passam:

```jsx
<Remote name="carrinho" props={{ userId, aoFinalizar: (pedido) => navegarPara(pedido) }} />
```

No `<vitral-remote>`, o atributo `props` só aceita JSON. Para funções, use a propriedade `el.props`.

## Eventos

```ts
import { events } from 'vitral'

events.emit('carrinho:total', 120)
const parar = events.on('carrinho:total', (total) => console.log(total))
events.last('carrinho:total') // 120
parar()
```

- Todos os remotes usam o mesmo barramento, mesmo com cópias ou versões diferentes da lib na página.
- `last(tipo)` devolve o último valor emitido. Serve para estado simples, como o usuário logado.
- Um handler que lança erro não impede os outros de rodar.
- Dentro do remote, use `ctx.events`: o que ele assina é cancelado no unmount.

Use um prefixo no nome do evento (`carrinho:`) para saber quem emite.

### Hooks

`vitral/react` e `vitral/vue` têm hooks que assinam enquanto o componente existe:

```jsx
import { useEvent, useEventValue } from 'vitral/react'

function Contador() {
  const total = useEventValue('carrinho:total') // re-renderiza a cada emit
  useEvent('carrinho:limpo', () => alert('Carrinho vazio'))
  return <span>{total ?? 0}</span>
}
```

Em Vue, `useEventValue` devolve uma `ShallowRef`.

## Navegação

```ts
import { navigate } from 'vitral'

navigate('/pedidos/42')
navigate('/login', { replace: true })
```

`navigate` atualiza o histórico e dispara `popstate`, que React Router, Vue Router, Next, Nuxt e os outros roteadores escutam. Também emite `vitral:navigate` no barramento. URL de outra origem recarrega a página.

Dentro do remote, `ctx.navigate` faz o mesmo.

::: info Em breve
Estado compartilhado entre host e remotes, com dono, permissão de escrita, tipos e hooks para cada framework. Até lá, use props e `events.last`.
:::
