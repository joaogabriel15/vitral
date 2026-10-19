---
"vitral": patch
---

O plugin Vite agora declara filtros nos hooks `resolveId`, `load` e `transform`. No Vite 8 (Rolldown) e no Vite 6.3+, os módulos que não são do vitral nem chegam ao plugin, e o build fica mais rápido em projetos grandes. Nas versões anteriores do Vite nada muda.
