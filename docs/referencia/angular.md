# vitral/angular

Host e remote em Angular 17 ou mais novo.

```ts
import { provideVitral, angularRemote, injectVitral, injectShared, VITRAL_CONTEXT } from 'vitral/angular'
```

## provideVitral

```ts
provideVitral(config?: VitralConfig): (Provider | EnvironmentProviders)[]
```

```ts
bootstrapApplication(App, {
  providers: [provideVitral({ remotes: '/remotes.json' })],
})
```

Chama [`configure`](/referencia/vitral/configure) e registra `<vitral-remote>`. No template, use o [elemento](/referencia/element) com `CUSTOM_ELEMENTS_SCHEMA`:

```ts
@Component({
  selector: 'app-pagina',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `<vitral-remote name="carrinho" [props]="{ userId: userId() }"></vitral-remote>`,
})
export class Pagina {
  userId = signal(42)
}
```

No SSR, não faz nada. O remote monta no cliente.

## angularRemote

```ts
angularRemote<P>(component: Type<unknown>, config?: Partial<ApplicationConfig>): RemoteModule<P>
```

```ts
export default angularRemote(Carrinho, { providers: [provideHttpClient()] })
```

As props viram `input()` do componente. Props sem `input()` com o mesmo nome são ignoradas.

## injectVitral

```ts
injectVitral(): RemoteContext | null
```

Devolve o `ctx` do remote. O mesmo valor está no token `VITRAL_CONTEXT`.

## injectShared

```ts
injectShared<T, S>(key: string, select?: (value: T | undefined) => S): Signal<S>
```

```ts
usuario = injectShared('usuario')
nome = injectShared('usuario', (u) => u?.nome)
```

Chame num contexto de injeção (construtor ou inicializador de campo). A assinatura acaba no destroy.
