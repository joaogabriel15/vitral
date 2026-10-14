---
"vitral": minor
---

Extras do contexto compartilhado, todos opcionais e fora do store:

- `persist(valor, { storage, version })` guarda o valor em `localStorage` ou `sessionStorage`, com chave versionada.
- `syncTabs(valor)` espelha as mudanças entre abas com `BroadcastChannel`.
- `serializeShared(valores)` gera o JSON do `<script type="application/json" data-vitral-shared>` no SSR.
- `shared(chave).key` devolve a chave.
- Guia em `docs/contexto.md`, com quando usar props, `shared` ou `events`.
