---
"vitral": patch
---

Correções do host Next: a navegação de página inteira que o próprio Next pede depois de falhar ao carregar uma rota não entra mais em laço; o `Router` padrão de `next/router`, `redirect()` e `router.events` usam o roteador do host dentro do `NextRemote`; `useParams()` devolve sempre o mesmo objeto. `withVitral` só regrava `.vitral/host-config.mjs` quando muda e não quebra o `next start` em disco só de leitura. Dedupe de `pacote/*`: `export default X` conta como o mesmo valor de `X`, um arquivo interno com nomes privados reexporta do host os públicos, e a cópia própria inteira por falta de um subpath avisa no console. `preload({ routes: true })` baixa no máximo 3 chunks por vez e nada com economia de dados. Os módulos de teste de SRI do remote só valem na mesma origem da página.
