# vitral/vitals

LCP, CLS e INP de cada remote, por rota. FCP e TTFB da página. Sem dependência: usa `PerformanceObserver`.

```ts
vitals(options: { onReport: (report: VitalReport) => void }): () => void
```

```ts
import { vitals } from 'vitral/vitals'

const stop = vitals({
  onReport: (r) => navigator.sendBeacon('/rum', JSON.stringify(r)),
})
```

Chame uma vez, cedo, no host. `stop()` relata o que falta e desliga a medição.

## VitalReport

```ts
{
  name: 'LCP' | 'CLS' | 'INP' | 'FCP' | 'TTFB'
  remote?: string        // ausente: host ou página
  version?: string       // versão do manifesto do remote
  route: string          // pathname da navegação
  navigationId?: string  // só com Soft Navigations
  value: number          // ms; CLS sem unidade
  rating: 'good' | 'needs-improvement' | 'poor'
}
```

Exemplo:

```json
{ "name": "CLS", "remote": "carrinho", "version": "1.4.2", "route": "/loja", "value": 0.18, "rating": "needs-improvement" }
```

## De quem é cada métrica

O dono é o remote cujo elemento raiz (`data-vitral-root`) contém o elemento da entrada. Shadow DOM é atravessado. Com remotes aninhados, ganha o mais interno.

| Métrica | Elemento | Valor |
| --- | --- | --- |
| LCP | `element` do maior paint da navegação | um por navegação, com o dono do maior paint |
| CLS | a maior fonte (`sources`) de cada shift | soma por janela de sessão (1 s de intervalo, 5 s no máximo), por dono |
| INP | `target` da interação | pior interação por dono, ignorando uma a cada 50 |
| FCP, TTFB | - | da página, sem `remote` |

A fonte de um layout shift é o elemento que se moveu. Um remote que cresce e empurra o host gera shift do host, não do remote.

Shifts até 500 ms depois de um input do usuário não contam (`hadRecentInput`).

## Rotas e Soft Navigations

| Navegador | Rota | `navigationId` |
| --- | --- | --- |
| Chromium com Soft Navigations | URL da entrada `soft-navigation` | sim |
| Outros | `location.pathname` na hora da entrada | não |

Com Soft Navigations, o LCP da rota é medido a partir do início da navegação soft.

Cada métrica sai quando a rota muda, quando a aba fica oculta e no `stop()`. Só sai de novo se o valor mudou.

## Suporte

| Métrica | Chromium | Firefox | Safari |
| --- | --- | --- | --- |
| LCP | sim | sim | depende da versão |
| CLS | sim | não | não |
| INP | sim | depende da versão | depende da versão |
| FCP, TTFB | sim | sim | sim |

O que o navegador não mede não sai. Nada quebra e nada é relatado com dono errado.

## OpenTelemetry

`otelVitals`, de `vitral/otel`, grava cada relatório num histograma `vitral.vitals.<lcp|cls|inp|fcp|ttfb>`.

```ts
import { metrics } from '@opentelemetry/api'
import { otelVitals } from 'vitral/otel'
import { vitals } from 'vitral/vitals'

vitals({ onReport: otelVitals(metrics.getMeter('host')) })
```

Unidade `ms` (`1` no CLS). Atributos: `vitral.remote`, `vitral.version`, `vitral.route`, `vitral.navigation_id` e `vitral.rating`. Os ausentes ficam de fora.

## Limites

- Remote com `isolate: 'iframe'`: o conteúdo do iframe não chega ao observer da página. Só o próprio iframe é atribuído.
- Sem Soft Navigations, um shift que chega logo depois de um `pushState` fica com a rota nova.
- A soma do CLS de cada dono não é o CLS da página: as janelas de sessão são separadas por dono.
