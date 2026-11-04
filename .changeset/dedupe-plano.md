---
'vitral': minor
---

`planDedupe` e `configure({ dedupePlan })`: com os manifestos de todos os remotes, cada grupo de `dedupe` fica com o menor conjunto de versões que atende todas as faixas (a oferta do host primeiro, depois as mais novas), e cada remote usa essa cópia, mesmo que venha de outro remote. Conflitos saem explicados em texto. O `withVitral` do host Next calcula o plano no build.
