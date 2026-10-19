---
'vitral': minor
---

Overrides de desenvolvimento para polyrepo:

- `configure({ devOverrides: { preview: 'https://{name}-{ref}.preview.empresa.com' } })` resolve apelidos: `?vitral=checkout@pr-123` carrega `https://checkout-pr-123.preview.empresa.com/vitral.json`. Dá para mandar o link do preview de um PR com o resto da página vindo de homologação.
- A troca feita por `?vitral=` fica guardada na aba (`sessionStorage`) e continua valendo depois de recarregar ou navegar sem o parâmetro.
- `?vitral=off` remove todas as trocas e `?vitral=nome@off` remove uma. O aviso no console diz a origem da troca e como limpar.
- `vitral/devtools`: o botão mostra quantas trocas estão ativas, o painel lista as da aba e as do navegador e tem "Limpar todos". Novas funções `activeOverrides()` e `clearOverrides()`. `setOverride` aceita apelido.
- Correção: um override salvo à mão no `localStorage` com URL base (`{"carrinho":"http://localhost:5174"}`) era ignorado quando a página não tinha `?vitral=`.
