# Contribuindo

## Ambiente

Node 20+ e pnpm 10 (`corepack enable` instala a versão certa).

```bash
pnpm install
pnpm check       # build, tipos, publint/attw, tamanho e testes unitários
pnpm test:e2e    # builda os exemplos e roda o Playwright (9 hosts × 8 remotes)
```

Na primeira vez, instale o navegador do Playwright:
`pnpm --dir e2e exec playwright install chromium`.

## Estrutura

| Pasta | O que tem |
|---|---|
| `packages/vitral` | O pacote publicado no npm (núcleo, adaptadores, plugin Vite, testes unitários) |
| `examples/remotes` | O mesmo remote em 8 frameworks |
| `examples/hosts` | 9 hosts (JS puro, React, Vue, Svelte, Solid, Preact, Angular, Next, Nuxt) |
| `e2e` | Testes Playwright que cruzam todos os hosts e remotes |
| `demo` | Demo com Tailwind (catálogo Vue + carrinho React) |
| `docs` | Site da documentação (VitePress). `pnpm --dir docs dev` abre em localhost |

## Adicionando um framework

1. Crie `packages/vitral/src/<framework>.ts` com `<framework>Remote()` e,
   se fizer sentido, um componente de host baseado em `createSlot()`.
2. Adicione a entrada em `tsup.config.ts` e em `exports` no `package.json`.
3. Escreva `test/<framework>.test.ts`.
4. Crie `examples/remotes/<framework>` e, se houver host, `examples/hosts/<framework>`,
   e inclua o nome nas listas de `e2e/matriz.spec.ts`.

## Código de erro novo

Todo código em `RemoteErrorCode` precisa de uma página em `docs/erros/<CÓDIGO>.md`
e de uma linha na tabela de `docs/erros/README.md`. O CI confere.

## Publicação

Não publique à mão. Rode `pnpm changeset`, descreva a mudança e faça commit.
O workflow de release cuida da versão, do changelog e do `npm publish`.
