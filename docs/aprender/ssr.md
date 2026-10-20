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

O gateway põe dentro do `<vitral-remote>`:

```html
<div data-vitral-ssr data-vitral-slot="carrinho">
  <template shadowrootmode="open">
    <style data-vitral-ssr>/* CSS do remote */</style>
    <div data-vitral-root="carrinho" style="display:contents"><button>itens: 3</button></div>
  </template>
</div>
<p slot="fallback" hidden>Carregando…</p>
```

No navegador:

- O HTML e o CSS aparecem antes de qualquer JS. O fallback fica escondido.
- Com `hydrate`, o `<vitral-remote>` chama `hydrate(el, props, ctx)` com a raiz que veio do servidor. Nada é recriado. O `ctx` é o mesmo do `mount`.
- Sem `hydrate`, monta do jeito normal ao lado e tira o HTML do servidor quando a montagem termina.
- O código de hidratação é baixado sob demanda, só quando há `[data-vitral-ssr]`.

| Caso | O que acontece |
| --- | --- |
| `isolate` sem Shadow DOM | `<link>` do CSS e a raiz direto no `<div data-vitral-ssr>` |
| CSS com hash errado ou `render` que lança | A página sai sem o SSR desse remote; `onError` do gateway recebe o erro |
| `hydrate` lança | Erro `MOUNT_FAILED` no elemento; "Tentar de novo" monta do zero |
| `refresh(nome)` | Troca a versão hidratada por uma montada do jeito normal |

O CSS vai inline no `<style>`: o gateway confere o hash dele antes, porque o navegador não confere.
