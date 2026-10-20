---
'vitral': minor
---

Dicionários de compressão (RFC 9842) para os remotes: quem já tem a versão anterior em cache baixa só a diferença. Nos remotes de exemplo, o delta entre a 0.3 e a 0.4 ficou 89% menor que o brotli 11 em média.

- `npx vitral dict dist --from ../dist-anterior` pré-comprime cada `.js` e `.css` com a versão anterior como dicionário (`.dcz`, e `.dcb` com o binário `brotli`) e grava `vitral-dict.json`.
- `vitral/dict`: `createDict({ index, read })` responde `Available-Dictionary` com `Content-Encoding: dcz`/`dcb` e põe `Use-As-Dictionary` nas respostas normais. Só usa `Request`/`Response` da Web (edge, Deno, Bun) e tem `node(req, res, next)` para Node e Express.
