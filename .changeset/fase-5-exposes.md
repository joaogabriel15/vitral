---
"vitral": minor
---

Vários componentes e módulos por remote:

- Plugin: `vitral({ exposes: { './MiniCarrinho': 'src/MiniCarrinho.tsx', './api': 'src/api.ts' } })`. O manifesto ganha `exposes` e tudo continua num arquivo só, com um hash SRI.
- Host: `<Remote name="carrinho/MiniCarrinho" />` (e `<vitral-remote>`, `mountRemote`, `loadRemote`, `preload`) monta uma parte do remote.
- `loadModule('carrinho/api')` carrega um módulo sem UI com a mesma allowlist e o mesmo SRI.
- Novo código de erro `NOT_EXPOSED`.
