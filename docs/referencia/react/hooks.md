# Hooks do React

Hooks para usar dentro de um remote ou de um host React. Também existem em `vitral/preact` (`useShared`).

```ts
useVitral(): RemoteContext | null
useEvent<T>(type: string, handler: (payload: T) => void): void
useEventValue<T>(type: string): T | undefined
useShared<T, S>(key: string, select?: (value: T | undefined) => S): S
```

## Uso

```jsx
import { useVitral, useEvent, useEventValue, useShared } from 'vitral/react'

function Carrinho() {
  const ctx = useVitral()
  const total = useEventValue('carrinho:total')
  useEvent('carrinho:limpo', () => alert('Vazio'))
  const nome = useShared('usuario', (u) => u?.nome)
  return <button onClick={() => ctx?.navigate('/checkout')}>{nome}: {total}</button>
}
```

## useVitral

Devolve o [`ctx`](/referencia/vitral/define-remote#ctx) do remote, ou `null` fora de um remote.

## useEvent

Assina um [evento](/referencia/vitral/events) enquanto o componente existe.

## useEventValue

Último valor de um evento. Re-renderiza a cada `emit`.

## useShared

Valor de uma chave do [contexto compartilhado](/referencia/vitral/shared). Com seletor, só re-renderiza quando o resultado muda.

| Parâmetro | O que é |
| --- | --- |
| `key` | Nome da chave |
| `select` | Opcional. Função que escolhe parte do valor |

Para alterar, use `shared(key).set(valor)`.
