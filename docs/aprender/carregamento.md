# Lazy, prefetch e keep-alive

Controla quando cada remote baixa e monta.

## Quando usar

- `loading="lazy"`: remote abaixo da dobra (comentários, rodapé).
- `prefetch="hover"`: remote aberto por um link ou botão.
- `priority="high"`: remote que aparece logo ao abrir a página.
- `keepAlive`: remote que o usuário abre e fecha várias vezes (abas, rotas).

## Código

```html
<!-- monta perto de aparecer na tela; reserve o espaço -->
<vitral-remote name="comentarios" loading="lazy" style="display:block;min-height:400px"></vitral-remote>
<!-- monta com o navegador ocioso, mas baixa no hover -->
<vitral-remote name="checkout" loading="idle" prefetch="hover"></vitral-remote>
<!-- aparece logo ao abrir -->
<vitral-remote name="cabecalho" priority="high"></vitral-remote>
```

```jsx
<Remote name="checkout" loading="lazy" prefetch="visible" keepAlive />
```

Baixar sem montar:

```ts
import { preload } from 'vitral'

link.addEventListener('pointerenter', () => preload('checkout'), { once: true })
```

| Opção | Valores | O que faz |
| --- | --- | --- |
| `loading` | `lazy`, `idle` | Monta a 200px de aparecer na tela, ou com o navegador ocioso |
| `prefetch` | `hover`, `visible`, `idle` | Chama `preload()` antes de montar |
| `priority` | `high` | Prioridade alta no download do manifesto, do JS e do CSS |
| `keepAlive` (`keep-alive`) | `true` ou um número | Guarda o remote ao sair da página (padrão: até 5). Na volta só recebe as props novas |

Cada remote é baixado uma vez por página, mesmo com várias instâncias.

## Keep-alive

Com keep-alive, pause timers quando o remote sai da tela:

```js
mount(el, props, ctx) {
  let timer = setInterval(tick, 1000)
  ctx.onDeactivate?.(() => clearInterval(timer))
  ctx.onActivate?.(() => (timer = setInterval(tick, 1000)))
  return { unmount: () => clearInterval(timer) }
}
```

## Tempo limite e novas tentativas

```ts
configure({ timeout: 15000, retries: 1 })
```

| Opção | Padrão | O que faz |
| --- | --- | --- |
| `timeout` | `15000` | Tempo máximo de cada download, em ms |
| `retries` | `1` | Novas tentativas do JS em erro de rede ou `TIMEOUT` |

## Métricas

```ts
configure({
  onMetric: ({ name, stage, duration }) => rum.send(`vitral.${stage}`, duration, { remote: name }),
})
```

`stage` é `manifest`, `js`, `css` ou `mount`. As etapas também aparecem na aba Performance do DevTools como `vitral:<remote>:<etapa>`.

LCP, CLS e INP de cada remote, por rota: [vitral/vitals](/referencia/vitals).

## Cache no CDN

| Arquivo | `Cache-Control` |
| --- | --- |
| `vitral.json` | `no-cache` |
| `remote-*.js`, `remote-*.css` | `public, max-age=31536000, immutable` |
