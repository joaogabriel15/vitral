# vitral/routes

Um remote por rota, num host sem framework.

```ts
routes(map: Record<string, string>, options?: { links?: boolean }): () => void
matchRoute(path: string): { name, pattern, params } | null
defineVitralOutlet(tag?: string): void
```

## Uso

```html
<script type="module">
  import { configure } from 'vitral'
  import { routes } from 'vitral/routes'

  configure({ remotes: '/remotes.json' })
  routes({
    '/checkout/*': 'checkout',
    '/produto/:id': 'produto',
    '/': 'inicio',
    '*': 'nao-encontrado',
  })
</script>

<vitral-outlet isolate="shadow">
  <p slot="fallback">Carregando…</p>
  <p slot="error">Indisponível</p>
  <p slot="empty">Página não encontrada</p>
</vitral-outlet>
```

## Parâmetros

| Parâmetro | O que é |
| --- | --- |
| `map` | Padrão de caminho → nome do remote |
| `options.links` | `false` não intercepta cliques em `<a>` |

## Retorno

`routes` devolve a função que desfaz. `matchRoute` devolve a rota que bate, ou `null`.

## Observações

- A primeira rota que bate vence.
- Navegar dentro do mesmo remote não remonta.
- `outlet.props = {...}` passa props. `outlet.route` diz qual rota está montada.
- Com React Router ou Vue Router, use `<Remote>` na rota. Veja [Rotas](/aprender/rotas).
