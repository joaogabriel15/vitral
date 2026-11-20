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

- Vence a rota mais específica, em qualquer ordem: `/produto/novo` ganha de `/produto/:id`, e `/conta` ganha de `/conta/*`.
- Dois padrões que pegam os mesmos caminhos geram um aviso no console.
- Navegar dentro do mesmo remote (`/checkout/pagamento`) não remonta.
- Links `<a href>` da mesma origem navegam sem recarregar.
- `outlet.props = {...}` passa props. `outlet.route` diz qual rota está montada.

| Função ou opção | O que faz |
| --- | --- |
| `routes(mapa, { links, announce })` | Define as rotas. Devolve a função que desfaz. `links: false` não intercepta links. `announce: false` desliga o anúncio e o foco |
| `<vitral-outlet wait-for="sessao">` | Só monta quando a chave de `provide` tiver valor. Veja [Esperar a sessão](./contexto#esperar-a-sessao) |
| `matchRoute(caminho)` | Devolve `{ name, pattern, params }` ou `null` |
| `defineVitralOutlet(tag?)` | Registra o elemento com outro nome |

## Leitor de tela e foco

Numa SPA, a URL muda e o foco fica no link clicado. Quem usa leitor de tela não ouve nada. Com vários remotes na página, nenhum deles sabe que é a vez dele de avisar.

Hoje (Module Federation, single-spa, Multi-Zones), cada time escreve o próprio aviso, ou ninguém escreve:

```js
// shell/src/rotas.js
window.addEventListener('single-spa:app-change', () => {
  const h1 = document.querySelector('main h1')
  h1?.setAttribute('tabindex', '-1')
  h1?.focus()
  document.getElementById('aviso').textContent = h1?.textContent ?? document.title
})
```

Com vitral, o `<vitral-outlet>` faz isso sozinho depois de cada troca de remote:

```js
// shell/src/rotas.js (no lugar do ouvinte)
routes({ '/conta': 'conta', '/': 'inicio' })
```

- Anuncia o `h1` do remote (ou o `document.title`) numa região `aria-live`.
- Move o foco para esse `h1`, sem rolar a página.
- Na primeira carga não faz nada: o navegador já anuncia a página.
- `routes(mapa, { announce: false })` desliga.

Com outro roteador, chame `announceRoute` quando o `<vitral-remote>` ficar pronto:

```js
import { announceRoute } from 'vitral/routes'

document.addEventListener('vitral-ready', (e) => e.target.matches('vitral-remote') && announceRoute(e.target))
```

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
