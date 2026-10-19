# vitral/prefetch

Pré-carrega o remote da próxima rota provável, com base nas navegações do próprio usuário.

```ts
prefetch(options?: PrefetchOptions): () => void
warm(name: string): Promise<boolean>
```

## Uso

```ts
import { configure } from 'vitral'
import { routes } from 'vitral/routes'
import { prefetch } from 'vitral/prefetch'

configure({ remotes: '/remotes.json' })
routes({ '/': 'inicio', '/busca': 'busca', '/checkout/*': 'checkout' })
prefetch()
```

Funciona com `<vitral-outlet>`, `<Remote>`, `createSlot` e `mountRemote`: o que conta é qual remote montou em qual rota.

## Como funciona

1. A cada navegação, conta a transição `rota anterior → rota atual` (cadeia de Markov de primeira ordem).
2. A cada montagem, guarda o remote na rota atual.
3. No tempo ocioso, pega a rota seguinte mais provável. Se a probabilidade passa de `threshold`, baixa os remotes dela.

O pré-carregamento baixa o `vitral.json` e os arquivos do remote, sem executar nada:

| Remote | Como baixa |
| --- | --- |
| Com integrity, navegador com import map com `integrity` | Import map com os hashes e `fetch` (cache HTTP) |
| Com integrity, navegador que confere o hash do `modulepreload` | `<link rel="modulepreload" integrity>` |
| Com integrity, nos outros (WebKit com CSP, por exemplo) | `fetch` (cache HTTP); o hash é conferido na montagem |
| Sem integrity | `<link rel="modulepreload">` |

É o mesmo caminho de SRI que a montagem usa (veja [Segurança](/aprender/seguranca)). O WebKit ignora o `integrity` do `modulepreload`, então nele só há `fetch`.

## Opções

| Opção | Padrão | O que faz |
| --- | --- | --- |
| `threshold` | `0.4` | Probabilidade mínima da rota seguinte |
| `min` | `2` | Transições contadas a partir da rota atual antes de prever |
| `storage` | `localStorage` | Onde guardar as contagens. `null` guarda só na memória |
| `key` | `url.pathname` | Chave da rota |
| `onPrefetch` | | `(remotes, rota) => void`, depois de baixar |

Rotas com parâmetro viram uma chave só com `key`:

```ts
import { matchRoute } from 'vitral/routes'

prefetch({ key: (url) => matchRoute(url.pathname)?.pattern ?? url.pathname })
```

## Retorno

`prefetch` devolve a função que para de observar. As contagens continuam guardadas.

`warm(nome)` pré-carrega um remote na hora, do mesmo jeito. Devolve `false` se não deu (sem erro no console).

## Observações

- Não baixa nada com economia de dados (`saveData`) nem em 2G.
- Cada remote é pré-carregado uma vez por página. Remote já montado na página não baixa de novo.
- As contagens ficam em `localStorage['vitral:prefetch']`, com no máximo 50 rotas, 10 destinos por rota e 8 remotes por rota.
- Remote com `isolate: 'iframe'` não é pré-carregado.
- As cópias de `dedupe` do remote não são pré-carregadas: só a montagem sabe se alguém na página já oferece a dependência.
- Detecta a navegação pela Navigation API onde ela existe; nos outros navegadores, por `popstate` e pelas montagens.
