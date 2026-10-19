# Benchmark

Host com 3 remotes React e 1 Vue (os de `examples/remotes`), no Chromium com
a rede "Slow 4G" do Lighthouse (150 ms de RTT, 1,6 Mbps).

```bash
pnpm build && pnpm --filter remote-react --filter remote-vue build
node bench/run.mjs --out head.json
node bench/compare.mjs bench/baseline.json head.json
```

| Métrica | O que mede |
| --- | --- |
| `coldReadyMs` | Tempo até os 4 remotes prontos, cache vazio |
| `warmReadyMs` | O mesmo na segunda visita, com cache HTTP |
| `jsKB` | JS transferido na primeira visita (brotli) |
| `heapGrowthKB` | Heap a mais após 100 ciclos de desmontar e montar (depois de 20 de aquecimento) |

Cada número é a mediana de 5 execuções. Em cada PR o CI mede a main e o PR na
mesma máquina e falha se alguma métrica ficar mais de 10% pior.
`baseline.json` guarda a medição de referência da fase 0.

## Dicionários de compressão

```bash
pnpm build:all
node bench/dicionarios.mjs [--antes 0.3.0=/outro/checkout/examples/remotes]
```

Compara, no arquivo de entrada de cada remote de `examples/remotes`, brotli 11,
zstd 19, zstd com dicionário treinado nos outros remotes, brotli/zstd com os
outros remotes como dicionário e brotli/zstd com a versão anterior do mesmo
arquivo (delta). Usa os binários `brotli` e `zstd`. Grava `dicionarios.json`.
Resultado e conclusão em `docs/aprender/dicionarios.md`.
