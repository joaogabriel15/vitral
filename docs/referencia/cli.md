# CLI

```bash
npx vitral types [remotes.json | nome=url ...] [--base url] [--out arquivo] [--check]
npx vitral canal <vitral.json | url> [--versao x.y.z] [--out arquivo]
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

## vitral canal

Gera o `vitral.json` de um canal (`stable`, `beta`) a partir do de uma versão. Os caminhos do manifesto ganham o prefixo `../<versão>/`, para o canal ficar numa pasta irmã da versão no CDN:

```bash
npx vitral canal dist/vitral.json --out canal/vitral.json
npx vitral canal https://cdn.empresa.com/chat/1.4.1/vitral.json --out canal/vitral.json
```

| Opção | O que faz |
| --- | --- |
| `--versao x.y.z` | Pasta da versão. Padrão: o `version` do manifesto |
| `--out arquivo` | Arquivo gerado. Sem ela, escreve na saída padrão |

Caminhos absolutos (`https://…`, `/…`) ficam como estão. Veja [Widget em site de terceiros](/aprender/terceiros#versoes-e-canais).
