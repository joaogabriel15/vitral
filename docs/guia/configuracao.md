# Configuração

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
| `allowedOrigins` | origem da página e das URLs registradas | Origens de onde é permitido carregar código. `['*']` libera tudo |
| `timeout` | `15000` | Tempo máximo de cada download, em ms |
| `retries` | `1` | Novas tentativas do JS em erro de rede ou `TIMEOUT` |
| `isolate` | `'none'` | `'shadow'` coloca todos os remotes em Shadow DOM |

Pode ser chamado mais de uma vez. As opções são mescladas e os remotes são somados.

## Entrada de um remote

Cada remote aceita uma URL ou um objeto:

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
| `module` | Remote local, sem rede: o módulo ou uma função que o importa. Útil em monorepos e testes |
| `integrity` | Hash SRI do JS. Vence o do `vitral.json` |
| `css` | CSS extra, além do que está no `vitral.json` |
| `isolate` | Isolamento padrão deste remote |

## `register(nome, entrada)`

Registra ou troca um remote depois do `configure`:

```ts
import { register } from 'vitral'

register('carrinho', 'https://cdn.empresa.com/carrinho-v2/vitral.json')
```

## Ordem de precedência do isolamento

1. `isolate` no componente (`<Remote isolate="shadow">`);
2. `isolate` na entrada do remote;
3. `isolate` em `configure`.

## `vitral.json`

| Campo | O que é |
| --- | --- |
| `name` | Nome do remote |
| `version` | Versão, do `package.json` |
| `entry` | Caminho do JS, relativo ao `vitral.json` |
| `css` | Arquivos de CSS, relativos ao `vitral.json` |
| `integrity` | Hash SRI do JS |
| `scope` | Nome usado no prefixo do CSS (`[data-vitral-scope]`) |
