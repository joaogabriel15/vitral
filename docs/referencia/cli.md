# CLI

```bash
npx vitral types [remotes.json | nome=url ...] [--base url] [--out arquivo] [--check]
npx vitral registry [remotes.json | nome=url ...] [--base url] [--out arquivo] [--name nome]
npx vitral add <remote ...> [--registry url|arquivo] [--to remotes.json] [--base url] [--out arquivo] [--force] [--no-types]
npx vitral mcp [--registry url|arquivo]
npx vitral doctor [remotes.json | url | nome=url ...] [--host url] [--origin url] [--base url] [--contract faixa] [--max-kb n] [--json]
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

## vitral doctor

Baixa o manifesto e o JS de cada remote, como o host faria, e diz o que impede o carregamento. Não executa o código do remote.

```bash
npx vitral doctor --host https://app.empresa.com
npx vitral doctor https://cdn.empresa.com/remotes.json --origin https://app.empresa.com --contract ^2
npx vitral doctor carrinho=https://cdn.empresa.com/carrinho/vitral.json --json
```

Os remotes vêm como no `vitral types`: pares `nome=url`, o caminho de um `remotes.json` ou, sem nada, `public/remotes.json` ou `remotes.json` do projeto. Também aceita a URL de um `remotes.json` publicado ou de um `vitral.json`. Rode na pasta do projeto host: é dela que saem o `index.html` e as versões instaladas de React e Vue.

```
Host
  ✓ CSP encontrada (header de https://app.empresa.com)

carrinho (https://cdn.empresa.com/carrinho/vitral.json)
  ✓ CORS do manifesto: Access-Control-Allow-Origin *
  ✓ manifesto válido: carrinho 1.4.0
  ✗ CORS do JS: a resposta não tem Access-Control-Allow-Origin
      Causa: o navegador bloqueia https://cdn.empresa.com/carrinho/remote-a1b2.js lido a partir de https://app.empresa.com.
      O que fazer: configure o servidor de https://cdn.empresa.com para responder Access-Control-Allow-Origin: https://app.empresa.com (ou *).
  ✓ exporta default com mount
  ✓ integrity do manifesto confere

1 erro(s), 0 aviso(s).
```

`✓` passou, `✗` é erro, `!` é aviso. Cada `✗` e `!` traz a causa e o que fazer.

### O que é conferido

| Conferência | Erro quando | Aviso quando |
| --- | --- | --- |
| Manifesto | HTTP diferente de 200, servidor fora do ar, HTML no lugar do JSON, falta `entry` | O `entry` está em outra origem que o manifesto (precisa de `allowedOrigins`) |
| CORS do manifesto e do JS | Sem `Access-Control-Allow-Origin`, ou com outra origem que a do host | O header traz uma origem, mas a do host não foi informada |
| JS | `Content-Type` que não é JavaScript; o arquivo não exporta `mount` nem `default` com `mount` | Remote só com partes (`exposes`) e sem `mount` |
| Integrity | O hash do `vitral.json` ou o fixado no `remotes.json` (`{ url, integrity }`) não confere com o JS publicado; arquivo de `files` faltando ou com outro hash | Sem `integrity` em lugar nenhum |
| Contrato | A versão do `contract` do remote fora da faixa do host (`--contract` ou `contract` da entrada no `remotes.json`) | O host declara faixa e o remote não publica versão |
| Dependências de `dedupe` | Com contrato ligado, a faixa de `peers` não aceita a versão instalada no host | A faixa não aceita a versão do host (duas cópias na página); dois remotes com faixas que nenhuma versão atende |
| React ou Vue duplicado | | O JS leva React ou Vue, o host também tem, e o remote não usa `dedupe` |
| Tamanho | O JS passa de `--max-kb` (com gzip) | Sem `--max-kb`, o JS passa de 250 kB com gzip |
| CSP | `script-src` ou `connect-src` não incluem a origem do manifesto ou do JS | Sem `blob:` em `script-src` com `integrity` (navegadores que não conferem o hash de cada módulo usam `blob:`); `style-src` sem a origem do CSS |

A CSP vem do header e do `<meta http-equiv>` da página de `--host`. Sem `--host`, do `<meta>` do `index.html` do projeto.

A conferência do `mount` lê o texto do JS. Ela acha `export function mount`, `export { x as mount }` e um `export default` num arquivo que tem `mount`, mas não executa o módulo.

### Opções

| Opção | O que faz |
| --- | --- |
| `--host url` | Página do host. Dela saem a origem (para o CORS) e a CSP. Também é a base das URLs relativas de um `remotes.json` local |
| `--origin url` | Origem do host para o CORS, quando não há `--host` |
| `--base url` | Base das URLs relativas do `remotes.json` |
| `--contract faixa` | Faixa de contrato que o host aceita, como em `configure({ contract })` |
| `--max-kb n` | Tamanho máximo do JS de cada remote, em kB com gzip |
| `--json` | Saída em JSON: `{ ok, errors, warnings, host, remotes: [{ name, url, checks }] }` |

Sem `--host` nem `--origin`, o CORS é conferido com uma origem qualquer: um header com uma origem específica vira aviso.

### No CI

Termina com código `1` se houver algum `✗`. Avisos não mudam o código.

```yaml
- run: npx vitral doctor https://staging.empresa.com/remotes.json --host https://staging.empresa.com --max-kb 200
```
