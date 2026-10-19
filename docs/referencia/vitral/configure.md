# configure

Registra os remotes e define as opções do host.

```ts
configure(config: VitralConfig): void
```

## Uso

```ts
import { configure } from 'vitral'

configure({
  remotes: { carrinho: 'https://cdn.empresa.com/carrinho/vitral.json' },
})
```

Chame antes de renderizar o primeiro remote.

## Parâmetros

| Opção | Padrão | O que faz |
| --- | --- | --- |
| `remotes` | nenhum | Mapa `nome → URL` ou `nome → entrada`, ou a URL de um JSON com esse mapa |
| `allowedOrigins` | página e URLs registradas | Origens permitidas. `['*']` libera tudo. Veja [SRI e origens](/aprender/seguranca) |
| `timeout` | `15000` | Tempo máximo de cada download, em ms |
| `retries` | `1` | Novas tentativas do JS em erro de rede ou `TIMEOUT` |
| `isolate` | `'none'` | `'shadow'` ou `'iframe'` para todos os remotes |
| `styles` | nenhum | `{ inherit, mirrorTheme }`. Veja [Estilos](/aprender/estilos) |
| `onMetric` | nenhum | Recebe `{ name, stage, start, duration }` de cada etapa. Veja [Carregamento](/aprender/carregamento#metricas) |
| `onError` | nenhum | Recebe cada `RemoteError` de qualquer remote, uma vez. Veja [Erros](/aprender/erros#atribuicao-e-onerror-global) |
| `captureGlobalErrors` | `false` | Atribui a um remote os erros sem tratamento que saem do código dele |
| `devOverrides` | `false` | `true` aceita `?vitral=` fora de `localhost`. `{ preview: 'https://{name}-{ref}.preview.empresa.com' }` faz o mesmo e resolve `?vitral=nome@pr-123`. Veja [Desenvolvimento](/aprender/desenvolvimento#link-para-o-preview-de-um-pr) |
| `dedupe` | nenhum | Dependências que o host oferece aos remotes. Veja [Dedupe](/aprender/dedupe) |
| `contract` | nenhum | Faixa do contrato aceita dos remotes, ex.: `'^2'`. Veja [Contrato](/aprender/deploy#contrato-entre-host-e-remote) |

## Retorno

Nada.

## Entrada de um remote

Cada valor de `remotes` é uma URL ou um objeto:

```ts
configure({
  remotes: {
    carrinho: 'https://cdn.empresa.com/carrinho/vitral.json',
    pagamento: {
      url: 'https://cdn.parceiro.com/pagamento/vitral.json',
      integrity: 'sha384-…',
      css: ['https://cdn.parceiro.com/pagamento/tema.css'],
      isolate: 'shadow',
    },
    menu: { module: () => import('./menu') },
  },
})
```

| Campo | O que faz |
| --- | --- |
| `url` | URL do `vitral.json` ou do JS |
| `module` | Remote local, sem rede: o módulo ou uma função que o importa |
| `integrity` | Hash do JS. Vence o do `vitral.json` |
| `css` | CSS extra |
| `isolate` | Isolamento deste remote |
| `manifest` | `vitral.json` embutido |
| `contract` | Faixa do contrato aceita deste remote. Vence a de `configure` |

Isolamento: o do componente vence o da entrada, que vence o de `configure`.

## Outros bundlers

O host aceita a URL do JS direto. Qualquer bundler serve, desde que gere um ES module com `mount` no `default`:

```ts
configure({
  remotes: {
    carrinho: { url: 'https://cdn.empresa.com/carrinho/remote.js', css: ['https://cdn.empresa.com/carrinho/remote.css'] },
  },
})
```

::: warning Atenção
Sem o plugin, o CSS não recebe escopo. Use `isolate: 'shadow'`.
:::

## Observações

- Pode ser chamado mais de uma vez. As opções são somadas.
- Com `remotes` como URL, o JSON é baixado na primeira montagem.
