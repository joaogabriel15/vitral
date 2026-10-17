# vitral/iframe

Liga `isolate: 'iframe'`: o remote roda num iframe com `sandbox`.

```ts
enableIframe(options?: IframeOptions): void
FRAME_SCRIPT: string
```

## Uso

```ts
import { enableIframe } from 'vitral/iframe'

enableIframe()
```

```jsx
<Remote name="widget-parceiro" isolate="iframe" />
```

## Parâmetros

| Opção | Padrão | O que faz |
| --- | --- | --- |
| `sandbox` | `'allow-scripts'` | Valor do atributo `sandbox` |
| `bridges` | `[]` | Pontes extras: `(port, { name }) => limpeza` |

## Retorno

Nada.

## Observações

::: warning Atenção
Com `allow-same-origin` e `allow-scripts` juntos, o iframe deixa de isolar.
:::

- Só dados serializáveis passam. Funções nas props não passam.
- O contexto compartilhado não atravessa o iframe.
- `FRAME_SCRIPT` é o script do iframe. Use para calcular o hash do CSP. Veja [Iframe](/aprender/iframe#csp).
