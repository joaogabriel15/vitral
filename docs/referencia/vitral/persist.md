# persist

Guarda uma chave compartilhada no navegador e espelha entre abas.

```ts
persist<V>(value: V, options?: PersistOptions): V
syncTabs<V>(value: V): V
serializeShared(values: Record<string, unknown>): string
```

## Uso

```ts
import { persist, provide, syncTabs } from 'vitral'

const carrinho = syncTabs(persist(provide('carrinho', []), { version: 1 }))
```

## Parâmetros

| Opção de `persist` | Padrão | O que faz |
| --- | --- | --- |
| `storage` | `'local'` | `'local'` ou `'session'` |
| `version` | `1` | Versão do formato. Suba ao mudar o formato do valor |

## Retorno

O mesmo objeto recebido.

## serializeShared

No servidor, transforma valores em JSON seguro para `<script>`:

```ts
import { serializeShared } from 'vitral'

const html = `<script type="application/json" data-vitral-shared>${serializeShared({ usuario })}</script>`
```

Veja [SSR](/aprender/ssr).

## Observações

- A chave no storage é `vitral:<chave>:<versão>`.
- Valores que não viram JSON não são guardados.
- Sem storage (servidor, modo privado bloqueado), não faz nada.
- Chame `syncTabs` no dono.
