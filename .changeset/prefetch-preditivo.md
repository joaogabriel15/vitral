---
'vitral': minor
---

`vitral/prefetch`: prefetch preditivo de remotes. `prefetch()` conta as transições entre rotas no navegador do usuário (cadeia de Markov de primeira ordem, no `localStorage`) e quais remotes cada rota monta. No tempo ocioso, baixa o `vitral.json` e o JS dos remotes da rota seguinte mais provável, sem executar e pelo mesmo caminho de SRI da montagem (import map com `integrity`, `modulepreload` com `integrity` onde o hash é conferido, ou `fetch`). Não baixa nada com `saveData` nem em 2G. `warm(nome)` faz o mesmo para um remote na hora.

Um import map novo não repete mais URLs que já estão num mapa anterior (o Chromium escrevia um aviso no console).
