# events

Barramento de eventos da página. Host e todos os remotes usam o mesmo.

```ts
events.emit<T>(type: string, payload?: T): void
events.on<T>(type: string, handler: (payload: T) => void): () => void
events.last<T>(type: string): T | undefined
createEventBus(): EventBus
```

## Uso

```ts
import { events } from 'vitral'

events.emit('carrinho:total', 120)
const parar = events.on('carrinho:total', (total) => console.log(total))
events.last('carrinho:total') // 120
parar()
```

## Métodos

| Método | O que faz |
| --- | --- |
| `emit(tipo, valor)` | Envia o evento |
| `on(tipo, fn)` | Assina. Devolve a função que cancela |
| `last(tipo)` | Último valor emitido, mesmo para quem assinou depois |

## Retorno

`on` devolve a função que cancela. `createEventBus()` devolve um barramento separado, com os mesmos métodos.

## Observações

- Dentro do remote, use `ctx.events`. As assinaturas são canceladas no unmount.
- Um handler que lança erro não impede os outros.
- Use um prefixo no nome (`carrinho:`) para saber quem emite.
- A lib emite `vitral:update-available`. Veja [`watchUpdates`](./updates).
