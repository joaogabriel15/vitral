# shared

Lê e altera uma chave do contexto compartilhado.

```ts
shared<T>(key: string): SharedValue<T>
batch<R>(fn: () => R): R
```

## Uso

```ts
import { shared } from 'vitral'

const tema = shared('tema')
tema.get()                                // 'claro'
const parar = tema.subscribe((t) => {})   // chama agora e a cada mudança
shared('usuario').update((u) => ({ ...u, nome: 'Caio' }))
```

## Parâmetros

| Parâmetro | O que é |
| --- | --- |
| `key` | Nome da chave |

## Retorno

| Método | O que faz |
| --- | --- |
| `get()` | Valor atual. `undefined` se ninguém deu valor |
| `set(valor)` | Troca o valor |
| `update(fn)` | Troca a partir do valor atual |
| `subscribe(fn)` | Chama agora e a cada mudança. Devolve a função que cancela |
| `key` | O nome da chave |

## batch

```ts
import { batch } from 'vitral'

batch(() => {
  usuario.set(novo)
  carrinho.set([])
}) // cada chave notifica uma vez, no fim
```

## Tipos

```ts
declare module 'vitral' {
  interface Shared {
    usuario: { id: number; nome: string } | null
    tema: 'claro' | 'escuro'
  }
}
```

## Observações

- Dentro do remote, `ctx.shared` é o mesmo `shared`, com as assinaturas canceladas no unmount.
- Cada framework tem um hook. Veja [Contexto compartilhado](/aprender/contexto#em-cada-framework).
- O contexto não atravessa o [iframe](/aprender/iframe).
