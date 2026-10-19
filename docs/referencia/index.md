# Referência da API

Cada página mostra a assinatura, os parâmetros, o retorno e um exemplo.

## vitral

| Função | Para |
| --- | --- |
| [`configure`](./vitral/configure) | Registrar remotes e opções do host |
| [`register`](./vitral/register) | Registrar um remote depois |
| [`defineRemote`](./vitral/define-remote) | Escrever um remote à mão |
| [`mountRemote`](./vitral/mount-remote) | Montar sem componente |
| [`createSlot`](./vitral/create-slot) | Montar com estado e nova tentativa |
| [`loadModule`](./vitral/load-module) | Baixar sem montar |
| [`events`](./vitral/events) | Eventos entre host e remotes |
| [`navigate`](./vitral/navigate) | Trocar de página |
| [`provide`](./vitral/provide) | Criar estado compartilhado |
| [`shared`](./vitral/shared) | Ler e alterar estado compartilhado |
| [`persist`](./vitral/persist) | Guardar estado no navegador |
| [`component`](./vitral/component) | Remote em JS puro |
| [`watchUpdates`](./vitral/updates) | Trocar de versão sem reload |
| [`RemoteError`](./vitral/remote-error) | Erros |

## Frameworks

| Import | Host | Remote |
| --- | --- | --- |
| [`vitral/react`](./react/remote) | [`<Remote>`](./react/remote) | [`reactRemote`](./react/react-remote), [hooks](./react/hooks) |
| [`vitral/vue`](./vue) | `<VitralRemote>` | `vueRemote` |
| [`vitral/angular`](./angular) | `provideVitral` | `angularRemote` |
| [`vitral/svelte`](./svelte) | `use:remote` | `svelteRemote` |
| [`vitral/solid`](./solid) | `<Remote>` | `solidRemote` |
| [`vitral/preact`](./preact) | `<Remote>` | `preactRemote` |
| [`vitral/element`](./element) | `<vitral-remote>` | `elementRemote` |

## Ferramentas

| Import | Para |
| --- | --- |
| [`vitral/vite`](./vite) | Plugin de build do remote |
| [`vitral/routes`](./routes) | Rotas sem framework |
| [`vitral/iframe`](./iframe) | Isolamento em iframe |
| [`vitral/testing`](./testing) | Remotes falsos em testes |
| [`vitral/devtools`](./devtools) | Trocar URLs em desenvolvimento |
| [`vitral/sentry`](./monitoramento#vitral-sentry) | Erros no Sentry |
| [`vitral/otel`](./monitoramento#vitral-otel) | Erros no OpenTelemetry |
| [`vitral/single-spa`](./single-spa) | App do single-spa como remote |
| [`vitral/federation`](./federation) | Remote do Module Federation no host |
| [`vitral/dict`](/aprender/dicionarios) | Servidor com dicionários de compressão (delta entre deploys) |
| [CLI](./cli) | Tipos das props e migração |

A referência gerada pelo TypeDoc, com todos os tipos, está em [/api/](/api/).
