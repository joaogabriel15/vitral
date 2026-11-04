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
| `htmlPreload` | ligado | `false` tira do HTML da página do remote os `<link rel="preload">` (veja abaixo) |
| `manifestFile` | `public/` + `url` | Caminho no disco do `vitral.json`, quando ele não fica em `public/` (remote servido por outro servidor ou por rewrite) |

`VitralNext` registra os remotes, oferece as dependências de `share`, faz o preload e intercepta navegações de página inteira para uma rota de remote (`location.assign`, `<a>` comum): elas viram `Router.push`, sem recarregar. Com a [Navigation API](https://developer.mozilla.org/docs/Web/API/Navigation_API) vale para `location.assign` e para `<a>`. Sem ela, só os cliques em `<a>` comuns viram `Router.push`; `location.assign` não tem como ser interceptado e recarrega a página como antes.

### Remote no HTML da página

No build do host, o `withVitral` lê o `vitral.json` do remote (em `public/` ou em `manifestFile`). O `NextRemote` põe no `<head>` da página um `<link rel="preload">` para o manifesto, o CSS e o JS da primeira tela (entrada, chunks e as cópias de `dedupe` que o host não oferece). Assim o remote baixa junto com o JS do host, e não depois da hidratação. Quem abre a área do remote direto, como primeira página, é quem mais ganha.

- O hash de cada arquivo vai no `integrity` do preload, e o `import()` do remote confere de novo. Um arquivo trocado no caminho não roda.
- Os links vêm na ordem que o build do remote calcula (`split.order` no manifesto): primeiro a entrada e o que ela importa, depois as cópias de `dedupe` e o `import()` do app. Em cada etapa, o arquivo com mais bytes pela frente (ele e a cadeia mais pesada de imports dele) vem antes. Os arquivos dessa cadeia levam `fetchpriority="high"`. Os outros ficam sem o atributo: o remote só roda quando todos chegam, e um `low` deixaria um deles atrás das imagens da página. O `vitral/edge` usa a mesma ordem nos `Link`.
- O código de SRI e de `dedupe` do vitral vem no bundle do host (cerca de 3 kB), e o manifesto baixa enquanto as ofertas de `share` se registram. Depois da hidratação, nenhum download espera outro.
- Os links refletem o remote do build do host. Builde o remote antes do host. Se o remote for publicado sem um build novo do host, os links apontam para os arquivos antigos: o navegador baixa à toa (ou mostra 404 no console, se eles já saíram do servidor), e o remote carrega certo pelo manifesto.
- Com o preload no HTML, `maxStale` não ajuda: o manifesto já baixa em paralelo com o JS do host.

### Manifesto lido no servidor

Os links do build ficam velhos quando o remote faz deploy sozinho. Com `vitral/next-server`, a página lê o `vitral.json` no servidor, a cada requisição, e passa o manifesto ao `NextRemote`:

```tsx
// pages/delivery/[[...slug]].tsx
import { NextRemote } from 'vitral/next-host'
import { remoteProps } from 'vitral/next-server'

export const getServerSideProps = async () => ({ props: await remoteProps('delivery') })

export default function Delivery({ vitral }) {
  return <Layout><NextRemote name="delivery" manifest={vitral.delivery} /></Layout>
}
```

- O HTML pré-carrega os arquivos da versão publicada agora, e o navegador não pede o manifesto: o remote baixa junto com o JS do host, uma ida e volta antes.
- O servidor guarda o manifesto em memória: por 5 s responde do cache e, por mais 30 s, responde do cache e renova por trás (`maxAge` e `staleWhileRevalidate`, em segundos). Um pedido que falha mantém a cópia boa.
- Para `url` relativo, o servidor pede a `VITRAL_ORIGIN`, ou ao próprio Next em `http://127.0.0.1:$PORT`. A opção `origin` troca. O header `Host` da requisição nunca é usado.
- Sem resposta em 3 s (`timeout`), a prop vem `null` e a página segue como sem ela: o preload do build e o pedido no navegador. Um canal (`{ stable, canary }`) também vem `null`, porque a versão é escolhida por visitante.
- Funciona em `getStaticProps` com `revalidate` também.

### SSR do remote

Com `ssr`, o servidor do host também renderiza o remote. O HTML aparece antes de qualquer JS, e o navegador só hidrata:

```tsx
// delivery/src/server.tsx (no remote)
import { reactRender } from 'vitral/react-server'
import Delivery from './Delivery'

export const render = reactRender(Delivery, { state: (props) => buscarPedidos(props.loja) })
```

```tsx
// pages/delivery/[[...slug]].tsx (no host)
import { render } from 'delivery/server'

const props = { loja: 1 }
export const getServerSideProps = async () => ({ props: await remoteProps('delivery', { ssr: { delivery: { render, props } } }) })

export default function Delivery({ vitral, vitralSsr }) {
  return <NextRemote name="delivery" manifest={vitral.delivery} ssr={vitralSsr?.delivery} props={props} />
}
```

- `state` busca os dados no servidor. Eles vão com o HTML, num `<script type="application/json">`, e o remote lê com `useInitialState()` de `vitral/react` nos dois lados, sem buscar de novo no navegador.
- O HTML leva o CSS do remote (com `integrity`), para pintar certo antes do JS.
- Se o `render` falha ou passa de `timeout` (3 s), `vitralSsr[nome]` vem `null` e a página monta no navegador como antes.
- As `props` do `NextRemote` têm de ser as mesmas do servidor. O `render` não recebe o roteador do Next (`__next`).
- O `render` vem do código do remote no build do host. Se o remote publicar uma versão nova sem um build novo do host, o React acusa a diferença na hidratação e renderiza de novo no navegador.
- Com `isolate: 'shadow'`, o HTML do servidor é descartado e o remote monta no navegador.
- Com `policy` `'lazy'` (2G ou economia de dados), a hidratação espera o remote aparecer na tela.
- Se o layout do host espera algo do navegador para mostrar a página (por exemplo, a autenticação), o HTML do remote só aparece depois disso, e o ganho no FCP some.

### Ofertas só com os nomes usados

Uma oferta de `share` é um `import()` do pacote. Com o pacote inteiro, o webpack considera usados todos os exports dos barrels dele e deixa de descartar o que a página não usa. Uma página que só importa o layout de uma biblioteca de componentes acaba levando os gráficos, os formulários e o calendário dela.

Quando o build do host acha o `vitral.json` de todos os remotes (em `public/` ou em `manifestFile`), o `withVitral` gera cada oferta com `/* webpackExports: [...] */` e só os nomes que os remotes usam (o campo `uses` do manifesto). Assim o webpack volta a descartar o resto. Se um remote publicado depois usar um nome que a oferta não tem, ele usa a cópia própria daquele grupo e avisa no console, sem quebrar. O React é a exceção: duas cópias na página quebram hooks e contexto, então o remote fica com o React do host e só avisa. Rebuildar o host volta a oferecer tudo o que ele usa.

- Um remote sem manifesto no build (de outra origem, sem `manifestFile`), ou com um manifesto anterior a este campo, faz as ofertas irem inteiras, como antes.
- Em `next dev` com `devUrl`, as ofertas vão inteiras.
- Os nomes de `uses` são os do build de produção de cada pacote. O React de dev exporta nomes que o de produção não tem (`act`, `captureOwnerStack`), e um remote com `import * as React` não os pede ao host.
- Na página de um remote, o host começa o download do chunk de cada oferta que o remote vai pedir antes da hidratação, e não quando o remote pede. O webpack põe cada `import()` da oferta num chunk à parte, que o HTML não pré-carrega.
- O Turbopack ignora o `webpackExports`. Com ele, a oferta continua trazendo o pacote inteiro.

`NextRemote` passa o roteador do Next ao remote: `useRouter`, `<Link>`, `router.push`, o `Router` padrão de `next/router`, `redirect()` e `router.events` dentro dele usam o do host, com as rotas públicas. O remote vê os caminhos como numa zona com `basePath`.

## Vindo do Multi-Zones

Para trocar as zonas por remotes, com SSR por rota e troca de rota sem recarregar, veja [Migrar do Next.js Multi-Zones](/migracao/multi-zones).
