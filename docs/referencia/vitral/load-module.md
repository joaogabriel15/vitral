# loadModule

Baixa um remote ou uma parte dele e devolve os exports, sem montar.

```ts
loadModule<T>(name: string): Promise<T>
loadRemote<P>(name: string): Promise<RemoteModule<P>>
preload(name: string): void
```

## Uso

```ts
import { loadModule, preload } from 'vitral'

const api = await loadModule<typeof import('./tipos/carrinho-api')>('carrinho/api')
api.adicionar(item)

link.addEventListener('pointerenter', () => preload('checkout'), { once: true })
```

## Parâmetros

| Parâmetro | O que é |
| --- | --- |
| `name` | Nome registrado, ou `remote/parte` para uma parte de [`exposes`](/aprender/exposes) |

## Retorno

| Função | Devolve |
| --- | --- |
| `loadModule` | Os exports do módulo |
| `loadRemote` | O objeto com `mount` |
| `preload` | Nada. Só baixa |

## Observações

- Passa pela mesma checagem de origem e SRI.
- Cada remote é baixado uma vez por página.
- Parte que não existe gera [`NOT_EXPOSED`](/erros/NOT_EXPOSED).
