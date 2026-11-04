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

1. A cada navegação, conta a transição para a rota atual a partir de cada contexto: a rota anterior, as duas e as três últimas (cadeia de Markov de ordens 1 a 3).
2. A cada montagem, guarda o remote na rota atual e quantos bytes ele baixou.
3. No tempo ocioso, prevê a rota seguinte pelo contexto mais longo que tem pelo menos `min` transições e confiança de pelo menos `threshold`. Sem ele, usa um contexto mais curto (Selective Markov Models, Deshpande e Karypis, 2004).
4. Baixa os remotes da rota prevista só se a probabilidade vezes o tempo poupado passa o custo dos bytes: `p × (2 × RTT + bytes ÷ banda) > byteCost × bytes`, com o RTT e a banda que o navegador estima agora. Na rede lenta, uma previsão menos certa já vale; na rápida, só uma bem certa.
5. Num `pointerdown` em link para outra rota, baixa os remotes dela na hora, cerca de 100 ms antes do clique.

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
| `threshold` | `0.1` | Probabilidade mínima da rota seguinte, antes da conta de custo |
| `min` | `2` | Transições contadas num contexto antes de usá-lo |
| `prior` | | Transições da população, para a primeira visita: o objeto ou a URL do JSON (veja abaixo) |
| `alpha` | `5` | Peso da população, em transições: contagens do usuário + `alpha` × população |
| `byteCost` | `0.0005` | Custo de cada byte baixado à toa, em ms de espera (100 kB valem 50 ms). `0` desliga a conta |
| `speculate` | `false` | Speculation Rules (Chrome 121+) para a rota prevista que não tem remote: o navegador baixa o documento dela. Só com a `key` padrão |
| `storage` | `localStorage` | Onde guardar as contagens. `null` guarda só na memória |
| `key` | `url.pathname` | Chave da rota |
| `onPrefetch` | | `(remotes, rota) => void`, depois de baixar |

Rotas com parâmetro viram uma chave só com `key`:

```ts
import { matchRoute } from 'vitral/routes'

prefetch({ key: (url) => matchRoute(url.pathname)?.pattern ?? url.pathname })
```

## População na primeira visita

Sem contagens, o usuário novo não tem previsão. `prior` mistura as transições de muita gente com as dele:

```ts
prefetch({ prior: '/vitral-prior.json' })
```

O JSON sai de sessões agregadas (por exemplo, a exportação do analytics), uma por linha, cada uma um array de rotas:

```bash
vitral prior sessoes.jsonl --out public/vitral-prior.json
```

Transições vistas menos de 5 vezes (`--min-count`) e rotas com menos de 20 transições (`--min-row`) ficam de fora, para o arquivo público não mostrar o caminho de ninguém. O campo `r` (rota → remotes) é opcional: sem ele, a primeira visita prevê a rota mas só baixa os remotes que o usuário já montou nela.

## Retorno

`prefetch` devolve a função que para de observar. As contagens continuam guardadas.

`warm(nome)` pré-carrega um remote na hora, do mesmo jeito. Devolve `false` se não deu (sem erro no console).

## Observações

- Não baixa nada com a política `'lazy'` (economia de dados ou 2G). Veja [Rede lenta e aparelho fraco](/aprender/carregamento#rede-lenta-e-aparelho-fraco).
- Cada remote é pré-carregado uma vez por página. Remote já montado na página não baixa de novo.
- As contagens ficam em `localStorage['vitral:prefetch']`, com no máximo 150 contextos, 10 destinos por contexto e 8 remotes por rota.
- Remote com `isolate: 'iframe'` não é pré-carregado.
- As cópias de `dedupe` do remote não são pré-carregadas: só a montagem sabe se alguém na página já oferece a dependência.
- Detecta a navegação pela Navigation API onde ela existe; nos outros navegadores, por `popstate` e pelas montagens.
