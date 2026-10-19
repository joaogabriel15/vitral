---
name: vitral
description: Cria e integra micro-frontends com a lib vitral (remotes publicados como módulo ES + vitral.json, montados em runtime por um host em React, Vue, Svelte, Solid, Preact, Angular, Lit ou JS puro). Use quando o projeto tem `vitral` no package.json, um vitral.json, remotes.json ou vitral-registry.json, ou quando pedirem para criar um remote, mostrar um remote no host ou adicionar um remote do registro.
---

# vitral

Um **remote** é um componente publicado num CDN com um `vitral.json` (manifesto). O **host** é a página que baixa e monta remotes em runtime. O host só precisa da URL do `vitral.json` de cada remote. Documentação: https://joaogabriel15.github.io/vitral/

## Descobrir o que já existe

- `package.json` com `vitral`: o projeto já usa a lib.
- `vite.config.*` com `vitral()` de `vitral/vite`: é um remote.
- `configure({ remotes })`, `remotes.json` ou `<Remote>`: é um host.
- `vitral-registry.json` ou `VITRAL_REGISTRY`: há um registro de remotes da empresa.

## Criar um projeto

```bash
npm create vitral@latest nome -- --remote --framework react   # ou --host
```

Frameworks: `react`, `vue`, `svelte`, `solid`, `preact`, `angular`, `lit`, `vanilla`. Hosts também aceitam `next`, `nuxt` e `sveltekit`.

## Remote

1. Exporte o componente como `default` em `src/App.*` (ou `src/remote.*`).
2. Adicione o plugin, depois do plugin do framework:

```js
// vite.config.js
import react from '@vitejs/plugin-react'
import vitral from 'vitral/vite'
export default { plugins: [react(), vitral()] }
```

3. `npx vite build` gera `dist/vitral.json`, o JS, o CSS e `vitral.d.ts` (tipo das props). Publique `dist/` num CDN com CORS liberado.
4. Em desenvolvimento, `npx vite --port 5174` serve `http://localhost:5174/vitral.json`.

Não adicione adaptador à mão: o plugin descobre o framework pelos plugins do Vite.

## Host

```js
import { configure } from 'vitral'
configure({ remotes: '/remotes.json' }) // ou { carrinho: 'https://cdn…/carrinho/vitral.json' }
```

```jsx
import { Remote } from 'vitral/react'
<Remote name="carrinho" props={{ userId: 42 }} fallback={<p>Carregando…</p>} />
```

Outros frameworks: `<VitralRemote>` de `vitral/vue`, `use:remote` de `vitral/svelte`, `<Remote>` de `vitral/solid` e `vitral/preact`, `provideVitral()` de `vitral/angular`, `<vitral-remote>` de `vitral/element`. Sem framework: `mountRemote(elemento, 'carrinho', props)` de `vitral`.

Props passam em `props={{ … }}` (funções também). Para avisos entre partes da página use `events.emit/on` de `vitral`.

## Registro de remotes

Prefira o registro a copiar URLs à mão.

- Listar e ver props: ferramentas MCP `list_remotes` e `get_remote` (servidor `npx vitral mcp`), ou leia o `vitral-registry.json`.
- Adicionar ao host: ferramenta `add_remote`, ou

```bash
npx vitral add carrinho --registry https://cdn.empresa.com/vitral-registry.json
```

Isso escreve o `remotes.json` do host e gera `vitral-env.d.ts`: depois, uma prop errada em `<Remote name="carrinho">` não compila. Confira o tipo em `props` do registro antes de escrever o JSX.

- Gerar o registro a partir dos manifestos: `npx vitral registry remotes.json --name empresa`. Preencha `owner`, `framework` e `description` à mão; as próximas execuções mantêm esses campos.

## Tipos

- `npx vitral types` regenera `vitral-env.d.ts` a partir do `remotes.json`.
- `npx vitral types --check` falha no CI se algum manifesto mudou desde a geração.

## Erros comuns

Erros do vitral têm um código (`RemoteError.code`) com página própria em https://joaogabriel15.github.io/vitral/erros/. Leia a página do código antes de mudar o código do projeto.
