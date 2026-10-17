# register

Registra um remote depois de `configure`, ou troca a URL de um remote.

```ts
register(name: string, entry: string | RemoteEntry): void
registerSrc(src: string, name?: string): string
```

## Uso

```ts
import { register } from 'vitral'

register('carrinho', 'https://cdn.empresa.com/carrinho-v2/vitral.json')
register('menu', { module: () => import('./menu') })
```

## Parâmetros

| Parâmetro | O que é |
| --- | --- |
| `name` | Nome usado em `<Remote name>` |
| `entry` | URL do `vitral.json` ou do JS, ou uma [entrada](./configure#entrada-de-um-remote) |
| `src` (`registerSrc`) | URL a registrar |

## Retorno

`register` não devolve nada. `registerSrc` devolve o nome registrado. É o que os componentes fazem com a prop `src`.

## Observações

- A origem da URL entra na lista de origens permitidas, a menos que `allowedOrigins` tenha sido definido.
- Montagens já feitas não mudam. Use [`refresh`](./updates) para trocar.
