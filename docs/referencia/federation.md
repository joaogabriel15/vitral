# vitral/federation

Monta no host vitral um remote que ainda é do Module Federation. Serve para migrar um remote por vez: o host já usa `<Remote>`, e o remote continua publicando o `remoteEntry.js`.

```ts
federationRemote(url: string, options?: FederationOptions): RemoteEntry
```

`url` é o `mf-manifest.json` do remote (gerado por `@module-federation/enhanced`, Rspack e `@module-federation/vite`) ou, sem manifesto, o `remoteEntry.js`.

## Uso

```tsx
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import { configure } from 'vitral'
import { federationRemote } from 'vitral/federation'
import { Remote, reactRemote } from 'vitral/react'

configure({
  remotes: {
    carrinho: federationRemote('https://cdn.empresa.com/carrinho/mf-manifest.json', {
      adapt: (m) => reactRemote(m.default),
      shared: { react: { version: React.version, modules: { react: React, 'react-dom': ReactDOM } } },
    }),
  },
})

<Remote name="carrinho/Carrinho" props={{ userId: 42 }} />
```

Cada parte de `exposes` do Module Federation vira `nome/Parte`. Módulos sem UI saem por `loadModule('carrinho/api')`.

## Opções

| Opção | O que faz |
| --- | --- |
| `adapt(module, key)` | Transforma o módulo exposto num remote com `mount` (ex.: `(m) => reactRemote(m.default)`). Devolver `undefined` deixa o módulo como está. Parte que já exporta `mount` não passa por aqui |
| `shared` | Dependências que o host oferece ao remote, no formato do `dedupe` do `configure`. Cada especificador entra no share scope com a versão do grupo. O remote usa a do host se servir; senão, a própria cópia |
| `expose` | Parte montada por `<Remote name="carrinho">`, sem `/`. Padrão: a única parte do manifesto |
| `global` | Sem manifesto: nome da variável global do container (`library.type: 'var'`). Sem esta opção, a URL é importada como ES module |
| `allowedOrigins` | Origens de onde o `remoteEntry.js` pode vir, além da origem do manifesto. `['*']` libera tudo |

Com `adapt` e um componente React, passe o React do host em `shared`. Senão, o componente do remote roda com outra cópia do React, e os hooks quebram.

## Como funciona

1. Baixa o `mf-manifest.json` (sem cache) e monta a URL do `remoteEntry.js` com `publicPath`, `remoteEntry.path` e `remoteEntry.name`.
2. Carrega o `remoteEntry.js`: com `<script>` e `window[globalName]` quando `remoteEntry.type` é `global` ou `var`; com `import()` quando é `module` ou `esm`. Se o host do Module Federation já carregou o container global, ele é reaproveitado.
3. Chama `container.init(shareScope(shared))` uma vez por manifesto e `container.get('./Parte')` uma vez por parte. `shareScope` também é exportado, para quem chama `init` à mão.

## Limites

- Sem SRI: o `mf-manifest.json` não traz hash dos arquivos. O `allowedOrigins` do `configure` não vale aqui; vale o `allowedOrigins` da opção.
- `getPublicPath` (código JS no manifesto) não é suportado, porque exigiria `eval`. Use `publicPath`.
- O CSS é carregado pelo runtime do Module Federation, no `document`. Não funciona com `isolate="shadow"`.
