# create-vitral

## 0.3.0

### Patch Changes

- [#48](https://github.com/joaogabriel15/vitral/pull/48) [`116db7b`](https://github.com/joaogabriel15/vitral/commit/116db7b0f054ae3367b00af3cf91973bae12a9b9) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - Template Angular: o `vite.config.js` gerado usa `fileURLToPath` para achar o `tsconfig.json`. Antes, no Windows e em pastas com espaço ou acento, o build e o HMR falhavam.

- [#60](https://github.com/joaogabriel15/vitral/pull/60) [`27a7815`](https://github.com/joaogabriel15/vitral/commit/27a7815e294f2fdb0684e17eb5c30ed842180f0e) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - O build do remote não quebra mais com o TypeScript 7 (o que o `create-vite` instala hoje): sem API em JavaScript, o plugin procura outro TypeScript e, sem nenhum, segue sem gerar `vitral.d.ts`. Palavras-chave do npm ampliadas para o pacote ser encontrado na busca.

## 0.2.0

### Minor Changes

- [#36](https://github.com/joaogabriel15/vitral/pull/36) [`50e2032`](https://github.com/joaogabriel15/vitral/commit/50e2032a0d5947197b8fe7efde777836fc92ffb5) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - Novo pacote `create-vitral`: `npm create vitral@latest` gera um host ou um remote com o plugin configurado, um exemplo, o script `dev` e um teste e2e. Templates: React, Next, Vue, Nuxt, Angular, SvelteKit, Solid, Preact, Lit e JS puro.

### Patch Changes

- [#12](https://github.com/joaogabriel15/vitral/pull/12) [`9eb8667`](https://github.com/joaogabriel15/vitral/commit/9eb8667b376750000ab411fe3ab34485e56b6902) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - Host vanilla e Lit: o `vite.config.js` gerado declara `vitral/auto` e `vitral/element` em `optimizeDeps.include`, e a página não recarrega mais no primeiro acesso.
