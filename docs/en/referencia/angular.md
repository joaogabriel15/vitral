# vitral/angular

Host and remote in Angular 17 or newer.

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

Calls [`configure`](/en/referencia/vitral/configure) and registers `<vitral-remote>`. In the template, use the [element](/en/referencia/element) with `CUSTOM_ELEMENTS_SCHEMA`:

```ts
@Component({
  selector: 'app-page',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `<vitral-remote name="cart" [props]="{ userId: userId() }"></vitral-remote>`,
})
export class Page {
  userId = signal(42)
}
```

In SSR, it does nothing. The remote mounts on the client.

## angularRemote

```ts
angularRemote<P>(component: Type<unknown>, config?: Partial<ApplicationConfig>): RemoteModule<P>
```

```ts
export default angularRemote(Cart, { providers: [provideHttpClient()] })
```

Props become the component's `input()`. Props without an `input()` of the same name are ignored.

## injectVitral

```ts
injectVitral(): RemoteContext | null
```

Returns the remote's `ctx`. The same value is in the `VITRAL_CONTEXT` token.

## injectShared

```ts
injectShared<T, S>(key: string, select?: (value: T | undefined) => S): Signal<S>
```

```ts
user = injectShared('user')
name = injectShared('user', (u) => u?.name)
```

Call it in an injection context (constructor or field initializer). The subscription ends on destroy.
