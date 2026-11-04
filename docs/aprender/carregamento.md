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

`preload('checkout', { routes: true })` também baixa, com o navegador ocioso, o código das outras rotas do remote.

| Opção | Valores | O que faz |
| --- | --- | --- |
| `loading` | `lazy`, `idle` | Monta a 200px de aparecer na tela, ou com o navegador ocioso |
| `prefetch` | `hover`, `visible`, `idle` | Chama `preload()` antes de montar |
| `priority` | `high` | Prioridade alta no download do manifesto, do JS e do CSS |
| `keepAlive` (`keep-alive`) | `true` ou um número | Guarda o remote ao sair da página (padrão: até 5). Na volta só recebe as props novas |

Cada remote é baixado uma vez por página, mesmo com várias instâncias.

## Prefetch preditivo

Pré-carrega o remote da rota que o usuário costuma abrir em seguida:

```ts
import { prefetch } from 'vitral/prefetch'

prefetch()
```

Aprende com as navegações do próprio usuário e, com o navegador ocioso, baixa o remote da rota mais provável, sem executar. Veja [vitral/prefetch](/referencia/prefetch).

## Rede lenta e aparelho fraco

Com economia de dados ligada ou rede 2G, o vitral baixa só o que a página usa agora e deixa de pré-carregar. Em 3G ou em aparelhos com pouca memória, ele corta o pré-carregamento dos outros remotes. Safari e Firefox não informam esses sinais, então lá tudo é baixado como pedido. Para fixar o comportamento:

```ts
configure({ policy: 'critical' }) // 'all', 'critical' ou 'lazy'
```

## Última tela na visita de volta

Com `snapshot`, o remote guarda a tela que mostrava ao sair. Na próxima vez que monta com as mesmas props, essa tela aparece na hora, no lugar do "carregando", enquanto o JS baixa. Ela sai quando o remote monta.

```ts
import { snapshots } from 'vitral/snapshot'

snapshots()
```

```tsx
<Remote name="pedidos" snapshot />                 // vitral/react
<vitral-remote name="pedidos" snapshot></vitral-remote>
```

A tela guardada não responde a clique, fica no `sessionStorage` (some ao fechar a aba) e vem com o CSS do remote. Chame `clearSnapshots()` no logout. Não funciona com Shadow DOM.

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

## Visita de volta sem esperar o manifesto

Na visita de volta, cada remote espera o `vitral.json` chegar da rede antes de rodar, mesmo com o JS no cache. Com `maxStale`, o host usa o manifesto salvo na última visita, se ele tiver até N segundos, e baixa o novo por trás:

```ts
configure({ maxStale: 300 }) // 5 minutos
```

O custo: um deploy novo, ou um [rollback](/aprender/canary), chega uma visita depois para quem tinha a cópia salva.

## Compilar de uma vez (Chrome)

```ts
vitral({ compileHints: true })
```

O Chrome compila o JS do remote de uma vez, numa thread de fundo, em vez de função por função. Em celulares com CPU fraca, a visita de volta ficou 10% a 14% mais rápida no nosso teste, com cerca de 25% mais memória. Ligue quando o público usa celulares fracos e o remote aparece logo ao abrir a página.

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
