# Contexto compartilhado

Estado e serviços comuns a host e remotes. Quem cria o valor usa `provide`; quem consome usa `shared` ou o hook do framework.

```ts
// host (ou qualquer remote): cria o valor e vira dono dele
import { provide } from 'vitral'

const usuario = provide('usuario', { id: 42, nome: 'Ana' })
provide('tema', 'claro', { writable: false })      // só o dono altera
provide('auth', { getToken: () => sessao.token })  // serviços também
usuario.set({ id: 7, nome: 'Bia' })                 // todos os remotes atualizam
```

```ts
// qualquer remote
import { shared } from 'vitral'

const tema = shared('tema')
tema.get()                                // 'claro'
const off = tema.subscribe((t) => …)      // chama agora e a cada mudança
shared('usuario').update((u) => ({ ...u, nome: 'Caio' }))
```

Host e remotes veem o mesmo valor mesmo quando cada um traz a própria cópia (e versão) da lib.

## Quando usar o quê

| Use | Para | Exemplo |
| --- | --- | --- |
| props | Dados de uma instância do remote | `<Remote name="carrinho" props={{ userId }} />` |
| `shared` | Estado comum que vários leem | usuário logado, tema, carrinho |
| `events` | Avisos pontuais, sem estado | `events.emit('carrinho:adicionado', item)` |

## Tipos

Declare uma vez no projeto (o host e cada remote):

```ts
declare module 'vitral' {
  interface Shared {
    usuario: { id: number; nome: string } | null
    tema: 'claro' | 'escuro'
  }
}
```

`shared('tema')` passa a ser `SharedValue<'claro' | 'escuro'>`. Chaves fora de `Shared` são `unknown`, ou o tipo que você passar: `shared<number>('contador')`.

`get()` devolve `undefined` enquanto ninguém deu valor à chave.

## Hooks

Todos re-renderizam só quando o valor muda. Com seletor, só quando o resultado do seletor muda (`Object.is`). A assinatura acaba junto com o componente.

```tsx
// React e Preact (vitral/react, vitral/preact)
const nome = useShared('usuario', (u) => u?.nome)
const usuario = useShared('usuario')
```

```ts
// Vue (vitral/vue): ref. Sem seletor, também escreve (v-model funciona).
const tema = useShared('tema')
tema.value = 'escuro'
const nome = useShared('usuario', (u) => u?.nome) // só leitura
```

```ts
// Solid (vitral/solid): accessor
const nome = useShared('usuario', (u) => u?.nome)
nome()
```

```ts
// Angular (vitral/angular): Signal, num contexto de injeção
nome = injectShared('usuario', (u) => u?.nome)
// template: {{ nome() }}
```

```svelte
<!-- Svelte: shared() segue o contrato de store -->
<script>
  import { shared } from 'vitral'
  const tema = shared('tema')
</script>
<p>{$tema}</p>
<button onclick={() => tema.set('escuro')}>escuro</button>
```

```ts
// Lit (vitral/element)
class Perfil extends LitElement {
  usuario = new SharedController<Usuario>(this, 'usuario')
  render() {
    return html`${this.usuario.value?.nome}`
  }
}
```

## Dono e permissão

Quem chama `provide` primeiro é o dono. Um segundo `provide` da mesma chave não grava nada e devolve um acesso comum.

Com `writable: false`, só o dono altera. Um `set` de outro lugar lança [`SHARED_READONLY`](erros/SHARED_READONLY.md) em desenvolvimento e é ignorado com aviso em produção. Para mudanças controladas, o dono expõe ações no próprio valor:

```ts
const carrinho = provide('carrinho', criar([]), { writable: false })

function criar(itens: Item[]) {
  return { itens, adicionar: (item: Item) => carrinho.set(criar([...itens, item])) }
}

// remote
shared('carrinho').get()?.adicionar(item)
```

O valor é tratado como imutável: para mudar, passe um valor novo. `set` com o mesmo valor (`Object.is`) não notifica.

## Várias mudanças de uma vez

```ts
import { batch } from 'vitral'

batch(() => {
  usuario.set(novo)
  carrinho.set(vazio)
}) // cada chave notifica uma vez, no fim
```

## Dentro do remote: `ctx.shared`

`ctx.shared` é o mesmo `shared`, mas o que o remote assina por ele é cancelado no unmount, e as chaves que ele cria com `ctx.shared.provide` perdem o dono (o valor fica).

```ts
export function mount(el, props, ctx) {
  ctx.shared?.('tema').subscribe((t) => (el.dataset.tema = t))
  const itens = ctx.shared?.provide('itens', [])
  return { unmount() {} } // nada para limpar
}
```

`ctx.shared` vem quando o host usa o store (`provide`, `shared` ou um hook). Num host que não usa, importe `shared` de `'vitral'`.

## Guardar e espelhar entre abas (opcional)

```ts
import { persist, provide, syncTabs } from 'vitral'

const carrinho = syncTabs(persist(provide('carrinho', []), { version: 1 }))
```

- `persist` restaura o valor de `localStorage` (ou `{ storage: 'session' }`) na chave `vitral:carrinho:1` e guarda cada mudança. Ao mudar o formato do valor, suba `version`.
- `syncTabs` espelha as mudanças entre abas da mesma origem com `BroadcastChannel`. Chame no dono, nas duas abas. Só passam dados que o `structuredClone` aceita.

## SSR

No servidor nada fica em variável global, para não vazar entre requisições: cada `provide` ou `shared` no servidor tem um valor próprio, e os hooks devolvem `undefined`.

Para levar valores ao cliente, serialize os desta requisição num `<script>` antes dos scripts do app. O store do cliente lê esse script antes dos remotes montarem, e o primeiro `provide` da chave mantém o valor que veio dele.

```ts
import { serializeShared } from 'vitral'

const html = `<script type="application/json" data-vitral-shared>${serializeShared({ usuario })}</script>`
```

```tsx
// Next (App Router), num componente de servidor
<script type="application/json" data-vitral-shared dangerouslySetInnerHTML={{ __html: serializeShared({ usuario }) }} />
```

Funções e `undefined` ficam de fora.

## Protocolo

O store fica em `globalThis[Symbol.for('vitral')].shared()`, instalado pela primeira cópia da lib que usa o store. Ferramentas (devtools, ponte de iframe) podem usar `list()`, que devolve cada chave com valor, dono, quem mudou por último e o número de assinaturas. Os métodos estão descritos no tipo `SharedStore`.
