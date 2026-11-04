# SSR

Os componentes de host funcionam em apps com renderização no servidor.

## Quando usar

Em Next, Nuxt, SvelteKit ou Angular SSR.

## O que acontece

- No servidor, o componente renderiza o `fallback`.
- No cliente, o remote monta. Não há erro de hidratação.
- No Next, `<Remote>` já tem `'use client'`.
- No Nuxt, chame `configure` num plugin `.client.ts`.
- No Angular, `provideVitral` não faz nada no servidor.

## Estado do servidor no cliente

No servidor, cada requisição tem o próprio [contexto compartilhado](./contexto). Para mandar os valores para o cliente:

```ts
import { serializeShared } from 'vitral'

const html = `<script type="application/json" data-vitral-shared>${serializeShared({ usuario })}</script>`
```

Coloque o script antes dos scripts do app. O primeiro `provide` da chave no cliente mantém o valor que veio do servidor. Funções e `undefined` ficam de fora.

| Função | O que faz |
| --- | --- |
| `serializeShared(valores)` | Transforma `{ chave: valor }` em JSON seguro para `<script>` |

## SSR do remote pelo gateway

Com o gateway de [`vitral/edge`](../referencia/edge), o HTML do remote sai pronto na resposta: bom para SEO e para a primeira pintura.

O remote exporta, além de `mount`:

```ts
// carrinho/src/server.ts (roda no gateway)
export function render(props: { n: number }): string {
  return `<button>itens: ${props.n}</button>`
}

// carrinho/src/index.ts (roda no navegador)
export default defineRemote({
  mount(el, props, ctx) { /* monta do zero */ },
  hydrate(el, props, ctx) {
    // `el` já tem o HTML de `render`: só liga os eventos.
    const button = el.querySelector('button')!
    button.onclick = () => ctx.events.emit('carrinho:abrir')
    return { unmount: () => (el.textContent = '') }
  },
})
```

No gateway:

```ts
import { render } from 'carrinho/server'

gateway({ origin, remotes: { carrinho: { url: 'https://cdn…/carrinho/vitral.json', render } }, isolate: 'shadow' })
```

O host continua igual:

```html
<vitral-remote name="carrinho" props='{"n":3}' isolate="shadow">
  <p slot="fallback">Carregando…</p>
</vitral-remote>
```

No navegador, o HTML e o CSS do remote aparecem antes de qualquer JS. Com `hydrate`, o remote só liga os eventos no HTML que veio do servidor. Sem `hydrate`, ele monta do jeito normal e troca o HTML do servidor quando termina.

Em React, `reactRender` de `vitral/react-server` faz o `render`, e `reactRemote` (ou o plugin) já exporta o `hydrate`:

```ts
// carrinho/src/server.ts
import { reactRender } from 'vitral/react-server'
import Carrinho from './Carrinho'

export const render = reactRender(Carrinho)
```

Se o `render` falha, a página sai sem o SSR daquele remote e ele monta no navegador. O `onError` do gateway recebe o erro.

## Rotas com SSR

Para um app dividido por rota entre equipes (o caso do Next.js Multi-Zones), passe ao gateway o mesmo mapa de rotas do cliente:

```ts
// gateway
import { gateway } from 'vitral/edge'
import { render as conta } from 'conta/server'
import { render as checkout } from 'checkout/server'

export default {
  fetch: gateway({
    origin: 'https://shell.empresa.com',
    remotes: {
      conta: { url: 'https://cdn.empresa.com/conta/vitral.json', render: conta },
      checkout: { url: 'https://cdn.empresa.com/checkout/vitral.json', render: checkout },
    },
    routes: { '/conta/*': 'conta', '/checkout/*': 'checkout' },
  }),
}
```

```html
<!-- app shell, servido por https://shell.empresa.com -->
<vitral-outlet props='{"loja":"centro"}'><p slot="fallback">Carregando…</p></vitral-outlet>
<script type="module">
  import { configure } from 'vitral'
  import { routes } from 'vitral/routes'

  configure({ remotes: { conta: '/_vitral/conta/vitral.json', checkout: '/_vitral/checkout/vitral.json' } })
  routes({ '/conta/*': 'conta', '/checkout/*': 'checkout' })
</script>
```

O que acontece:

- **Primeira visita:** o gateway renderiza o remote da URL dentro do `<vitral-outlet>` e avisa o navegador para já baixar os arquivos dele. O conteúdo aparece antes de qualquer JS.
- **Troca de rota:** o outlet monta o remote da rota nova no cliente, sem recarregar a página e sem baixar o framework de novo. Com [`vitral/prefetch`](../referencia/prefetch), o remote da rota seguinte já está baixado.

No benchmark contra o Multi-Zones, isso abre a primeira página 27% mais rápido que o Next e troca de rota 4,5 vezes mais rápido. Veja [Benchmark](./benchmark#contra-o-next-js-multi-zones).
