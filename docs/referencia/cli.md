# CLI

```bash
npx vitral types [remotes.json | nome=url ...] [--base url] [--out arquivo] [--check]
npx vitral registry [remotes.json | nome=url ...] [--base url] [--out arquivo] [--name nome]
npx vitral add <remote ...> [--registry url|arquivo] [--to remotes.json] [--base url] [--out arquivo] [--force] [--no-types]
npx vitral mcp [--registry url|arquivo]
npx vitral doctor [remotes.json | url | nome=url ...] [--host url] [--origin url] [--base url] [--contract faixa] [--max-kb n] [--json]
npx vitral migrate [pasta] [--from single-spa|module-federation] [--dry-run]
npx vitral canal <canal.json> [--stable x.y.z] [--canary x.y.z | off] [--percent n]
npx vitral dict <dist> --from <dist-anterior> [--from ...] [--level n] [--no-dcb]
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

## vitral test

Roda no CI do remote. Veja [Contratos entre host e remote](/aprender/contratos).

```bash
npx vitral test --contract contracts/                    # reproduz os contratos dos hosts
npx vitral test --since https://cdn.exemplo.com/carrinho/vitral.json   # diff das props com a versão publicada
npx vitral test --contract contracts/ --since https://cdn.exemplo.com/carrinho/vitral.json
```

| Opção | O que faz |
| --- | --- |
| `--contract arquivo\|pasta` | Contrato `.contract.json`, ou pasta com eles. Pode repetir |
| `--since url\|arquivo` | `vitral.d.ts` publicado (ou a URL do `vitral.json` ou da pasta) para comparar com o local |
| `--dir pasta` | Pasta do build. Padrão `dist` |
| `--entry arquivo` | Módulo JS do remote. Padrão: o `entry` de `<dir>/vitral.json` |
| `--types arquivo` | `vitral.d.ts` local. Padrão `<dir>/vitral.d.ts` |

Precisa do `happy-dom` instalado (`npm i -D happy-dom`). Usa o TypeScript do projeto para conferir as props; sem ele, só o mount roda. Termina com código `1` se algum caso falhar ou se alguma mudança nas props quebrar o host.

## vitral dict

Pré-comprime cada `.js` e `.css` do dist com a versão anterior dele como dicionário e grava `vitral-dict.json` para o middleware `vitral/dict`. Receita completa e números em [Dicionários de compressão](/aprender/dicionarios).

```bash
npx vitral dict dist --from ../dist-anterior
```

| Opção | O que faz |
| --- | --- |
| `--from pasta` | Dist de uma versão anterior. Obrigatória, pode repetir |
| `--level n` | Nível do zstd. Padrão: 19 |
| `--no-dcb` | Não gera `.dcb` mesmo com o binário `brotli` no PATH |

Grava `<arquivo>.<hash>.dcz` (zstd do Node, 22.19+ ou 24.6+) e, com o binário `brotli`, `<arquivo>.<hash>.dcb`. Termina com código `1` se faltar `--from`, uma pasta não existir ou o Node não tiver zstd com dicionário.

