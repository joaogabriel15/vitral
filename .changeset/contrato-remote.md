---
"vitral": minor
---

Contrato entre host e remote. O plugin `vitral/vite` grava `contract` no `vitral.json`: a versão da opção `contract: { version }` e, com `dedupe`, a faixa de cada dependência em `peers`. O host declara a faixa aceita com `contract: '^2'` no `configure` ou na entrada do remote. Antes de executar o remote, o host confere a versão e as dependências que ele mesmo oferece; se não servir, o remote não monta e o erro é `CONTRACT_MISMATCH`, mostrado pelo `fallback`/`error` como os outros. Sem contrato em um dos lados, nada muda. As faixas aceitam a forma curta (`^2`, `~2.1`), também no `dedupe`.
