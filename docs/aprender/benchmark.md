# Benchmark contra o Module Federation

Host do vitral e host do runtime oficial do Module Federation (MF) carregando os mesmos N remotes, no Chromium, com rede lenta fixa. Todos os números abaixo saíram de `bench/publico/run.mjs`, na máquina listada em [Versões](#versoes-e-maquina).

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

Dicionário de compressão e prefetch preditivo ainda não têm cenário. Cada um entra como um item em `bench/publico/cenarios.mjs`, sem mudar o `run.mjs`:

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
