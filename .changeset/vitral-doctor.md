---
'vitral': minor
---

Novo comando `npx vitral doctor`: baixa o manifesto e o JS de cada remote, como o host faria, e explica em pt-BR a causa e o que fazer quando algo impede o carregamento: CORS do manifesto e do JS, CSP do host (header ou `<meta>`), `Content-Type` do JS, falta do export `mount`, manifesto inválido (HTML no lugar do JSON, sem `entry`), `integrity` que não confere, contrato fora da faixa, React ou Vue duplicado, versões divergentes de `dedupe` e tamanho do bundle. Sai com código 1 se houver erro (para o CI) e aceita `--json`.
