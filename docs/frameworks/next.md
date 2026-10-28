# Next.js

App Router e Pages Router. Import: `vitral/react`.

## Host

`<Remote>` já tem `'use client'`. No servidor ele renderiza o `fallback`. No cliente ele monta o remote. Não precisa de `dynamic(..., { ssr: false })`.

```tsx
// app/remotes.tsx
'use client'
import { configure } from 'vitral'
import { Remote } from 'vitral/react'

if (typeof window !== 'undefined') {
  configure({ remotes: '/remotes.json' })
}

export function Carrinho({ userId }: { userId: number }) {
  return <Remote name="carrinho" props={{ userId }} fallback={<p>Carregando…</p>} />
}
```

```tsx
// app/page.tsx (componente de servidor)
import { Carrinho } from './remotes'

export default function Page() {
  return <main><Carrinho userId={42} /></main>
}
```

```json
// public/remotes.json
{ "carrinho": "https://cdn.empresa.com/carrinho/vitral.json" }
```

As props de `<Remote>` são as mesmas do [React](./react#host).

## Estado do servidor no cliente

Para mandar valores do [contexto compartilhado](/aprender/contexto) do servidor para o cliente, use `serializeShared`:

```tsx
import { serializeShared } from 'vitral'

<script
  type="application/json"
  data-vitral-shared
  dangerouslySetInnerHTML={{ __html: serializeShared({ usuario }) }}
/>
```

Veja [SSR](/aprender/ssr).

## Remote

Um remote não é um app Next. Crie o remote como um projeto [React](./react#remote) com Vite e use-o no host Next.

### Código escrito para Next

Para buildar com Vite um código que já usa `next/link`, `next/router` e companhia (uma zona do Multi-Zones, por exemplo), ligue `next` no plugin:

```ts
// vite.remote.config.ts
import react from '@vitejs/plugin-react'
import vitral from 'vitral/vite'

export default {
  plugins: [react(), vitral({ entry: 'src/remote.tsx', name: 'delivery', next: { basePath: '/delivery' }, dedupe: ['react', '@empresa/ui/*'] })],
}
```

| O que o modo `next` faz | Detalhe |
| --- | --- |
| `next/link`, `next/image`, `next/head`, `next/dynamic`, `next/router`, `next/navigation` | Vêm de `vitral/next`. Dentro de um host Next (`NextRemote`), usam o roteador do host |
| `process.env` | `NODE_ENV` e as `NEXT_PUBLIC_*` do ambiente e do `.env` |
| `paths` do tsconfig | Cada arquivo usa o tsconfig mais próximo, inclusive o de um pacote publicado como código-fonte. Vale também no pré-bundle de `vite dev` |
| `import Icon from './icon.svg'` | Componente React, com o SVGR do projeto (o mesmo do `@svgr/webpack`). Sem SVGR instalado, continua URL |
| `NODE_ENV=development` no `.env` | O build continua de produção (o JSX não sai com `jsxDEV`) |

| Opção de `next` | Padrão | O que faz |
| --- | --- | --- |
| `basePath` | `''` | O `basePath` do `next.config` da zona |
| `tsconfigPaths` | `true` | Resolve os `paths` do tsconfig |
| `svgr` | `true` | `.svg` como componente |

O que o modo `next` não cobre: Server Components, Server Actions, `getServerSideProps`, API routes e middleware. Dados do servidor entram como props ou são buscados no cliente.

## Host Next no lugar das zonas

Num app Next (Pages Router) como host, `vitral/next-config` e `vitral/next-host` fazem o que as rewrites do Multi-Zones faziam, sem recarregar a página ao trocar de área.

```js
// next.config.js
const { withVitral } = require('vitral/next-config')

module.exports = withVitral(nextConfig, {
  remotes: {
    delivery: {
      url: '/delivery-remote/vitral.json',
      basePath: '/delivery',
      routes: [{ public: '/store', zone: '/delivery/store' }],
      warmRoutes: true,
      devUrl: 'http://localhost:5173',
    },
  },
  share: ['i18next', 'react-i18next', '@tanstack/react-query', '@empresa/ui/*'],
})
```

```tsx
// pages/_app.tsx
import { VitralNext } from 'vitral/next-host'

export default function App({ Component, pageProps }) {
  return <><VitralNext /><Component {...pageProps} /></>
}
```

```tsx
// pages/delivery/[[...slug]].tsx
import { NextRemote } from 'vitral/next-host'

export default function Delivery() {
  return <Layout><NextRemote name="delivery" fallback={<Spinner />} /></Layout>
}
```

| `withVitral` | O que faz |
| --- | --- |
| `rewrites` | Cada rota pública de `routes` abre a página do remote (`basePath`) |
| `headers` | `vitral.json` com `no-cache`; `remote-*` e `split/*` com cache eterno (remote servido pelo próprio host) |
| `share` | O host oferece estas dependências com [`dedupe`](/aprender/dedupe). Só baixam quando um remote pede. `pacote/*` oferece o pacote e cada subpath do `exports` |
| `transpilePackages` | Ganha `vitral`, para o servidor do Next empacotar a configuração gerada |

A configuração gerada fica em `.vitral/host-config.mjs`, na pasta do app (a pasta já se ignora no git). Funciona com webpack e com Turbopack.

| Opção do remote | Padrão | O que faz |
| --- | --- | --- |
| `url` | obrigatório | URL do `vitral.json` |
| `basePath` | obrigatório | Página do host que renderiza o `NextRemote`, e o `basePath` que o remote vê |
| `routes` | nenhum | `{ public, zone }`, como as rewrites do Multi-Zones |
| `preload` | `'idle'` | `'idle'`: baixa com o navegador ocioso. `'route'`: só ao abrir uma rota dele. `false`: nunca antes |
| `warmRoutes` | `false` | Depois do preload, aquece os chunks das rotas do remote (`import()`) |
| `devUrl` | nenhum | Em `next dev`, o dev server do remote, com HMR. A CSP de dev precisa liberar a origem em `script-src` e `connect-src` (`ws:`) |
| `integrity` | do manifesto | `false` dispensa a conferência de hash (remote na mesma origem) |

`VitralNext` registra os remotes, oferece as dependências de `share`, faz o preload e intercepta navegações de página inteira para uma rota de remote (`location.assign`, `<a>` comum): elas viram `Router.push`, sem recarregar. Precisa da [Navigation API](https://developer.mozilla.org/docs/Web/API/Navigation_API); sem ela, a página recarrega como antes.

`NextRemote` passa o roteador do Next ao remote: `useRouter`, `<Link>`, `router.push`, o `Router` padrão de `next/router`, `redirect()` e `router.events` dentro dele usam o do host, com as rotas públicas. O remote vê os caminhos como numa zona com `basePath`.

## Vindo do Multi-Zones

Para trocar as zonas por remotes, com SSR por rota e troca de rota sem recarregar, veja [Migrar do Next.js Multi-Zones](/migracao/multi-zones).
