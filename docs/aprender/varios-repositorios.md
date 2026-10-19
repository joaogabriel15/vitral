# Vários repositórios

Um portal com login, home e layout, e uma área por repositório: produtos, colaboradores. Cada repositório tem o próprio build e o próprio deploy. O usuário navega entre as áreas sem recarregar a página.

```
portal/          host: login, layout, rotas, sessão
produtos/        remote: /produtos/*
colaboradores/   remote: /colaboradores/*
```

## 1. Criar os três repositórios

```bash
npm create vitral@latest portal -- --host --framework react
npm create vitral@latest produtos -- --remote --framework react
npm create vitral@latest colaboradores -- --remote --framework react
```

Os dois remotes vêm com a porta `5174`. Troque a de `colaboradores` para rodar os dois ao mesmo tempo:

```js
// colaboradores/vite.config.js
server: { port: 5175 },
```

## 2. Remote: exportar a área

Cada remote exporta um componente e tem o próprio roteador, com a base da rota que o portal reserva para ele.

```jsx
// produtos/src/App.jsx
import { createBrowserRouter, RouterProvider } from 'react-router'

const router = createBrowserRouter(
  [
    { path: '/', element: <Lista /> },
    { path: '/:id', element: <Detalhe /> },
  ],
  { basename: '/produtos' },
)

export default function Produtos() {
  return <RouterProvider router={router} />
}
```

`vite build` gera `dist/vitral.json`. Publique `dist` numa pasta do CDN, por exemplo `https://cdn.empresa.com/produtos/`.

## 3. Portal: um mapa de remotes por ambiente

O portal lê a lista de remotes de um JSON. Cada ambiente publica o seu, sem rebuild do portal.

```json
// portal/public/remotes.json (produção)
{
  "produtos": "https://cdn.empresa.com/produtos/vitral.json",
  "colaboradores": "https://cdn.empresa.com/colaboradores/vitral.json"
}
```

```jsx
// portal/src/main.jsx
import { configure } from 'vitral'

configure({ remotes: '/remotes.json' })
```

Remotes de outra origem que não está em `remotes.json` são bloqueados. Veja [SRI e origens](./seguranca).

## 4. Portal: rotas

Uma rota por área. Cada uma renderiza o remote; o roteador do remote cuida do resto do caminho.

```jsx
// portal/src/App.jsx
import { createBrowserRouter, Outlet, RouterProvider } from 'react-router'
import { Remote } from 'vitral/react'

const router = createBrowserRouter([
  {
    element: <Layout><Outlet /></Layout>,
    children: [
      { path: '/', element: <Home /> },
      { path: '/produtos/*', element: <Remote name="produtos" fallback={<Carregando />} /> },
      { path: '/colaboradores/*', element: <Remote name="colaboradores" fallback={<Carregando />} /> },
    ],
  },
  { path: '/login', element: <Login /> },
])

export const App = () => <RouterProvider router={router} />
```

Para ir de uma área para outra de dentro de um remote, use `navigate`. Ele atualiza o histórico e avisa todos os roteadores da página:

```jsx
import { navigate } from 'vitral'

<button onClick={() => navigate('/colaboradores/42')}>Ver responsável</button>
```

`navigate` para outra origem recarrega a página.

## 5. Sessão compartilhada

O portal faz o login e é o dono da sessão. Os remotes leem.

```ts
// portal/src/sessao.ts
import { provide } from 'vitral'

export const sessao = provide('sessao', null, { writable: false })

export function entrar(usuario, token) {
  sessao.set({ usuario, getToken: () => token })
}
```

```jsx
// produtos/src/Lista.jsx
import { useShared } from 'vitral/react'

export function Lista() {
  const nome = useShared('sessao', (s) => s?.usuario.nome)
  return <h1>Produtos de {nome}</h1>
}
```

Para chamadas à API, passe uma função como `getToken` em vez do token. Assim o remote sempre pega o valor atual.

Declare o formato uma vez, num arquivo copiado nos três repositórios (ou num pacote interno):

```ts
// vitral-shared.d.ts
declare module 'vitral' {
  interface Shared {
    sessao: { usuario: { id: number; nome: string }; getToken(): string } | null
  }
}
```

Mais em [Contexto compartilhado](./contexto).

## 6. Desenvolver sem rodar todos os repositórios

Rode só o portal e o remote que você está editando. Os outros remotes vêm do ambiente de homologação.

```bash
# em portal/, com public/remotes.json apontando para homologação
npm run dev                # http://localhost:5173

# em produtos/
npm run dev                # http://localhost:5174
```

Abra o portal trocando só o remote local:

```
http://localhost:5173/produtos?vitral=produtos@http://localhost:5174
```

`colaboradores` continua vindo de homologação. Editar `produtos` atualiza o portal sem recarregar. Para quem trabalha só num remote e não quer rodar o portal, a homologação pode ligar `configure({ devOverrides: true })` e aceitar o mesmo `?vitral=`. Não ligue em produção. Mais em [Desenvolvimento e HMR](./desenvolvimento).

## 7. Deploy

| Repositório | O que publica | Quando |
| --- | --- | --- |
| `portal` | O app e o `remotes.json` do ambiente | Quando o portal muda |
| `produtos`, `colaboradores` | `dist/` numa pasta do CDN | Quando a área muda |

Um deploy de `produtos` não exige deploy do portal. Com versões em pastas (`/produtos/1.4.0/`), troque a URL no `remotes.json` para lançar ou voltar uma versão. Para quem já está com a página aberta, veja [Atualização sem reload](./atualizacoes). Cache e CSP: [Deploy](./deploy).
