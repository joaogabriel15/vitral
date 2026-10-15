---
"vitral": minor
---

Atualização sem reload:

- `watchUpdates()` revalida os manifestos dos remotes montados a cada navegação e emite `vitral:update-available` com `{ name, entry }`. `checkUpdates()` faz a mesma checagem na hora.
- `refresh('carrinho')` troca cada montagem do remote (e das partes `carrinho/…`) pela versão nova, com as props atuais, sem recarregar a página. Se a versão nova falhar, a antiga fica.
