# Tratamento de erros

Um remote que falha mostra o próprio erro. O resto da página continua funcionando.

## Quando usar

Em todo host: defina o que mostrar quando um remote falhar.

## Código

```jsx
<Remote
  name="carrinho"
  error={(erro, tentarDeNovo) => <button onClick={tentarDeNovo}>Tentar de novo</button>}
  onError={(erro) => log(erro.code, erro.remote)}
/>
```

```html
<vitral-remote name="carrinho">
  <p slot="error">Indisponível</p>
</vitral-remote>
<script>
  document.querySelector('vitral-remote').addEventListener('vitral-error', (e) => log(e.detail.error.code))
</script>
```

Todo erro é um `RemoteError`:

| Campo | O que é |
| --- | --- |
| `code` | Código do erro. Veja a [lista](/erros/) |
| `remote` | Nome do remote |
| `docs` | Link da página do código, com causa e correção |

`retry` monta só aquele remote de novo.

## No remote

Em React e Vue, erros de render vão para o host. Nos outros, avise o host:

```ts
mount(el, props, ctx) {
  try {
    desenhar(el, props)
  } catch (erro) {
    ctx.reportError(erro)
  }
  return { unmount() {} }
}
```

## Atribuição e `onError` global

Todo `RemoteError` diz de qual remote veio e em que estado a página estava:

| Campo | O que é |
| --- | --- |
| `remote` | Nome do remote |
| `version` | Campo `version` do `vitral.json`. O plugin do Vite preenche com a versão do `package.json` do remote |
| `entry` | URL do JS do remote. Se o erro aconteceu antes do manifesto, a URL registrada |
| `route` | `location.pathname` no momento do erro |

Para mandar os erros de todos os remotes ao monitoramento, passe `onError` no `configure`:

```ts
configure({
  remotes: { carrinho: 'https://cdn.empresa.com/carrinho/vitral.json' },
  onError(erro) {
    monitoramento.enviar(erro, { remote: erro.remote, versao: erro.version, rota: erro.route })
  },
})
```

O `onError` do `configure` recebe cada erro uma vez: falha de download, `TIMEOUT`, `INTEGRITY`, falha de `mount` e erros de render enviados por `ctx.reportError`. O `onError` de cada montagem (`<Remote onError>`, `mountRemote(..., { onError })`) continua sendo chamado. Um erro que passa pelos dois chega uma vez em cada.

### Sentry

`vitral/sentry` chama `Sentry.captureException` com as tags `vitral.remote`, `vitral.version` e `vitral.code`. Não depende do SDK: recebe o objeto do Sentry.

```ts
import * as Sentry from '@sentry/browser'
import { configure } from 'vitral'
import { sentryOnError } from 'vitral/sentry'

configure({ onError: sentryOnError(Sentry) })
```

### OpenTelemetry

`vitral/otel` grava um evento `exception` no span ativo. Sem span ativo, abre um span `vitral.error` com o `tracer` e registra o erro nele. Não depende do `@opentelemetry/api`: recebe `trace` e `tracer`.

```ts
import { trace } from '@opentelemetry/api'
import { configure } from 'vitral'
import { otelOnError } from 'vitral/otel'

configure({ onError: otelOnError({ trace, tracer: trace.getTracer('host') }) })
```

### Erros sem tratamento

Um erro que o remote não captura chega em `error` ou `unhandledrejection` da janela, sem nome de remote. Com `captureGlobalErrors`, o vitral confere o arquivo do topo da pilha e, se ele estiver na pasta do JS de um remote montado, entrega o erro ao `onError` como `RENDER_FAILED` daquele remote:

```ts
configure({ onError: sentryOnError(Sentry), captureGlobalErrors: true })
```

O erro não é atribuído quando:

- a pasta do remote também tem scripts do host (`<script src>` ou `modulepreload` na página);
- a pilha não tem URL, ou tem uma URL `blob:` (SRI sem suporte do navegador a `integrity` em módulos);
- o remote já enviou o erro com `ctx.reportError`.

Nesses casos o erro segue para o tratamento normal da página.
