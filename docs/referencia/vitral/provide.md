# provide

Cria uma chave do contexto compartilhado e vira o dono dela.

```ts
provide<T>(key: string, value: T, options?: { writable?: boolean }): ProvidedValue<T>
```

## Uso

```ts
import { provide } from 'vitral'

const usuario = provide('usuario', { id: 42, nome: 'Ana' })
provide('tema', 'claro', { writable: false })
provide('auth', { getToken: () => sessao.token })

usuario.set({ id: 7, nome: 'Bia' })
```

## Parâmetros

| Parâmetro | O que é |
| --- | --- |
| `key` | Nome da chave |
| `value` | Valor inicial. Pode ter funções |
| `options.writable` | `false`: só o dono altera. Padrão `true` |

## Retorno

O mesmo objeto de [`shared`](./shared): `get`, `set`, `update`, `subscribe`. O dono sempre pode chamar `set`.

## Observações

- O primeiro `provide` de uma chave é o dono. Um segundo `provide` da mesma chave não grava nada.
- Em chave com `writable: false`, `set` de outro lugar lança [`SHARED_READONLY`](/erros/SHARED_READONLY) em desenvolvimento.
- Trate o valor como imutável. Para mudar, passe um valor novo.
