---
'vitral': minor
---

Ajustes para problemas comuns de micro-frontends:

- `ctx.signal`: `AbortSignal` abortado no unmount, para `fetch`, ouvintes e timers. O `AbortError` do cancelamento não é reportado.
- `waitFor` (`wait-for` nos elementos): o remote só monta quando as chaves de `provide` têm valor, como a sessão.
- Aba aberta durante um deploy: se o JS da versão aberta sumiu, o host relê o `vitral.json` sem cache e monta a versão nova; se um chunk do remote montado sumiu, troca a montagem uma vez.
- Canary: `resolve` com `resolveTimeout` (1500 ms) cai para a estável; versão que não carrega volta para a estável na hora.
- `vitral doctor --report` e `--stale-days`: tabela com versão, último deploy, tamanho, contrato e frameworks de cada remote, com aviso de remote parado e de majors diferentes.
- Rotas: o `<vitral-outlet>` anuncia a página nova ao leitor de tela e move o foco para o `h1` (`announce: false` desliga; `announceRoute` para outros roteadores).
- `watchLeaks` em `vitral/devtools`: avisa ouvintes em `window`/`document` e `setInterval` que um remote deixou ao sair.
- Rotas sobrepostas: vence o padrão mais específico em qualquer ordem, com aviso de padrões duplicados; o host Next escolhe o prefixo mais longo e o `withVitral` avisa caminhos repetidos.
