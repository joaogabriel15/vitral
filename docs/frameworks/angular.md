# Angular

Angular 17 ou mais novo. Import: `vitral/angular`.

## Hoje e com vitral

Exemplo: uma loja em Angular mostra o carrinho, feito por outra equipe. Os dois lados têm os mesmos arquivos, na mesma ordem.

### Hoje, com Native Federation

```ts
// carrinho/src/app/carrinho.component.ts
import { Component, input } from '@angular/core'

@Component({
  selector: 'app-carrinho',
  template: `<p>Carrinho do usuário {{ userId() }}</p>`,
})
export default class CarrinhoComponent {
  userId = input(0)
}
```

```js
// carrinho/federation.config.js
const { withNativeFederation, shareAll } = require('@angular-architects/native-federation/config')

module.exports = withNativeFederation({
  name: 'carrinho',
  exposes: { './Carrinho': './src/app/carrinho.component.ts' },
  shared: { ...shareAll({ singleton: true, strictVersion: true, requiredVersion: 'auto' }) },
})
```

```js
// loja/federation.config.js
const { withNativeFederation, shareAll } = require('@angular-architects/native-federation/config')

module.exports = withNativeFederation({
  shared: { ...shareAll({ singleton: true, strictVersion: true, requiredVersion: 'auto' }) },
})
```

```ts
// loja/src/main.ts
import { initFederation } from '@angular-architects/native-federation'

initFederation({ carrinho: 'https://cdn.empresa.com/carrinho/remoteEntry.json' })
  .then(() => import('./bootstrap'))
```

```ts
// loja/src/app/app.routes.ts
import { loadRemoteModule } from '@angular-architects/native-federation'

export const routes = [
  {
    path: 'carrinho',
    loadComponent: () => loadRemoteModule('carrinho', './Carrinho').then((m) => m.default),
  },
]
```

### Com vitral

```ts
// carrinho/src/app/carrinho.component.ts (igual)
import { Component, input } from '@angular/core'

@Component({
  selector: 'app-carrinho',
  template: `<p>Carrinho do usuário {{ userId() }}</p>`,
})
export default class CarrinhoComponent {
  userId = input(0)
}
```

```js
// carrinho/vite.config.js (no lugar do federation.config.js)
import angular from '@analogjs/vite-plugin-angular'
import vitral from 'vitral/vite'

export default {
  plugins: [
    angular(),
    vitral({ name: 'carrinho', entry: 'src/app/carrinho.component.ts' }),
  ],
}
```

```js
// loja/federation.config.js (não precisa mais)
```

```ts
// loja/src/main.ts (provideVitral no lugar do initFederation)
import { bootstrapApplication } from '@angular/platform-browser'
import { provideVitral } from 'vitral/angular'
import { App } from './app'

bootstrapApplication(App, {
  providers: [provideVitral({ remotes: { carrinho: 'https://cdn.empresa.com/carrinho/vitral.json' } })],
})
```

```ts
// loja/src/app/app.routes.ts
import { CUSTOM_ELEMENTS_SCHEMA, Component } from '@angular/core'

@Component({
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <vitral-remote name="carrinho" [props]="{ userId: 42 }">
      <p slot="fallback">Carregando…</p>
    </vitral-remote>
  `,
})
class PaginaCarrinho {}

export const routes = [{ path: 'carrinho', component: PaginaCarrinho }]
```

Com vitral, o carrinho pode usar outra versão do Angular, ou outro framework.

## Host

Registre os remotes no bootstrap. `provideVitral` chama `configure` e registra o elemento `<vitral-remote>`:

```ts
// main.ts
import { bootstrapApplication } from '@angular/platform-browser'
import { provideVitral } from 'vitral/angular'
import { App } from './app'

bootstrapApplication(App, {
  providers: [provideVitral({ remotes: '/remotes.json' })],
})
```

Use `<vitral-remote>` no template. Adicione `CUSTOM_ELEMENTS_SCHEMA`:

```ts
import { CUSTOM_ELEMENTS_SCHEMA, Component, signal } from '@angular/core'

@Component({
  selector: 'app-pagina',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <vitral-remote
      #carrinho
      name="carrinho"
      [props]="{ userId: userId() }"
      (vitral-error)="erro.set(true)">
      <p slot="fallback">Carregando…</p>
    </vitral-remote>
    @if (erro()) {
      <button (click)="carrinho.retry()">Tentar de novo</button>
    }
  `,
})
export class Pagina {
  userId = signal(42)
  erro = signal(false)
}
```

No SSR do Angular, `provideVitral` não faz nada. O remote monta no cliente. Atributos e eventos do elemento estão em [JS/TS puro](./javascript#host).

## Remote

As props viram `input()` do componente:

```ts
// src/remote.ts
import { Component, input } from '@angular/core'
import { provideHttpClient } from '@angular/common/http'
import { angularRemote } from 'vitral/angular'

@Component({
  selector: 'app-carrinho',
  template: `<p>Carrinho de {{ userId() }}</p>`,
})
class Carrinho {
  userId = input(0)
}

export default angularRemote(Carrinho, { providers: [provideHttpClient()] })
```

O segundo argumento é um `ApplicationConfig` parcial.

Build com Vite e `@analogjs/vite-plugin-angular`:

```js
// vite.config.js
import angular from '@analogjs/vite-plugin-angular'
import vitral from 'vitral/vite'

export default { plugins: [angular(), vitral({ entry: 'src/remote.ts' })] }
```

## Contexto, eventos e estado no remote

```ts
import { injectShared, injectVitral, VITRAL_CONTEXT } from 'vitral/angular'

class Carrinho {
  vitral = injectVitral()                                 // ou inject(VITRAL_CONTEXT)
  nome = injectShared('usuario', (u) => u?.nome)          // Signal

  finalizar() {
    this.vitral?.events.emit('carrinho:finalizado', 42)
    this.vitral?.navigate('/pedidos')
  }
}
```

| Função | O que faz |
| --- | --- |
| `injectVitral()` | Devolve o `ctx` do remote |
| `VITRAL_CONTEXT` | Token de injeção do `ctx` |
| `injectShared(chave, seletor?)` | Valor do [contexto compartilhado](/aprender/contexto) como `Signal` |
