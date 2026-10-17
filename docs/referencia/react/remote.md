# &lt;Remote&gt;

Mostra um remote num host React ou Next.

```tsx
<Remote name="carrinho" props={{ userId: 42 }} />
```

## Uso

```jsx
import { configure } from 'vitral'
import { Remote } from 'vitral/react'

configure({ remotes: { carrinho: 'https://cdn.empresa.com/carrinho/vitral.json' } })

export function App() {
  const [userId, setUserId] = useState(42)
  return (
    <Remote
      name="carrinho"
      props={{ userId, aoFinalizar: (pedido) => console.log(pedido) }}
      fallback={<p>Carregando…</p>}
      error={(erro, tentarDeNovo) => <button onClick={tentarDeNovo}>Tentar de novo</button>}
      onError={(erro) => console.error(erro.code)}
    />
  )
}
```

## Props

| Prop | Tipo | O que faz |
| --- | --- | --- |
| `name` | `string` | Nome registrado em `configure` |
| `src` | `string` | URL do `vitral.json`. Dispensa `configure` |
| `props` | `object` | Props do remote. Funções também passam |
| `isolate` | `'none' \| 'shadow' \| 'iframe'` | Isolamento. Veja [Estilos](/aprender/estilos) |
| `fallback` | `ReactNode` | Mostrado enquanto carrega |
| `error` | `ReactNode` ou `(erro, tentarDeNovo) => ReactNode` | Mostrado se falhar |
| `onError` | `(erro) => void` | Chamado em cada erro |
| `className` | `string` | Classe do elemento que recebe o remote |
| `loading` | `'lazy' \| 'idle'` | Quando montar. Veja [Carregamento](/aprender/carregamento) |
| `prefetch` | `'hover' \| 'visible' \| 'idle'` | Baixar antes de montar |
| `priority` | `'high'` | Prioridade alta nos downloads |
| `keepAlive` | `boolean \| number` | Guarda o remote montado ao sair da página |

## Observações

- Mudar `props` atualiza o remote. Mudar `name`, `src` ou `isolate` remonta.
- No servidor, renderiza só o `fallback`. O remote monta no cliente, sem erro de hidratação. Já tem `'use client'`.
- Oferece o React do host aos remotes com [`dedupe: ['react']`](/aprender/dedupe).
- Com `npx vitral types`, as props são checadas pelo nome. Veja [CLI](/referencia/cli).
