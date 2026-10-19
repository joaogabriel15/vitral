# Angular

Angular 17 ou mais novo. Import: `vitral/angular`.

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
