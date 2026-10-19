---
'vitral': patch
---

O teste do import map com integrity roda uma vez por navegador. Antes, cada remote montado ao mesmo tempo fazia o próprio teste, e cada um deixava uma linha de erro no console. Agora os remotes que chegam juntos esperam o mesmo teste, e o resultado fica guardado no `localStorage` (chave `vitral:sri-map`).
