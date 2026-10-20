# Benchmark contra o Module Federation e o Multi-Zones

Host do vitral e host do runtime oficial do Module Federation (MF) carregando os mesmos N remotes, no Chromium, com rede lenta fixa. Todos os números abaixo saíram de `bench/publico/run.mjs`, na máquina listada em [Versões](#versoes-e-maquina).

A comparação com o Next.js Multi-Zones, que divide o app por rota e não por pedaço de página, está em [Contra o Next.js Multi-Zones](#contra-o-next-js-multi-zones).

## Resultado

Mediana de 7 repetições. Rede "Slow 4G" (150 ms de RTT, 1,6 Mbps). Sem throttling de CPU. kB = 1024 bytes, com brotli e cabeçalhos HTTP.

| Cenário | N | Frio (ms) | Quente (ms) | Transferido frio (kB) | Requisições frio | Requisições quente | Heap (MB) |
| --- | --: | --: | --: | --: | --: | --: | --: |
| vitral, sem dedupe | 1 | 1222 | 384 | 75,0 | 12 | 2 | 1,54 |
| vitral, com dedupe | 1 | 1428 | 427 | 79,8 | 18 | 2 | 1,60 |
| MF, sem shared | 1 | 1485 | 397 | 100,8 | 7 | 2 | 1,68 |
| MF, shared singleton | 1 | 2634 | 432 | 111,3 | 17 | 2 | 1,89 |
| vitral, sem dedupe | 4 | 2008 | 491 | 234,0 | 22 | 5 | 2,40 |
| vitral, com dedupe | 4 | 1850 | 454 | 146,3 | 41 | 5 | 2,18 |
| MF, sem shared | 4 | 2454 | 523 | 308,9 | 22 | 5 | 2,80 |
| MF, shared singleton | 4 | 3544 | 541 | 247,1 | 47 | 5 | 3,18 |
| vitral, sem dedupe | 8 | 3113 | 655 | 456,5 | 34 | 9 | 3,51 |
| vitral, com dedupe | 8 | 2541 | 540 | 175,5 | 69 | 9 | 2,47 |
| MF, sem shared | 8 | 3748 | 646 | 598,1 | 42 | 9 | 4,25 |
| MF, shared singleton | 8 | 4167 | 938 | 408,6 | 83 | 12 | 4,76 |

Host sozinho (N=0): o do vitral baixa 7,9 kB de JS em 6 requisições (a entrada tem 4,45 kB; o resto são chunks sob demanda que o `configure` busca). O do MF baixa 19,3 kB em 2 requisições.

Mínimo e máximo de cada célula estão em `bench/publico/resultado.json`.

## O que os números dizem

Com o framework compartilhado (dedupe no vitral, `shared` singleton no MF):

| N | Frio | Transferido | Heap |
| --: | --- | --- | --- |
| 1 | vitral 1428 ms, MF 2634 ms (-46%) | 79,8 kB contra 111,3 kB (-28%) | 1,60 contra 1,89 MB |
| 4 | vitral 1850 ms, MF 3544 ms (-48%) | 146,3 kB contra 247,1 kB (-41%) | 2,18 contra 3,18 MB |
| 8 | vitral 2541 ms, MF 4167 ms (-39%) | 175,5 kB contra 408,6 kB (-57%) | 2,47 contra 4,76 MB |

Cada remote leva a própria cópia do framework (sem dedupe, sem `shared`):

| N | Frio | Transferido | Heap |
| --: | --- | --- | --- |
| 1 | vitral 1222 ms, MF 1485 ms (-18%) | 75,0 kB contra 100,8 kB (-26%) | 1,54 contra 1,68 MB |
| 4 | vitral 2008 ms, MF 2454 ms (-18%) | 234,0 kB contra 308,9 kB (-24%) | 2,40 contra 2,80 MB |
| 8 | vitral 3113 ms, MF 3748 ms (-17%) | 456,5 kB contra 598,1 kB (-24%) | 3,51 contra 4,25 MB |

De onde vem a diferença, olhando as requisições:

- No MF, cada `remoteEntry.js` traz o próprio runtime (cerca de 17 kB com brotli por remote). O host traz mais 19 kB.
- No MF com `shared`, o remote só pede o React depois de carregar o runtime e passar pelos módulos `loadShare` e `prebuild`: uma cadeia de requisições em série antes de montar. Com 150 ms de RTT, isso pesa mais que os bytes economizados. Com N=1, o `shared` deixa o MF 1149 ms mais lento que sem `shared`.
- No vitral com dedupe, o React baixa uma vez (cerca de 63 kB). De N=4 para N=8, os 4 remotes a mais custam 29,2 kB juntos.

## Com CPU 4x mais lenta

N=4, mesma rede, `Emulation.setCPUThrottlingRate` 4x, 7 repetições (`bench/publico/resultado-cpu4.json`). Bytes e requisições não mudam.

| Cenário | Frio (ms) | Quente (ms) | Quente, mín.–máx. (ms) |
| --- | --: | --: | --: |
| vitral, sem dedupe | 2300 | 789 | 682–941 |
| vitral, com dedupe | 2051 | 879 | 661–1183 |
| MF, sem shared | 2642 | 830 | 763–2364 |
| MF, shared singleton | 3767 | 1920 | 834–3017 |

Na visita quente, o MF sem `shared` (830 ms) fica à frente do vitral com dedupe (879 ms). A variação é grande nos quatro, e as faixas se cruzam.

## Onde o vitral perde

- **Requisições com N=1:** o MF sem `shared` faz 7 requisições; o vitral faz 12 sem dedupe e 18 com dedupe.
- **Dedupe com um remote só:** com N=1, o dedupe deixa o vitral 206 ms mais lento (1428 contra 1222 ms) e 4,8 kB mais pesado. Ele só compensa a partir de 2 remotes do mesmo framework.
- **Requisições com dedupe:** o build dividido gera muitos arquivos pequenos. Com N=8, são 69 requisições, contra 42 do MF sem `shared` (mas 83 do MF com `shared`).
- **Visita quente sem compartilhar, N=8:** MF 646 ms, vitral 655 ms. Empate, dentro da variação (MF de 625 a 1441 ms, vitral de 616 a 712 ms).
- **Visita quente com CPU 4x, N=4:** MF sem `shared` 830 ms, vitral com dedupe 879 ms.
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
| vitral | 0.4.0 (commit b77fcce), instalado do tarball do pacote |
| @module-federation/vite | 1.23.5 |
| @module-federation/runtime | 2.9.2 |
| vite | 8.3.4 |
| @vitejs/plugin-react / plugin-vue | 6.1.2 / 6.0.10 |
| react, react-dom | 19.3.0 |
| vue | 3.5.44 |
| Chromium (Playwright 1.56.1) | 141.0.7390.37, headless |
| Node | 22.22.0 |
| Máquina | Intel Xeon 2,10 GHz, 4 núcleos, 16 GB, Linux 6.18 |
| Data | 19/10/2026 |

## Limites

- Uma máquina, um navegador, servidor em localhost com rede emulada. Não é rede real.
- O componente é pequeno. Com remotes maiores, o peso do runtime conta menos e o do código do app conta mais.
- O MF foi medido com a configuração padrão do `@module-federation/vite`. Webpack e Rspack com runtime compartilhado entre remotes não foram medidos.
- Sem `mf-manifest.json` no MF. Com manifesto, cada remote faz uma requisição a mais, como o `vitral.json`.
- Sem CSS, sem SSR, sem navegação entre rotas.
- Sem throttling de CPU na tabela principal. Com CPU 4x, só N=4.

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
| vitral, sem dedupe | 1236 | 1256 | 75,2 | 652 | 63,3 | 138,5 |
| vitral, com dedupe | 1435 | 1456 | 78,3 | 363 | 3,3 | 81,6 |
| vitral, dedupe e prefetch | 1430 | 1452 | 83,3 | 178 | 0 | 83,3 |
| vitral, gateway com SSR | 651 | 184 | 79,4 | 366 | 3,3 | 82,7 |
| vitral, gateway e prefetch | 652 | 180 | 81,8 | 184 | 0,6 | 85,1 |
| Multi-Zones | 969 | 184 | 114,4 | 995 | 114,4 | 228,8 |
| Multi-Zones, prefetch | 955 | 180 | 115,9 | 850 | 112,9 | 228,8 |

Mínimo e máximo de cada célula estão em `bench/publico/resultado-zonas.json`.

### O que os números dizem

Melhor configuração de cada um (vitral com gateway e prefetch, Multi-Zones com prefetch):

| | vitral | Multi-Zones | Diferença |
| --- | --: | --: | --- |
| Abrir A, interativo | 652 ms | 955 ms | 32% mais rápido |
| Abrir A, 1ª pintura | 180 ms | 180 ms | Empate |
| Trocar A → B | 184 ms | 850 ms | 4,6 vezes mais rápido |
| Baixado em A + B | 85,1 kB | 228,8 kB | 63% menos |

De onde vem a diferença:

- **Troca de área:** no Multi-Zones, ir para outra zona recarrega a página e baixa React e Next de novo (113 kB), mesmo com arquivos iguais, porque cada zona serve os seus em outro caminho (`/a/_next/…`, `/b/_next/…`). No vitral, o app shell fica, o React fica (dedupe) e só o remote de B vem (3 kB). Com o prefetch, nem isso: B já está baixado.
- **Primeira visita:** sem gateway, o vitral perde (1435 contra 969 ms). O HTML do app shell chega vazio, e o host descobre um arquivo depois do outro: o JS do host, o `vitral.json`, o código de SRI e de dedupe e, por último, o React. Com o gateway (`routes`), a página já sai com o HTML da rota, o manifesto e o `Link` (Early Hints) de todos os arquivos, o React inclusive. O navegador baixa tudo em paralelo e o outlet só hidrata. Veja [Rotas com SSR](./ssr#rotas-com-ssr).
- **Bytes:** o Next manda o runtime dele (roteador, RSC) além do React. O host do vitral é o app shell e a lib.

### Com CPU 4x mais lenta

Melhor configuração de cada um, mesma rede, `Emulation.setCPUThrottlingRate` 4x, 7 repetições (`bench/publico/resultado-zonas-cpu4.json`). Bytes não mudam.

| | vitral | Multi-Zones | Diferença |
| --- | --: | --: | --- |
| Abrir A, interativo | 792 ms | 1251 ms | 37% mais rápido |
| Abrir A, 1ª pintura | 224 ms | 228 ms | Empate |
| Trocar A → B | 225 ms | 1239 ms | 5,5 vezes mais rápido |

Com CPU lenta, a diferença cresce: o Next roda o runtime dele de novo a cada troca de zona.

### Onde o vitral perde

- **Sem gateway, primeira visita:** 1435 ms contra 969 ms, e a primeira pintura só sai com o JS (1456 contra 184 ms). Quem não pode pôr um servidor na frente do app shell fica com esse custo na primeira visita.
- **Dedupe com uma área só:** sem dedupe, a primeira visita é 199 ms mais rápida (1236 contra 1435 ms), mas a troca baixa o React de novo (63,3 kB). O dedupe compensa a partir da segunda área visitada.
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

Versões: vitral 0.5.0 com este PR, Next 16.4.2, React 19.3.0, Vite 8.3.4, Chromium 141.0.7390.37 (Playwright 1.56.1, headless), Node 22.22.0, na mesma máquina da tabela do MF. Data: 20/10/2026.

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
