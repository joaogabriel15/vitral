---
"vitral": minor
---

Composição por rota, em `vitral/routes`: `routes({ '/checkout/*': 'checkout', '/conta': 'conta' })` e `<vitral-outlet>` montam o remote da URL atual e trocam de remote ao navegar, sem remontar dentro do mesmo remote. Links internos que batem com uma rota navegam sem recarregar. `matchRoute(path)` devolve o remote e os parâmetros da rota.
