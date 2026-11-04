---
'vitral': minor
---

O build do remote grava em `split.order` a ordem de download do que roda ao montar, pelo caminho mais longo em bytes, e em `split.critical` os arquivos desse caminho. O `NextRemote`, o `vitral/next-server` e o `vitral/edge` pré-carregam nessa ordem, com `fetchpriority="high"` no caminho crítico.
