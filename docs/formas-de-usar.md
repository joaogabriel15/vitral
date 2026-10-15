# Mais formas de usar

Recursos opcionais sobre o mesmo contrato `mount(el, props, ctx)`.

## Vários componentes por remote

No remote, liste as partes no plugin. O `entry` continua sendo o remote inteiro.

```ts
// vite.config.ts do remote
vitral({
  entry: 'src/remote.tsx',
  exposes: {
    './MiniCarrinho': 'src/MiniCarrinho.tsx', // componente
    './api': 'src/api.ts',                    // módulo sem UI
  },
})
```

Um componente exposto exporta `default` com `mount`, como o remote:

```tsx
// src/MiniCarrinho.tsx
export default reactRemote(MiniCarrinho)
```

No host, use o nome do remote, uma barra e a chave sem `./`:

```tsx
<Remote name="carrinho/MiniCarrinho" props={{ compacto: true }} />
<vitral-remote name="carrinho/MiniCarrinho"></vitral-remote>
```

Funciona em todos os componentes de host, em `mountRemote`, `loadRemote` e `preload`.

## Módulos sem UI

```ts
import { loadModule } from 'vitral'

const api = await loadModule<typeof import('./tipos/carrinho-api')>('carrinho/api')
api.adicionar(item)

const tudo = await loadModule('carrinho') // exports do arquivo principal
```

`loadModule` passa pela mesma allowlist e pelo mesmo SRI dos componentes.

Como funciona:

- O plugin gera um arquivo só, com um `import()` por parte, e o manifesto ganha `exposes: ["./MiniCarrinho", "./api"]`.
- Um hash SRI cobre o arquivo inteiro.
- As partes dividem as mesmas instâncias de módulo: um store usado por `carrinho` e por `carrinho/api` é o mesmo objeto.
- Sem o plugin, exporte o mapa você mesmo:

```ts
export default defineRemote({ mount })
export const exposes = {
  './MiniCarrinho': () => import('./MiniCarrinho'),
  './api': () => import('./api'),
}
```

Erros: parte que não existe é [`NOT_EXPOSED`](erros/NOT_EXPOSED.md); módulo sem `mount` usado como componente é [`INVALID_MODULE`](erros/INVALID_MODULE.md).

## Atualização sem reload

Uma SPA aberta por horas vê o deploy novo de um remote:

```ts
import { events, refresh, watchUpdates } from 'vitral'

watchUpdates() // revalida os manifestos a cada navegação

events.on<{ name: string; entry: string }>('vitral:update-available', ({ name }) => {
  refresh(name) // ou mostre um aviso e chame refresh quando o usuário quiser
})
```

- `watchUpdates()` revalida os manifestos dos remotes montados a cada `popstate` (o `navigate()` dispara um) e a cada navegação da Navigation API, onde ela existe. Devolve a função que desliga.
- Em navegadores sem Navigation API e com um roteador próprio, chame `checkUpdates()` na troca de rota. Ela devolve os nomes com versão nova.
- `vitral:update-available` sai uma vez por deploy novo, com `{ name, entry }`.
- `refresh('carrinho')` baixa a versão nova e troca cada montagem de `carrinho` (e de `carrinho/…`) pela nova, com as props atuais. Funciona em todos os componentes de host e em `mountRemote`.
- Se a versão nova não carregar, `refresh` rejeita e a antiga continua na tela. Se o `mount()` da nova falhar, a antiga também fica, e o erro vai para o console.
- Só remotes registrados pela URL do `vitral.json` são revalidados.
