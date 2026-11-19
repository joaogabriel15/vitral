# Angular

Angular 17 or newer. Import: `vitral/angular`.

## Today and with vitral

Example: an Angular shop shows the cart, built by another team. Both sides have the same files, in the same order.

### Today, with Native Federation

```ts
// cart/src/app/cart.component.ts
import { Component, input } from '@angular/core'

@Component({
  selector: 'app-cart',
  template: `<p>Cart for user {{ userId() }}</p>`,
})
export default class CartComponent {
  userId = input(0)
}
```

```js
// cart/federation.config.js
const { withNativeFederation, shareAll } = require('@angular-architects/native-federation/config')

module.exports = withNativeFederation({
  name: 'cart',
  exposes: { './Cart': './src/app/cart.component.ts' },
  shared: { ...shareAll({ singleton: true, strictVersion: true, requiredVersion: 'auto' }) },
})
```

```js
// shop/federation.config.js
const { withNativeFederation, shareAll } = require('@angular-architects/native-federation/config')

module.exports = withNativeFederation({
  shared: { ...shareAll({ singleton: true, strictVersion: true, requiredVersion: 'auto' }) },
})
```

```ts
// shop/src/main.ts
import { initFederation } from '@angular-architects/native-federation'

initFederation({ cart: 'https://cdn.example.com/cart/remoteEntry.json' })
  .then(() => import('./bootstrap'))
```

```ts
// shop/src/app/app.routes.ts
import { loadRemoteModule } from '@angular-architects/native-federation'

export const routes = [
  {
    path: 'cart',
    loadComponent: () => loadRemoteModule('cart', './Cart').then((m) => m.default),
  },
]
```

### With vitral

```ts
// cart/src/app/cart.component.ts (same)
import { Component, input } from '@angular/core'

@Component({
  selector: 'app-cart',
  template: `<p>Cart for user {{ userId() }}</p>`,
})
export default class CartComponent {
  userId = input(0)
}
```

```js
// cart/vite.config.js (instead of federation.config.js)
import angular from '@analogjs/vite-plugin-angular'
import vitral from 'vitral/vite'

export default {
  plugins: [
    angular(),
    vitral({ name: 'cart', entry: 'src/app/cart.component.ts' }),
  ],
}
```

```js
// shop/federation.config.js (not needed anymore)
```

```ts
// shop/src/main.ts (provideVitral instead of initFederation)
import { bootstrapApplication } from '@angular/platform-browser'
import { provideVitral } from 'vitral/angular'
import { App } from './app'

bootstrapApplication(App, {
  providers: [provideVitral({ remotes: { cart: 'https://cdn.example.com/cart/vitral.json' } })],
})
```

```ts
// shop/src/app/app.routes.ts
import { CUSTOM_ELEMENTS_SCHEMA, Component } from '@angular/core'

@Component({
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <vitral-remote name="cart" [props]="{ userId: 42 }">
      <p slot="fallback">Loading…</p>
    </vitral-remote>
  `,
})
class CartPage {}

export const routes = [{ path: 'cart', component: CartPage }]
```

With vitral, the cart can use another Angular version, or another framework.

## Host

Register the remotes at bootstrap. `provideVitral` calls `configure` and registers the `<vitral-remote>` element:

```ts
// main.ts
import { bootstrapApplication } from '@angular/platform-browser'
import { provideVitral } from 'vitral/angular'
import { App } from './app'

bootstrapApplication(App, {
  providers: [provideVitral({ remotes: '/remotes.json' })],
})
```

Use `<vitral-remote>` in the template. Add `CUSTOM_ELEMENTS_SCHEMA`:

```ts
import { CUSTOM_ELEMENTS_SCHEMA, Component, signal } from '@angular/core'

@Component({
  selector: 'app-page',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <vitral-remote
      #cart
      name="cart"
      [props]="{ userId: userId() }"
      (vitral-error)="failed.set(true)">
      <p slot="fallback">Loading…</p>
    </vitral-remote>
    @if (failed()) {
      <button (click)="cart.retry()">Try again</button>
    }
  `,
})
export class Page {
  userId = signal(42)
  failed = signal(false)
}
```

In Angular SSR, `provideVitral` does nothing. The remote mounts on the client. The element's attributes and events are in [Plain JS/TS](./javascript#host).

## Remote

Props become the component's `input()`s:

```ts
// src/remote.ts
import { Component, input } from '@angular/core'
import { provideHttpClient } from '@angular/common/http'
import { angularRemote } from 'vitral/angular'

@Component({
  selector: 'app-cart',
  template: `<p>Cart for {{ userId() }}</p>`,
})
class Cart {
  userId = input(0)
}

export default angularRemote(Cart, { providers: [provideHttpClient()] })
```

The second argument is a partial `ApplicationConfig`.

Build with Vite and `@analogjs/vite-plugin-angular`:

```js
// vite.config.js
import angular from '@analogjs/vite-plugin-angular'
import vitral from 'vitral/vite'

export default { plugins: [angular(), vitral({ entry: 'src/remote.ts' })] }
```

## Context, events and state in the remote

```ts
import { injectShared, injectVitral, VITRAL_CONTEXT } from 'vitral/angular'

class Cart {
  vitral = injectVitral()                                 // or inject(VITRAL_CONTEXT)
  name = injectShared('user', (u) => u?.name)             // Signal

  checkout() {
    this.vitral?.events.emit('cart:checkout', 42)
    this.vitral?.navigate('/orders')
  }
}
```

| Function | What it does |
| --- | --- |
| `injectVitral()` | Returns the remote's `ctx` |
| `VITRAL_CONTEXT` | Injection token for `ctx` |
| `injectShared(key, selector?)` | Value from the [shared context](/en/aprender/contexto) as a `Signal` |
