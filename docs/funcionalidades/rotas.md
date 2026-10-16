# Rotas

Monta um remote por rota, num host sem framework ou com o roteador do host.

## Quando usar

- App shell sem framework: use `routes()` e `<vitral-outlet>`.
- Host com React Router, Vue Router, Next ou Nuxt: renderize `<Remote>` na rota.

## App shell com `vitral/routes`

```html
<script type="module">
  import { configure } from 'vitral'
  import { routes } from 'vitral/routes'

  configure({ remotes: '/remotes.json' })
  routes({
    '/checkout/*': 'checkout',   // /checkout e tudo abaixo
    '/conta': 'conta',           // só /conta
    '/produto/:id': 'produto',
    '/': 'inicio',
    '*': 'nao-encontrado',
  })
</script>

<nav><a href="/conta">Conta</a> <a href="/checkout">Checkout</a></nav>

<vitral-outlet isolate="shadow">
  <p slot="fallback">Carregando…</p>
  <p slot="error">Indisponível</p>
  <p slot="empty">Página não encontrada</p>
</vitral-outlet>
```

- A primeira rota que bate vence.
- Navegar dentro do mesmo remote (`/checkout/pagamento`) não remonta.
- Links `<a href>` da mesma origem navegam sem recarregar.
- `outlet.props = {...}` passa props. `outlet.route` diz qual rota está montada.

| Função ou opção | O que faz |
| --- | --- |
| `routes(mapa, { links })` | Define as rotas. Devolve a função que desfaz. `links: false` não intercepta links |
| `matchRoute(caminho)` | Devolve `{ name, pattern, params }` ou `null` |
| `defineVitralOutlet(tag?)` | Registra o elemento com outro nome |

## Com o roteador do host

```jsx
const router = createBrowserRouter([
  { path: '/conta/*', element: <Remote name="conta" /> },
  { path: '/checkout/*', element: <Remote name="checkout" /> },
])
```

O remote pode ter o próprio roteador com a base da rota:

```jsx
const router = createBrowserRouter(rotas, { basename: '/conta' })
export default reactRemote(() => <RouterProvider router={router} />)
```

Para sair da base de dentro do remote, use `navigate('/checkout')`.
