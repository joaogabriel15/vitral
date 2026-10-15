---
"vitral": minor
---

Overrides para desenvolver contra outro ambiente: `?vitral=carrinho@http://localhost:5174` ou `localStorage['vitral:overrides']` troca a URL de um remote. Só valem com a página em localhost ou com `configure({ devOverrides: true })`. O código fica num módulo à parte, baixado só quando há um override pedido.

Nova entrada `vitral/devtools`: `devtools()` mostra um painel para salvar e remover overrides, e `getOverrides()` / `setOverride(nome, url)` fazem o mesmo por código.
