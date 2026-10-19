# CLI

```bash
npx vitral types [remotes.json | nome=url ...] [--base url] [--out arquivo] [--check]
npx vitral migrate [pasta] [--from single-spa|module-federation] [--dry-run]
```

## vitral types

Baixa o `vitral.d.ts` de cada remote e gera `vitral-env.d.ts` no host.

```bash
npx vitral types remotes.json
npx vitral types carrinho=https://cdn.empresa.com/carrinho/vitral.json
```

Depois disso, uma prop errada em `<Remote name="carrinho">` não compila.

Cada remote ganha uma linha com o hash (`integrity`) do manifesto de onde veio o tipo:

```ts
// vitral:hash "carrinho" sha384-…
```

## vitral types --check

Confere se os tipos ainda batem com os manifestos publicados, sem reescrever o arquivo. Útil no CI:

```bash
npx vitral types --check
```

Conta como desatualizado o remote cujo manifesto mudou, o que não tem hash registrado e o que saiu do `remotes.json`. Manifesto sem `integrity` (um `vite dev`, por exemplo) só gera aviso.

## Opções

| Opção | O que faz |
| --- | --- |
| `--base url` | Base das URLs relativas do `remotes.json` |
| `--out arquivo` | Arquivo gerado. Padrão `vitral-env.d.ts` |
| `--check` | Só confere os hashes. Não escreve nada |

## Saída

Termina com código `1` se algum remote falhar. Com `--check`, também se algum tipo estiver desatualizado ou se o arquivo gerado não existir.

## vitral migrate

Converte um app do single-spa ou um remote do Module Federation num remote vitral. Rode na pasta do projeto:

```bash
npx vitral migrate --dry-run   # mostra o diff, não escreve nada
npx vitral migrate
```

O comando descobre a origem pelo `package.json` (`single-spa`, `single-spa-*`) e pelos arquivos de build (`webpack.config.*`, `rspack.config.*`, `rsbuild.config.*`, `vite.config.*`, `module-federation.config.*`). Use `--from` quando ele não descobrir.

Ele não altera o build atual. Os arquivos novos são:

| Arquivo | Conteúdo |
| --- | --- |
| `src/vitral-remote.js` (single-spa) | `reactRemote(Root)`, quando o app usa `singleSpaReact` só com `rootComponent`. Senão, `singleSpaRemote(lifecycles)` de [`vitral/single-spa`](./single-spa) |
| `src/vitral/<Parte>.js` (Module Federation) | Um arquivo por componente de `exposes`, com o adaptador do framework (`reactRemote`, `vueRemote`…) |
| `vite.vitral.config.mjs` | Plugin do framework e `vitral()`, com saída em `dist-vitral/` |
| `package.json` | Script `build:vitral` |

Projeto com `tsconfig.json` ganha `.ts` e `vite.vitral.config.mts`. Arquivo que já existe não é sobrescrito: rodar de novo não muda nada.

No fim, o comando lista o que fazer à mão: dependências para instalar e o que ele não converte.

### O que não migra

| Origem | Não convertido | O que fazer |
| --- | --- | --- |
| single-spa | Root config (`registerApplication`, `activeWhen`) | `configure({ remotes })` e uma rota do host ou [`routes()`](./routes) |
| single-spa | `navigateToUrl`, `mountParcel` | `ctx.navigate`, `<Remote>` ou `createSlot` |
| single-spa | Opções de `singleSpaReact` além de `rootComponent` (`errorBoundary`, `wrapWith`…) | O app fica embrulhado com `singleSpaRemote` |
| Module Federation | `shared` | Opção [`dedupe`](/aprender/dedupe) do plugin |
| Module Federation | `exposes` que não é objeto literal (variável, função) | `exposes` do plugin à mão |
| Module Federation | Componentes Angular | `angularRemote(Componente)` à mão |
| Module Federation | `remotes` do host | O comando sugere `federationRemote` de [`vitral/federation`](./federation) |

Uma parte de `exposes` é tratada como componente quando o arquivo é `.jsx`, `.tsx`, `.vue` ou `.svelte`, ou quando o nome começa com maiúscula. As outras são módulos sem UI, para `loadModule`.

Termina com código `1` se não achar single-spa nem Module Federation.
