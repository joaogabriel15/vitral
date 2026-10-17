# Configuração

Todas as opções do host e do plugin.

## `configure(opções)`

```ts
import { configure } from 'vitral'

configure({
  remotes: '/remotes.json',
  allowedOrigins: ['https://cdn.empresa.com'],
  timeout: 15000,
  retries: 1,
  isolate: 'none',
})
```

| Opção | Padrão | O que faz |
| --- | --- | --- |
| `remotes` | nenhum | Mapa `nome → URL` ou `nome → entrada`, ou a URL de um JSON com esse mapa |
| `allowedOrigins` | página e URLs registradas | Origens permitidas. Veja [Segurança](./seguranca) |
| `timeout` | `15000` | Tempo máximo de cada download, em ms |
| `retries` | `1` | Novas tentativas do JS em erro de rede |
| `isolate` | `'none'` | `'shadow'` ou `'iframe'` para todos os remotes |
| `styles` | nenhum | `{ inherit, mirrorTheme }`. Veja [Estilos](./estilos) |
| `onMetric` | nenhum | Tempo de cada etapa. Veja [Carregamento](./carregamento#metricas) |
| `devOverrides` | `false` | Veja [Desenvolvimento](./desenvolvimento) |

Pode ser chamado mais de uma vez. As opções são somadas.

## Entrada de um remote

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

Isolamento: o do componente vence o da entrada, que vence o de `configure`.

## `register(nome, entrada)`

```ts
import { register } from 'vitral'

register('carrinho', 'https://cdn.empresa.com/carrinho-v2/vitral.json')
```

`registerSrc(url, nome?)` registra uma URL e devolve o nome. É o que os componentes fazem com `src`.

## Plugin `vitral/vite`

```js
import vitral from 'vitral/vite'

vitral({ entry: 'src/remote.tsx', dedupe: ['react'] })
```

| Opção | Padrão | O que faz |
| --- | --- | --- |
| `entry` | `src/remote.*` ou `src/App.*` | Arquivo cujo `export default` é o remote |
| `adapter` | descoberto pelos plugins do Vite | `react`, `vue`, `svelte`, `solid`, `preact`, `angular`, `element`, ou `false` |
| `name` | `name` do `package.json` | Nome no `vitral.json` |
| `version` | `version` do `package.json` | Versão no `vitral.json` |
| `scopeCss` | `true` | Prefixa o CSS |
| `theme` | nenhum | `'host'`. Veja [Estilos](./estilos) |
| `layers` | nenhum | `'flatten'`. Veja [Estilos](./estilos) |
| `renameRegisteredProperties` | `false` | Veja [Estilos](./estilos) |
| `exposes` | nenhum | Veja [Exposes](./exposes) |
| `dedupe` | nenhum | Veja [Dedupe](./dedupe) |
| `types` | `true` | Gera `vitral.d.ts` |
| `shared` | nenhum | Obsoleta. Use `dedupe` |

## Outros bundlers

O host aceita a URL do JS direto. Qualquer bundler serve, desde que gere um ES module com `mount` no `default`:

```ts
configure({
  remotes: {
    carrinho: { url: 'https://cdn.empresa.com/carrinho/remote.js', css: ['https://cdn.empresa.com/carrinho/remote.css'] },
  },
})
```

Sem o plugin, o CSS não recebe escopo. Use `isolate: 'shadow'`.
