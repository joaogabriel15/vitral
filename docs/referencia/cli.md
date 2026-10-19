# CLI

```bash
npx vitral types [remotes.json | nome=url ...] [--base url] [--out arquivo] [--check]
npx vitral registry [remotes.json | nome=url ...] [--base url] [--out arquivo] [--name nome]
npx vitral add <remote ...> [--registry url|arquivo] [--to remotes.json] [--base url] [--out arquivo] [--force] [--no-types]
npx vitral mcp [--registry url|arquivo]
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

## Opções de `types`

| Opção | O que faz |
| --- | --- |
| `--base url` | Base das URLs relativas do `remotes.json` |
| `--out arquivo` | Arquivo gerado. Padrão `vitral-env.d.ts` |
| `--check` | Só confere os hashes. Não escreve nada |

## Saída de `types`

Termina com código `1` se algum remote falhar. Com `--check`, também se algum tipo estiver desatualizado ou se o arquivo gerado não existir.

## vitral registry

Gera `vitral-registry.json` a partir dos manifestos: nome, URL, `version`, `integrity` e o tipo das props (do `vitral.d.ts`). Mantém `owner`, `framework` e `description` do arquivo anterior. Veja [Registro e agentes](/aprender/registro).

```bash
npx vitral registry remotes.json --name loja
```

| Opção | O que faz |
| --- | --- |
| `--base url` | Base das URLs relativas do `remotes.json` |
| `--out arquivo` | Arquivo gerado. Padrão `vitral-registry.json` |
| `--name nome` | Nome do registro |

Termina com código `1` se algum manifesto não baixar.

## vitral add

Copia remotes do registro para o `remotes.json` do host e roda `vitral types`.

```bash
npx vitral add carrinho perfil --registry https://cdn.empresa.com/vitral-registry.json
```

| Opção | O que faz |
| --- | --- |
| `--registry url\|arquivo` | Registro. Padrão: `VITRAL_REGISTRY` ou `vitral-registry.json` |
| `--to arquivo` | `remotes.json` do host. Padrão: `public/remotes.json` ou `remotes.json`, o que existir |
| `--base url` | Base das URLs relativas, para o `vitral types` |
| `--out arquivo` | Arquivo de tipos. Padrão `vitral-env.d.ts` |
| `--force` | Troca a URL de um remote que já está no `remotes.json` com outra |
| `--no-types` | Não roda `vitral types` |

Uma entrada em objeto (`{ "url": …, "isolate": "shadow" }`) mantém as outras opções; só a URL muda. Termina com código `1` se um remote não estiver no registro, já estiver registrado com outra URL ou não tiver tipos.

## vitral mcp

Servidor MCP por stdio, com as ferramentas `list_remotes`, `get_remote` e `add_remote`. Veja [Servidor MCP](/aprender/registro#servidor-mcp).
