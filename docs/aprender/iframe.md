# Iframe

Roda o remote num iframe com `sandbox`, sem acesso ao DOM, aos cookies e ao storage do host.

## Quando usar

Para código de terceiros ou legado que mexe em `window`. Para os outros casos, use o modo padrão ou Shadow DOM. Para isolar só o JS e manter o DOM na página, use [Reframe](./reframe).

## Código

```ts
import { enableIframe } from 'vitral/iframe'

enableIframe() // uma vez, no host
```

```html
<vitral-remote name="widget-parceiro" isolate="iframe" props='{"cor":"azul"}'></vitral-remote>
```

```jsx
<Remote name="widget-parceiro" isolate="iframe" />
```

Também vale `register('x', { url, isolate: 'iframe' })` e `configure({ isolate: 'iframe' })`.

- A página confere origem e SRI e manda o JS conferido para o iframe.
- Props, `ctx.events` e `ctx.navigate` funcionam. Só dados serializáveis: funções nas props não passam.
- A altura do iframe acompanha o conteúdo.
- Dentro do remote, use `ctx.events`, não `import { events } from 'vitral'`.
- O [contexto compartilhado](./contexto) não atravessa o iframe.

| Opção de `enableIframe` | Padrão | O que faz |
| --- | --- | --- |
| `sandbox` | `'allow-scripts'` | Valor do atributo `sandbox`. Com `allow-same-origin` o iframe deixa de isolar |
| `bridges` | `[]` | Pontes extras entre página e iframe |

## CSP

O iframe herda o CSP da página. Libere o hash do script do iframe:

```ts
import { createHash } from 'node:crypto'
import { FRAME_SCRIPT } from 'vitral/iframe'

console.log(`'sha256-${createHash('sha256').update(FRAME_SCRIPT).digest('base64')}'`)
```

O hash só muda entre versões da lib.
