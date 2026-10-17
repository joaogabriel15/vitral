# mountRemote

Monta um remote dentro de um elemento, sem componente de framework.

```ts
mountRemote<P>(target: HTMLElement, name: string, props: P, options?: MountOptions): Promise<MountedRemote<P>>
```

## Uso

```ts
import { mountRemote } from 'vitral'

const carrinho = await mountRemote(document.getElementById('carrinho')!, 'carrinho', { userId: 42 })
carrinho.update?.({ userId: 43 })
carrinho.unmount()
```

## Parâmetros

| Parâmetro | O que é |
| --- | --- |
| `target` | Elemento que recebe o remote |
| `name` | Nome registrado |
| `props` | Props iniciais |
| `options.isolate` | `'none'`, `'shadow'` ou `'iframe'` |
| `options.priority` | `'high'` para baixar com prioridade |
| `options.styles` | Estilos do host no Shadow DOM |
| `options.onError` | Chamado quando o remote quebra depois de montado |

## Retorno

Uma Promise com `{ update?, unmount }`. Rejeita com [`RemoteError`](./remote-error) se o remote não carregar.

## Observações

- Com [`refresh(nome)`](./updates), o mesmo objeto passa a apontar para a versão nova.
- Para fallback, erro e nova tentativa, use [`createSlot`](./create-slot).
