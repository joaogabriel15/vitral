# Rotas

O roteador do host escolhe o remote. O roteador do remote cuida das páginas dentro dele.

## Host decide o remote

```jsx
// host com React Router
import { Remote } from 'vitral/react'

const router = createBrowserRouter([
  { path: '/', element: <Inicio /> },
  { path: '/conta/*', element: <Remote name="conta" fallback={<Carregando />} /> },
  { path: '/checkout/*', element: <Remote name="checkout" fallback={<Carregando />} /> },
])
```

Trocar de rota desmonta o remote antigo e monta o novo. Para começar o download antes do clique, chame `preload('checkout')` no hover do link.

## Remote com roteador próprio

O remote usa o histórico do navegador, com a base da rota do host:

```jsx
// remote "conta"
import { createBrowserRouter, RouterProvider } from 'react-router'
import { reactRemote } from 'vitral/react'

const router = createBrowserRouter(
  [
    { path: '/', element: <Perfil /> },
    { path: '/pedidos/:id', element: <Pedido /> },
  ],
  { basename: '/conta' },
)

export default reactRemote(() => <RouterProvider router={router} />)
```

Crie o roteador dentro do componente, se o remote puder montar mais de uma vez na página.

## Navegar entre remotes

De dentro de um remote, para uma rota de outro remote ou do host:

```ts
import { navigate } from 'vitral'

navigate('/checkout')
```

`navigate` atualiza o histórico e dispara `popstate`. O roteador do host e os dos remotes leem a URL nova. Um `<Link>` do roteador do remote só funciona dentro da `basename` dele; para sair dela, use `navigate`.

## Vue Router

```ts
import { createRouter, createWebHistory } from 'vue-router'

export default vueRemote(App, {
  setup(app) {
    app.use(createRouter({ history: createWebHistory('/catalogo'), routes }))
  },
})
```

::: info Em breve
Composição por rota num host sem framework, sem escrever o roteador.
:::
