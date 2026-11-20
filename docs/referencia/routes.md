# vitral/routes

Um remote por rota, num host sem framework.

```ts
routes(map: Record<string, string>, options?: { links?: boolean; announce?: boolean }): () => void
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
| `options.announce` | `false` não anuncia a página nova nem move o foco depois da troca de remote. Padrão: `true` |

## Retorno

`routes` devolve a função que desfaz. `matchRoute` devolve a rota que bate, ou `null`.

## Observações

- Vence a rota mais específica, em qualquer ordem: `/produto/novo` ganha de `/produto/:id`, e `/conta` ganha de `/conta/*`. Em empate, a que vem primeiro.
- Dois padrões que pegam os mesmos caminhos (`/produto/:id` e `/produto/:slug`) geram um aviso no console.
- `<vitral-outlet wait-for="sessao">` só monta quando a chave de `provide` tiver valor.
- Depois de trocar de remote numa navegação, o leitor de tela ouve o `h1` do remote (ou o `document.title`) e o foco vai para esse `h1`. `announceRoute(el)` faz o mesmo para hosts com outro roteador.
- Navegar dentro do mesmo remote não remonta.
- `outlet.props = {...}` passa props. `outlet.route` diz qual rota está montada.
- Com React Router ou Vue Router, use `<Remote>` na rota. Veja [Rotas](/aprender/rotas).
