# navigate

Troca a URL da página. Todos os roteadores leem a URL nova.

```ts
navigate(url: string, options?: { replace?: boolean }): void
```

## Uso

```ts
import { navigate } from 'vitral'

navigate('/pedidos/42')
navigate('/login', { replace: true })
```

## Parâmetros

| Parâmetro | O que é |
| --- | --- |
| `url` | Endereço novo |
| `options.replace` | `true` troca a entrada atual do histórico |

## Retorno

Nada.

## Observações

- Atualiza o histórico e dispara `popstate`. React Router, Vue Router, Next, Nuxt e os outros roteadores reagem.
- URL de outra origem recarrega a página.
- Dentro do remote, `ctx.navigate` faz o mesmo.
