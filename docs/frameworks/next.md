<script setup>
import { withBase } from 'vitepress'
</script>

# Next.js

App Router e Pages Router. Import: `vitral/react`.

## Host Next no lugar das zonas

Num app Next (Pages Router) como host, `vitral/next-config` e `vitral/next-host` fazem o que as rewrites do Multi-Zones faziam, sem recarregar a página ao trocar de área.

Exemplo: uma loja em Next.js com a área "Minha conta", feita por outra equipe. Os dois lados têm os mesmos arquivos, na mesma ordem. Com vitral, a loja ganha um arquivo novo no fim.

<picture class="vt-diagrama">
  <img class="so-claro" :src="withBase('/marca/multizonas.png')" alt="À esquerda, Multi-Zones: dois apps Next, rewrites e a página recarrega ao trocar de área (0,8 s). À direita, vitral: um app Next com withVitral, a conta é um remote dentro do layout e a troca é sem recarregar (0,2 s).">
  <img class="so-escuro" :src="withBase('/marca/multizonas-escuro.png')" alt="">
</picture>

### Hoje, com Multi-Zones

```
loja/    app Next principal
conta/   segundo app Next (a zona)
```

```tsx
// conta/pages/index.tsx
export default function Conta() {
  return <h1>Minha conta</h1>
}
```

```js
// conta/next.config.js
module.exports = {
  basePath: '/conta',
  assetPrefix: '/conta-static',
}
```

```js
// loja/next.config.js
module.exports = {
  async rewrites() {
    return [
      { source: '/conta', destination: `${process.env.CONTA_URL}/conta` },
      { source: '/conta/:path+', destination: `${process.env.CONTA_URL}/conta/:path+` },
      { source: '/conta-static/:path+', destination: `${process.env.CONTA_URL}/conta-static/:path+` },
    ]
  },
}
```

```tsx
// loja/pages/_app.tsx
export default function App({ Component, pageProps }) {
  return <Component {...pageProps} />
}
```

```tsx
// loja/components/Menu.tsx
// <a>, não <Link>: a página recarrega e baixa Next e React de novo.
<a href="/conta">Minha conta</a>
```

### Com vitral

```
loja/    app Next (o host)
conta/   o mesmo código, buildado com Vite (o remote)
```

```tsx
// conta/pages/index.tsx (igual)
export default function Conta() {
  return <h1>Minha conta</h1>
}
```

```js
// conta/vite.config.js (no lugar do next.config.js)
import react from '@vitejs/plugin-react'
import vitral from 'vitral/vite'

export default {
  plugins: [
    react(),
    vitral({ name: 'conta', entry: 'pages/index.tsx', next: { basePath: '/conta' }, dedupe: ['react'] }),
  ],
}
```

```js
// loja/next.config.js (withVitral no lugar das rewrites)
const { withVitral } = require('vitral/next-config')

module.exports = withVitral({}, {
  remotes: {
    conta: { url: 'https://cdn.empresa.com/conta/vitral.json', basePath: '/conta' },
  },
})
```

```tsx
// loja/pages/_app.tsx (mais o <VitralNext />)
import { VitralNext } from 'vitral/next-host'

export default function App({ Component, pageProps }) {
  return <><VitralNext /><Component {...pageProps} /></>
}
```

```tsx
// loja/components/Menu.tsx
// <Link>: a troca é sem recarregar, e o React não baixa de novo.
<Link href="/conta">Minha conta</Link>
```

```tsx
// loja/pages/conta/[[...slug]].tsx (arquivo novo: a página da loja que mostra a conta)
import { NextRemote } from 'vitral/next-host'

export default function Conta() {
  return <NextRemote name="conta" fallback={<p>Carregando…</p>} />
}
```

Com `next: { basePath }`, o código da conta pode continuar usando `next/link` e `useRouter`.

Pronto. Um `<Link href="/conta">` na loja abre o remote sem recarregar, e dentro do remote `useRouter`, `<Link>` e `router.push` usam o roteador do host. Um `<a>` comum para uma rota de remote também vira navegação sem recarregar.

| Opção do remote | Padrão | O que faz |
| --- | --- | --- |
| `url` | obrigatório | URL do `vitral.json` |
| `basePath` | obrigatório | Página do host que mostra o remote |
| `routes` | nenhum | `{ public, zone }`: outras URLs que abrem o remote, como as rewrites do Multi-Zones |
| `preload` | `'idle'` | `'idle'` baixa com o navegador ocioso, `'route'` só ao abrir a rota, `false` nunca antes |
| `devUrl` | nenhum | Em `next dev`, o dev server do remote, com HMR |
| `manifestFile` | `public/` + `url` | Caminho do `vitral.json` no disco, quando o remote é servido por outro servidor |

