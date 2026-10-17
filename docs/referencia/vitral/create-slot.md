# createSlot

Cuida do ciclo de vida de um remote num elemento: monta, atualiza, troca e mostra o estado. Os componentes de host usam isto por baixo.

```ts
createSlot<P>(target: HTMLElement, options: SlotOptions<P>): RemoteSlot<P>
```

## Uso

```ts
import { createSlot } from 'vitral'

const slot = createSlot(el, {
  name: 'carrinho',
  props: { userId: 42 },
  onStatus(status, erro) {
    el.dataset.status = status
  },
})

slot.update({ userId: 43 })
slot.set({ name: 'carrinho-v2' })
slot.retry()
slot.destroy()
```

## Parâmetros

| Opção | O que é |
| --- | --- |
| `name` | Nome registrado |
| `src` | URL do `vitral.json`. Dispensa `configure` |
| `props` | Props iniciais |
| `isolate` | `'none'`, `'shadow'` ou `'iframe'` |
| `priority` | `'high'` |
| `styles` | Estilos do host no Shadow DOM |
| `onStatus(status, erro)` | Chamado a cada mudança: `'loading'`, `'ready'` ou `'error'` |

## Retorno

| Membro | O que faz |
| --- | --- |
| `update(props)` | Atualiza sem remontar |
| `set({ name, src, isolate })` | Troca de remote ou de isolamento. Remonta |
| `retry()` | Monta de novo |
| `destroy()` | Desmonta e limpa |
| `status` | Estado atual |

## Observações

- Respostas atrasadas de um remote anterior são ignoradas.
