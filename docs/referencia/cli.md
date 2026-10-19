# CLI

```bash
npx vitral types [remotes.json | nome=url ...] [--base url] [--out arquivo] [--check]
npx vitral canal <canal.json> [--stable x.y.z] [--canary x.y.z | off] [--percent n]
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

Cria ou edita o canal de um remote (o `canal.json` de [Canary e rollback](/aprender/canary)) e mostra como ficou. Sem opções, só mostra.

```bash
npx vitral canal canal.json --stable 1.4.0                  # cria: { "stable": "1.4.0" }
npx vitral canal canal.json --canary 1.5.0 --percent 10     # canary para 10%
npx vitral canal canal.json --percent 50                    # muda só o percent
npx vitral canal canal.json --stable 1.5.0 --canary off     # promove
npx vitral canal canal.json --stable 1.4.0                  # volta uma versão
```

| Opção | O que faz |
| --- | --- |
| `--stable x.y.z` | Versão de quem não está na canary. Obrigatória para criar o canal |
| `--canary x.y.z` | Versão nova. Trocar a versão mantém o `percent` |
| `--canary off` | Tira a canary |
| `--percent n` | Parte dos usuários na canary, de 0 a 100. Obrigatório na primeira canary |

Campos próprios do canal (lidos por um `resolve`) ficam como estão. Termina com código `1` se a mudança deixaria o canal inválido, e aí não grava nada.
