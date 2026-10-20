# Migrar do Next.js Multi-Zones

No Multi-Zones, cada equipe tem um app Next (uma zona) com um pedaço das URLs, e as rewrites juntam tudo num domínio. Trocar de zona recarrega a página e baixa React e Next de novo. No vitral, cada zona vira um remote, o gateway de [`vitral/edge`](/referencia/edge) faz o papel das rewrites e renderiza a rota no servidor, e um app shell troca de rota sem recarregar.

## Equivalências

| Multi-Zones | vitral |
| --- | --- |
| Um app Next por zona | Um remote por área, com deploy próprio |
| `rewrites` (ou `proxy.js`) no app principal | `gateway({ routes })` na frente do app shell |
| `assetPrefix` de cada zona | `/_vitral/<nome>/`, posto pelo gateway |
| HTML renderizado pela zona | `render` do remote no gateway (`reactRender` em React) |
| Hidratação do Next | `hydrate` do remote (`reactRemote` já traz) |
| `<a>` entre zonas, com recarga da página | Links interceptados por `routes()`, sem recarga |
| React e Next baixados de novo em cada zona | Uma cópia do React para todos os remotes, com [`dedupe`](/aprender/dedupe) |
| Speculation Rules (só Chromium) para a próxima zona | [`vitral/prefetch`](/referencia/prefetch), em qualquer navegador |
| Rota de uma zona só | Rota de um remote só (`routes`) |

## Passo a passo

### 1. A página da zona vira um remote

```jsx
// conta/src/Conta.jsx: o componente que a page.jsx da zona renderizava
export default function Conta({ usuario }) { /* … */ }
```

```js
// conta/vite.config.js
import react from '@vitejs/plugin-react'
import vitral from 'vitral/vite'

export default { plugins: [react(), vitral({ entry: 'src/Conta.jsx', name: 'conta', dedupe: ['react'] })] }
```

O plugin embrulha o `export default` com `reactRemote`, que já sabe hidratar.

### 2. O remote exporta o `render` do servidor

```ts
// conta/src/server.ts
import { reactRender } from 'vitral/react-server'
import Conta from './Conta'

export const render = reactRender(Conta)
```

### 3. O gateway substitui as rewrites

```ts
import { gateway } from 'vitral/edge'
import { render as conta } from 'conta/server'
import { render as loja } from 'loja/server'

export default {
  fetch: gateway({
    origin: 'https://shell.empresa.com',
    remotes: {
      conta: { url: 'https://cdn.empresa.com/conta/vitral.json', render: conta },
      loja: { url: 'https://cdn.empresa.com/loja/vitral.json', render: loja },
    },
    routes: { '/conta/*': 'conta', '/*': 'loja' },
  }),
}
```

### 4. O app shell

```html
<vitral-outlet><p slot="fallback">Carregando…</p></vitral-outlet>
<script type="module">
  import { configure } from 'vitral'
  import { routes } from 'vitral/routes'
  import { prefetch } from 'vitral/prefetch'

  configure({ remotes: { conta: '/_vitral/conta/vitral.json', loja: '/_vitral/loja/vitral.json' } })
  routes({ '/conta/*': 'conta', '/*': 'loja' })
  prefetch()
</script>
```

Dentro de cada área, o remote pode ter o próprio roteador com a base da rota. Veja [Rotas](/aprender/rotas#com-o-roteador-do-host).

## O que não migra

- **Recursos de servidor do Next dentro da zona:** Server Components, Server Actions, `getServerSideProps`, `next/image` e middleware. O `render` do remote é um `renderToString` do componente: dados do servidor entram como props (atributo `props` do outlet) ou são buscados no cliente.
- **Host Next com SSR do remote:** num app Next como host, `<Remote>` renderiza o `fallback` no servidor e monta no cliente. O SSR pelo gateway vale para o app shell sem framework.

## Números

No [benchmark](/aprender/benchmark#contra-o-next-js-multi-zones), com duas áreas e rede lenta, o vitral com gateway abre a primeira página mais rápido que o Multi-Zones, troca de área 4,7 vezes mais rápido e baixa 63% menos.
