# Benchmark contra o Module Federation e o Multi-Zones

Host do vitral e host do runtime oficial do Module Federation (MF) carregando os mesmos N remotes, no Chromium, com rede lenta fixa. Todos os números abaixo saíram de `bench/publico/run.mjs`, na máquina listada em [Versões](#versoes-e-maquina).

A comparação com o Next.js Multi-Zones, que divide o app por rota e não por pedaço de página, está em [Contra o Next.js Multi-Zones](#contra-o-next-js-multi-zones).

## Resultado

Mediana de 7 repetições. Rede "Slow 4G" (150 ms de RTT, 1,6 Mbps). Sem throttling de CPU. kB = 1024 bytes, com brotli e cabeçalhos HTTP.

| Cenário | N | Frio (ms) | Quente (ms) | Transferido frio (kB) | Requisições frio | Requisições quente | Heap (MB) |
| --- | --: | --: | --: | --: | --: | --: | --: |
| vitral, sem dedupe | 1 | 1053 | 392 | 71,6 | 14 | 2 | 1,72 |
| vitral, com dedupe | 1 | 1104 | 402 | 75,8 | 19 | 2 | 1,75 |
| vitral, dedupe e `maxStale` | 1 | 1112 | 253 | 76,2 | 20 | 1 | 1,76 |
| MF, sem shared | 1 | 1466 | 392 | 100,4 | 7 | 2 | 1,84 |
| MF, shared singleton | 1 | 2605 | 420 | 110,9 | 17 | 2 | 2,14 |
| vitral, sem dedupe | 4 | 1747 | 468 | 211,2 | 20 | 5 | 2,72 |
| vitral, com dedupe | 4 | 1532 | 450 | 131,0 | 38 | 5 | 2,32 |
| vitral, dedupe e `maxStale` | 4 | 1668 | 298 | 131,4 | 39 | 1 | 2,33 |
| MF, sem shared | 4 | 2397 | 460 | 308,6 | 22 | 5 | 3,13 |
| MF, shared singleton | 4 | 3586 | 480 | 247,0 | 48 | 5 | 3,61 |
| vitral, sem dedupe | 8 | 2818 | 553 | 409,3 | 28 | 9 | 3,99 |
| vitral, com dedupe | 8 | 2114 | 531 | 152,6 | 60 | 9 | 2,60 |
| vitral, dedupe e `maxStale` | 8 | 2266 | 348 | 153,3 | 62 | 6 | 2,60 |
| MF, sem shared | 8 | 3783 | 592 | 597,9 | 42 | 9 | 4,91 |
| MF, shared singleton | 8 | 4467 | 946 | 408,6 | 85 | 12 | 5,17 |

Host sozinho (N=0): o do vitral baixa 8,5 kB de JS em 6 requisições (a entrada e os chunks sob demanda que o `configure` busca). O do MF baixa 18,9 kB em 2 requisições.

Mínimo e máximo de cada célula estão em `bench/publico/resultado.json`.

Na 0.11.1, os remotes Vue e JS puro deixaram de levar o código do host (o `<vitral-remote>` e o loader), e os remotes React deixaram de baixar o escopo dos portais num arquivo à parte. Com N=8 e dedupe, isso tirou 14 requisições e 25 kB da visita fria. As medições anteriores à 0.11.1 usavam o Chromium 141 headless shell; estas usam o Chromium 153.

## O que os números dizem

Com o framework compartilhado (dedupe no vitral, `shared` singleton no MF):

| N | Frio | Transferido | Heap |
| --: | --- | --- | --- |
| 1 | vitral 1104 ms, MF 2605 ms (-58%) | 75,8 kB contra 110,9 kB (-32%) | 1,75 contra 2,14 MB |
| 4 | vitral 1532 ms, MF 3586 ms (-57%) | 131,0 kB contra 247,0 kB (-47%) | 2,32 contra 3,61 MB |
| 8 | vitral 2114 ms, MF 4467 ms (-53%) | 152,6 kB contra 408,6 kB (-63%) | 2,60 contra 5,17 MB |

Cada remote leva a própria cópia do framework (sem dedupe, sem `shared`):

| N | Frio | Transferido | Heap |
| --: | --- | --- | --- |
| 1 | vitral 1053 ms, MF 1466 ms (-28%) | 71,6 kB contra 100,4 kB (-29%) | 1,72 contra 1,84 MB |
| 4 | vitral 1747 ms, MF 2397 ms (-27%) | 211,2 kB contra 308,6 kB (-32%) | 2,72 contra 3,13 MB |
| 8 | vitral 2818 ms, MF 3783 ms (-26%) | 409,3 kB contra 597,9 kB (-32%) | 3,99 contra 4,91 MB |

De onde vem a diferença, olhando as requisições:

- No MF, cada `remoteEntry.js` traz o próprio runtime (cerca de 17 kB com brotli por remote). O host traz mais 19 kB.
- No MF com `shared`, o remote só pede o React depois de carregar o runtime e passar pelos módulos `loadShare` e `prebuild`: uma cadeia de requisições em série antes de montar. Com 150 ms de RTT, isso pesa mais que os bytes economizados. Com N=1, o `shared` deixa o MF 1139 ms mais lento que sem `shared`.
- No vitral com dedupe, o React baixa uma vez (cerca de 63 kB). De N=4 para N=8, os 4 remotes a mais custam 21,6 kB juntos.

## Visita de volta com maxStale

Com `configure({ maxStale: 300 })`, o host usa o `vitral.json` salvo na visita anterior e não espera a revalidação (veja [Carregamento](./carregamento#visita-de-volta-sem-esperar-o-manifesto)). A visita fria não muda.

| N | Com dedupe | Com dedupe e `maxStale` | Diferença |
| --: | --: | --: | --: |
| 1 | 402 ms | 253 ms | -37% |
| 4 | 450 ms | 298 ms | -34% |
| 8 | 531 ms | 348 ms | -34% |

## Com CPU 4x mais lenta

Mesma rede, `Emulation.setCPUThrottlingRate` 4x, 7 repetições (`bench/publico/resultado-cpu4.json`). Bytes e requisições não mudam.

| Cenário | N | Frio (ms) | Quente (ms) |
| --- | --: | --: | --: |
| vitral, sem dedupe | 1 | 1220 | 583 |
| vitral, com dedupe | 1 | 1272 | 604 |
| MF, sem shared | 1 | 1632 | 544 |
| MF, shared singleton | 1 | 2854 | 638 |
| vitral, sem dedupe | 4 | 2038 | 837 |
| vitral, com dedupe | 4 | 1618 | 778 |
| MF, sem shared | 4 | 2698 | 896 |
| MF, shared singleton | 4 | 3829 | 943 |
| vitral, sem dedupe | 8 | 3210 | 1301 |
| vitral, com dedupe | 8 | 2158 | 1009 |
| MF, sem shared | 8 | 4039 | 1399 |
| MF, shared singleton | 8 | 4675 | 1597 |

Com dedupe, o vitral abre em menos da metade do tempo do MF com `shared` em todos os N. Com N=1, na visita quente, o MF sem `shared` (544 ms) fica à frente do vitral (583 e 604 ms).

## Onde o vitral perde

- **Requisições com N=1:** o MF sem `shared` faz 7 requisições; o vitral faz 14 sem dedupe e 19 com dedupe.
- **Dedupe com um remote só:** com N=1, o dedupe deixa o vitral 51 ms mais lento (1104 contra 1053 ms) e 4,2 kB mais pesado. Ele só compensa a partir de 2 remotes do mesmo framework.
- **Requisições com dedupe:** o build dividido gera muitos arquivos pequenos. Com N=8, são 60 requisições, contra 42 do MF sem `shared` (mas 85 do MF com `shared`).
- **Visita quente com N=1:** empate sem throttling (392 ms nos dois sem dedupe e sem `shared`). Com CPU 4x, o MF sem `shared` fica à frente (544 contra 583 ms).
- **Host sozinho:** o do vitral faz 6 requisições contra 2 do MF, mesmo baixando menos.

## Método

| Item | Como |
| --- | --- |
| Remotes | 3 React para cada Vue. N=1: 1 React. N=4: 3 React + 1 Vue. N=8: 6 React + 2 Vue |
| Código | O mesmo `Cartao.jsx` e `Cartao.vue` nos dois. Só muda a entrada: o plugin do vitral embrulha o `export default`; no MF, o remote expõe `./Cartao` com uma função `mount` |
| Build | Vite 8 nos dois. Cada remote é um build separado, com nome próprio. MF: `@module-federation/vite`, `remoteEntry.js` como ES module, sem manifesto e sem `dts` |
| Host do vitral | `configure` + `createSlot`, empacotado pelo Vite |
| Host do MF | `init` + `loadRemote` de `@module-federation/runtime`, empacotado pelo Vite, sem plugin |
| Servidor | Node, localhost. Brotli nível 11. Arquivo com hash: `max-age=31536000, immutable`. `vitral.json`, `remoteEntry.js` e HTML: `no-cache` com ETag |
| Rede | CDP `Network.emulateNetworkConditions`: 150 ms de RTT, 1,6 Mbps de download, 750 kbps de upload |
| Frio | Contexto novo do navegador, cache vazio |
| Quente | Segunda visita no mesmo contexto, com cache HTTP |
| Pronto | `performance.now()` quando os N `.cartao` estão no DOM (`MutationObserver`, o mesmo código nos dois hosts) |
| Bytes | Soma de `encodedDataLength` do CDP: corpo com brotli mais cabeçalhos |
| Requisições | Requisições que foram à rede (as servidas do cache de memória ou disco não contam; 304 conta) |
| Memória | `Runtime.getHeapUsage().usedSize` depois de `HeapProfiler.collectGarbage`, na visita fria |
| Repetições | Uma visita de aquecimento fora da conta (o servidor comprime na primeira vez), depois 7. Mediana |

## Versões e máquina

| | |
| --- | --- |
| vitral | 0.11.0 com as mudanças da 0.11.1 (commit 038dcf4), instalado do tarball do pacote |
| @module-federation/vite | 1.23.9 |
| @module-federation/runtime | 2.9.3 |
| vite | 8.3.5 |
| @vitejs/plugin-react / plugin-vue | 6.2.1 / 6.0.10 |
| react, react-dom | 19.3.1 |
| vue | 3.5.44 |
| Chromium (Playwright 1.56.1) | 153.0.8010.12, headless |
| Node | 22.22.0 |
| Máquina | Intel Xeon 2,10 GHz, 4 núcleos, 16 GB, Linux 6.18 |
| Data | 04/11/2026 |

## Limites

- Uma máquina, um navegador, servidor em localhost com rede emulada. Não é rede real.
- O componente é pequeno. Com remotes maiores, o peso do runtime conta menos e o do código do app conta mais.
- O MF foi medido com a configuração padrão do `@module-federation/vite`. Webpack e Rspack com runtime compartilhado entre remotes não foram medidos.
- Sem `mf-manifest.json` no MF. Com manifesto, cada remote faz uma requisição a mais, como o `vitral.json`.
- Sem CSS, sem SSR, sem navegação entre rotas.
- Sem throttling de CPU na tabela principal. A tabela com CPU 4x não traz bytes nem heap, que não mudam.

## Reproduzir

```bash
pnpm install
pnpm bench:publico
```

O script instala as versões fixadas numa pasta de trabalho (`bench/node_modules/.cache/publico`), sem mexer no lockfile. Ele constrói hosts e remotes, mede e grava `bench/publico/resultado.json`. No fim, imprime a tabela acima.

```bash
node bench/publico/run.mjs --n 4 --runs 3 --only vitral-dedupe,mf-shared
node bench/publico/run.mjs --cpu 4                  # CPU 4x mais lenta
node bench/publico/run.mjs --sem-build --servir     # só o servidor, porta 4301
CHROMIUM_PATH=/caminho/chrome node bench/publico/run.mjs   # outro Chromium (vale para o zonas.mjs)
```

Com `--servir`, abra `http://127.0.0.1:4301/host-vitral/?remotes=vitral-dedupe&n=4` ou `http://127.0.0.1:4301/host-mf/?remotes=mf-shared&n=4`.

Este benchmark não roda no CI. O bench do CI (`bench/run.mjs`) continua medindo só o vitral contra a `main`.

## Cenários novos

Dicionário de compressão ainda não tem cenário. O prefetch preditivo está medido na comparação com o [Multi-Zones](#contra-o-next-js-multi-zones). Um cenário novo entra como um item em `bench/publico/cenarios.mjs`, sem mudar o `run.mjs`:

```js
{
  id: 'vitral-dict',
  rotulo: 'vitral, dedupe e dicionário',
  host: 'vitral',
  ferramenta: 'vitral',
  compartilha: true,
  build: (ferramenta, opcoes) => opcoes,          // opções do plugin do remote
  servidor: (req, arquivo) => ({ headers: {} }),  // cabeçalhos ou corpo da resposta
  antes: async (page, url) => {},                 // antes de cada visita medida
  query: {},                                      // parâmetros a mais na URL do host
}
```

## Contra o Next.js Multi-Zones

O Multi-Zones divide o app por rota: cada equipe tem um app Next (uma zona) com algumas URLs, e trocar de zona recarrega a página. O cenário justo é o mesmo app dividido em duas áreas, A e B, uma por equipe, abrindo A e indo para B. Todos os números saíram de `bench/publico/zonas.mjs`.

### Resultado

Mediana de 7 repetições. Rede "Slow 4G" (150 ms de RTT, 1,6 Mbps). HTTP/2. Sem throttling de CPU. kB = 1024 bytes do corpo, com brotli.

| Cenário | Abrir A, interativo (ms) | Abrir A, 1ª pintura (ms) | Abrir A (kB) | Trocar A → B (ms) | Trocar (kB) | Baixado A + B (kB) |
| --- | --: | --: | --: | --: | --: | --: |
| vitral, sem dedupe | 1093 | 1112 | 71,4 | 627 | 58,0 | 129,4 |
| vitral, com dedupe | 1130 | 1148 | 74,3 | 364 | 3,9 | 78,2 |
| vitral, dedupe e prefetch | 1195 | 1216 | 80,7 | 186 | 0 | 80,7 |
| vitral, gateway com SSR | 703 | 196 | 76,4 | 369 | 3,8 | 80,2 |
| vitral, gateway e prefetch | 705 | 196 | 79,6 | 187 | 0,7 | 83,4 |
| Multi-Zones | 960 | 200 | 114,3 | 998 | 114,3 | 228,5 |
| Multi-Zones, prefetch | 966 | 196 | 115,8 | 839 | 112,8 | 228,6 |

Mínimo e máximo de cada célula estão em `bench/publico/resultado-zonas.json`.

### O que os números dizem

Melhor configuração de cada um (vitral com gateway e prefetch, Multi-Zones com prefetch):

| | vitral | Multi-Zones | Diferença |
| --- | --: | --: | --- |
| Abrir A, interativo | 705 ms | 966 ms | 27% mais rápido |
| Abrir A, 1ª pintura | 196 ms | 196 ms | Empate |
| Trocar A → B | 187 ms | 839 ms | 4,5 vezes mais rápido |
| Baixado em A + B | 83,4 kB | 228,6 kB | 64% menos |

De onde vem a diferença:

- **Troca de área:** no Multi-Zones, ir para outra zona recarrega a página e baixa React e Next de novo (113 kB), mesmo com arquivos iguais, porque cada zona serve os seus em outro caminho (`/a/_next/…`, `/b/_next/…`). No vitral, o app shell fica, o React fica (dedupe) e só o remote de B vem (4 kB). Com o prefetch, nem isso: B já está baixado.
- **Primeira visita:** sem gateway, o vitral perde (1130 contra 960 ms). O HTML do app shell chega vazio, e o host descobre um arquivo depois do outro: o JS do host, o `vitral.json`, o código de SRI e de dedupe e, por último, o React. Com o gateway (`routes`), a página já sai com o HTML da rota, o manifesto e o `Link` (Early Hints) de todos os arquivos, o React inclusive. O navegador baixa tudo em paralelo e o outlet só hidrata. Veja [Rotas com SSR](./ssr#rotas-com-ssr).
- **Bytes:** o Next manda o runtime dele (roteador, RSC) além do React. O host do vitral é o app shell e a lib.

### Com CPU 4x mais lenta

Melhor configuração de cada um, mesma rede, `Emulation.setCPUThrottlingRate` 4x, 7 repetições (`bench/publico/resultado-zonas-cpu4.json`). Bytes não mudam.

| | vitral | Multi-Zones | Diferença |
| --- | --: | --: | --- |
| Abrir A, interativo | 859 ms | 1259 ms | 32% mais rápido |
| Abrir A, 1ª pintura | 244 ms | 240 ms | Empate |
| Trocar A → B | 232 ms | 1140 ms | 4,9 vezes mais rápido |

Com CPU lenta, a diferença cresce: o Next roda o runtime dele de novo a cada troca de zona.

### Onde o vitral perde

- **Sem gateway, primeira visita:** 1130 ms contra 960 ms, e a primeira pintura só sai com o JS (1148 contra 200 ms). Quem não pode pôr um servidor na frente do app shell fica com esse custo na primeira visita.
- **Dedupe com uma área só:** sem dedupe, a primeira visita é 37 ms mais rápida (1093 contra 1130 ms), mas a troca baixa o React de novo (58 kB). O dedupe compensa a partir da segunda área visitada.
- **Prerender do Chromium:** com Speculation Rules `prerender`, a zona B poderia abrir já pronta. Não foi medido: com o DevTools ligado (Playwright, CDP), o Chromium desliga o prerender (`PrerenderingDisabledByDevTools`). Só o `prefetch` entrou. O prerender só existe no Chromium e roda a página inteira de B em segundo plano.

### Método

| Item | Como |
| --- | --- |
| App | Duas áreas, A e B. Cada uma mostra o mesmo `Cartao.jsx` do benchmark contra o MF, com um botão |
| Multi-Zones | Dois apps Next 16 (App Router, Turbopack), cada um com `basePath` próprio (`/a`, `/b`) e `output: 'export'`: o HTML sai pronto do build, o melhor caso do Next para a primeira pintura. Link entre zonas com `<a>`, como manda a documentação |
| Rewrites | O servidor manda `/a/*` e `/b/*` para cada zona, sem passar por um terceiro app |
| Prefetch do Multi-Zones | `<script type="speculationrules">` com `prefetch` de `/b/` e `eagerness: "immediate"`, para terminar antes do clique |
| vitral | App shell com `routes({ '/v/a': 'a', '/v/b': 'b' })` e `<vitral-outlet>`. Dois remotes React buildados com o plugin, com e sem `dedupe: ['react']` |
| Gateway | `gateway({ routes })` de `vitral/edge` na frente do app shell, com `render` de `reactRender`. Compressão brotli 11 na saída |
| Prefetch do vitral | `vitral/prefetch`, treinado com A → B três vezes antes, e o prefetch de B terminado em A |
| Servidor | Node, HTTP/2 com TLS (certificado local aceito pela chave, para o cache HTTP funcionar). Brotli 11. Arquivo com hash: `immutable`; HTML e `vitral.json`: `no-cache` |
| Abrir A | Contexto novo, cache vazio |
| Interativo | Next: `useEffect` depois da hidratação. vitral: `vitral-ready` do outlet. Nos dois, o botão já responde |
| 1ª pintura | `first-contentful-paint` |
| Trocar A → B | Do clique (ou `navigate`) até B interativo, com o cache que a visita em A deixou. Antes, 500 ms de leitura em A (5 s com Speculation Rules) |
| Bytes | Corpo das respostas, contado no servidor. O CDP não dá o tamanho dos arquivos que chegam por Early Hints |
| Repetições | Uma de aquecimento fora da conta, depois 7. Mediana |

Versões: vitral 0.11.0 com as mudanças da 0.11.1 (commit 038dcf4), Next 16.4.5, React 19.3.1, Vite 8.3.5, Chromium 153.0.8010.12 (Playwright 1.56.1, headless), Node 22.22.0, na mesma máquina da tabela do MF. Data: 04/11/2026.

### Limites

- Uma máquina, um navegador, servidor em localhost com rede emulada.
- Zonas com export estático. Com SSR por requisição, o Next ainda gasta o tempo de render no servidor a cada página.
- Duas áreas e um componente pequeno. Com áreas maiores, o código de cada uma pesa mais que o runtime.
- Sem throttling de CPU na tabela principal. Com CPU 4x, só a melhor configuração de cada um.

### Reproduzir

```bash
pnpm install
pnpm bench:zonas
node bench/publico/zonas.mjs --runs 3 --only vitral-gateway-prefetch,zonas-prefetch
node bench/publico/zonas.mjs --cpu 4                    # CPU 4x mais lenta
node bench/publico/zonas.mjs --sem-build --servir       # estático na 4302, gateway na 4303
```

Para trocar as zonas por remotes, veja [Migrar do Next.js Multi-Zones](/migracao/multi-zones).
