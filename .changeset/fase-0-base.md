---
"vitral": minor
---

Base para a 1.0, sem mudança na API:

- `integrity` aceita o formato SRI completo (`sha256`, `sha384`, `sha512`, vários hashes; vale o mais forte) e o hash é conferido sobre os bytes baixados. O erro mostra o hash esperado e o obtido.
- Todo `RemoteError` tem `docs`, o link da página do código de erro.
- Cópias diferentes da lib na mesma página compartilham o estado por um protocolo versionado em `Symbol.for('vitral')`. O remote recebe `ctx.protocol`.
- Node 20.19 ou mais novo.