`share` oferece outras dependências aos remotes com [`dedupe`](/aprender/dedupe). Elas só baixam quando um remote pede. Funciona com webpack e com Turbopack.

### Remote no HTML da página

Quando o `vitral.json` do remote está disponível no build do host, o HTML da página do remote sai com um preload do JS e do CSS dele, com o hash de cada arquivo. O remote baixa junto com o JS do host, e não depois.

Quem põe o preload é o `<VitralNext />` do `_app`, pela rota aberta. Por isso ele vale também na página que só desenha o `NextRemote` no navegador, depois do login, por exemplo.

Builde o remote antes do host. Se o remote publicar sem um build novo do host, o preload aponta para os arquivos antigos e o remote ainda carrega certo, só que um pouco depois. Para evitar isso, leia o manifesto no servidor.

### Manifesto lido no servidor

Com `vitral/next-server`, a página lê o `vitral.json` a cada requisição. O preload sempre aponta para a versão publicada agora:

```tsx
// pages/conta/[[...slug]].tsx
import { NextRemote } from 'vitral/next-host'
import { remoteProps } from 'vitral/next-server'

export const getServerSideProps = async () => ({ props: await remoteProps('conta') })

export default function Conta({ vitral }) {
  return <Layout><NextRemote name="conta" manifest={vitral.conta} /></Layout>
}
```

Passe também os `pageProps` ao `VitralNext`, para o preload da página que só desenha o remote depois do login vir da versão publicada agora:

```tsx
// pages/_app.tsx
<VitralNext pageProps={pageProps} />
```

O servidor guarda o manifesto em cache por alguns segundos. Se o remote não responder, a página segue como sem ele. Também funciona em `getStaticProps` com `revalidate`.

### SSR do remote

Com `ssr`, o servidor do host também renderiza o remote. O conteúdo aparece antes de qualquer JS, e o navegador só hidrata:

```tsx
// conta/src/server.tsx (no remote)
import { reactRender } from 'vitral/react-server'
import Conta from './Conta'

export const render = reactRender(Conta, { state: (props) => buscarPedidos(props.usuario) })
```

```tsx
// pages/conta/[[...slug]].tsx (no host)
import { render } from 'conta/server'

const props = { usuario: 42 }
export const getServerSideProps = async () => ({ props: await remoteProps('conta', { ssr: { conta: { render, props } } }) })

export default function Conta({ vitral, vitralSsr }) {
  return <NextRemote name="conta" manifest={vitral.conta} ssr={vitralSsr?.conta} props={props} />
}
```

- `state` busca os dados no servidor, e o remote lê com `useInitialState()` sem buscar de novo no navegador.
- Se o `render` falha ou demora mais de 3 s, a página monta o remote no navegador, como sem SSR.
- As `props` do `NextRemote` têm de ser as mesmas do servidor.
- O remote não pode usar `window`, `document` ou `localStorage` no primeiro render. Mova esse código para `useEffect`.
- Se o layout do host só mostra a página depois de algo do navegador (como a autenticação no cliente), o SSR não adianta.

## Host com App Router

Para mostrar um remote numa página do App Router. `<Remote>` já tem `'use client'`. No servidor ele renderiza o `fallback`. No cliente ele monta o remote. Não precisa de `dynamic(..., { ssr: false })`.

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
  plugins: [react(), vitral({ entry: 'src/remote.tsx', name: 'conta', next: { basePath: '/conta' }, dedupe: ['react'] })],
}
```

| O que o modo `next` faz | Detalhe |
| --- | --- |
| `next/link`, `next/image`, `next/head`, `next/dynamic`, `next/router`, `next/navigation` | Vêm de `vitral/next`. Dentro de um host Next (`NextRemote`), usam o roteador do host |
| `process.env` | `NODE_ENV` e as `NEXT_PUBLIC_*` do ambiente e do `.env` |
| `paths` do tsconfig | Cada arquivo usa o tsconfig mais próximo, inclusive o de um pacote publicado como código-fonte. Vale também no pré-bundle de `vite dev` |
| `import Icon from './icon.svg'` | Componente React, com o SVGR do projeto. Sem SVGR instalado, continua URL |

| Opção de `next` | Padrão | O que faz |
| --- | --- | --- |
| `basePath` | `''` | O `basePath` do `next.config` da zona |
| `tsconfigPaths` | `true` | Resolve os `paths` do tsconfig |
| `svgr` | `true` | `.svg` como componente |

O que o modo `next` não cobre: Server Components, Server Actions, `getServerSideProps`, API routes e middleware. Dados do servidor entram como props ou são buscados no cliente.

## Vindo do Multi-Zones

Para trocar as zonas por remotes, com SSR por rota e troca de rota sem recarregar, veja [Migrar do Next.js Multi-Zones](/migracao/multi-zones).
