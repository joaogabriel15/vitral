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

`preload('checkout', { routes: true })` também aquece no cache HTTP, com o navegador ocioso, os chunks que o remote só baixa depois (`import()` das rotas). A primeira tela de cada rota abre sem download.

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

Conta as navegações no navegador do usuário e, no tempo ocioso, baixa o manifesto e o JS da rota mais provável, sem executar e com o SRI conferido. Veja [vitral/prefetch](/referencia/prefetch).

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

O `vitral.json` é o único arquivo sem hash no nome, então o host sempre o revalida: na visita de volta, cada remote espera uma ida e volta antes de rodar, mesmo com o JS no cache. Com `maxStale`, o host usa o manifesto salvo na última visita, se ele tiver até N segundos, e baixa o novo por trás para a visita seguinte.

```ts
configure({ maxStale: 300 }) // 5 minutos
```

| Situação | O que acontece |
| --- | --- |
| Cópia salva com até `maxStale` segundos | Monta com ela, sem esperar a rede. O manifesto novo baixa ao mesmo tempo e fica salvo |
| Cópia mais velha, corrompida ou ausente | Espera o manifesto da rede, como sem `maxStale` |
| `localStorage` bloqueado | Igual a sem `maxStale` |

O custo: um deploy novo, ou um [rollback](/aprender/canary), chega uma visita depois para quem tinha a cópia salva. Os arquivos antigos continuam no CDN (nomes com hash), então a versão velha monta inteira. Use um valor que caiba no tempo que você aceita para um rollback chegar a todos. Medição em [Benchmark](/aprender/benchmark#visita-de-volta-com-maxstale).

## Compile hints do V8

```ts
vitral({ compileHints: true })
```

O plugin põe `//# allFunctionsCalledOnLoad` no topo da entrada do remote, dos chunks que ela importa e das cópias do [dedupe](/aprender/dedupe). O Chrome 136+ compila esses arquivos inteiros de uma vez, numa thread de fundo, em vez de compilar cada função quando ela roda pela primeira vez ([V8](https://v8.dev/blog/explicit-compile-hints)). Os `import()` do app ficam de fora. Firefox e Safari ignoram o comentário.

Medição com 4 remotes (3 React e 1 Vue), Slow 4G, mediana de 9 visitas alternadas:

| | Sem hint | Com hint |
| --- | --: | --: |
| CPU 4x mais lenta, sem dedupe: 1ª visita | 2684 ms | 2548 ms (-5%) |
| CPU 4x mais lenta, sem dedupe: visita de volta | 1388 ms | 1192 ms (-14%) |
| CPU 4x mais lenta, com dedupe: 1ª visita | 1968 ms | 1878 ms (-5%) |
| CPU 4x mais lenta, com dedupe: visita de volta | 1320 ms | 1188 ms (-10%) |
| CPU normal, 1ª visita | sem diferença medida | |
| Heap JS depois de montar | 2,18–2,39 MB | 2,62–3,05 MB (+20% a +28%) |

Ligue quando o público usa celulares com CPU fraca e o remote roda logo ao abrir a página. Deixe desligado (o padrão) quando memória pesa mais que tempo de CPU.

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
