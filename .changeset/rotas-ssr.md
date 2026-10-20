---
'vitral': minor
---

Rotas com SSR, no lugar do Next.js Multi-Zones: `gateway({ routes })` renderiza o remote da rota dentro do `<vitral-outlet>` e manda os `Link` dele já na primeira visita (com a cópia própria do dedupe); o outlet hidrata esse HTML e troca de rota sem recarregar. O manifesto usado no SSR vai no HTML, e a hidratação não busca o `vitral.json` de novo. `reactRemote` agora exporta `hydrate`, e `vitral/react-server` traz `reactRender` para o `render` do gateway.
