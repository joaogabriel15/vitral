# Contexto compartilhado

Estado e serviços que host e remotes leem e alteram juntos: usuário, tema, carrinho.

## Quando usar

Quando vários remotes precisam do mesmo valor e devem ver as mudanças. Para dados de uma instância, use [props](./props-eventos). Para avisos sem estado, use [eventos](./props-eventos#eventos).

## Criar e ler

```ts
// host: cria o valor e vira o dono
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
tema.get()                                  // 'claro'
const parar = tema.subscribe((t) => {})     // chama agora e a cada mudança
shared('usuario').update((u) => ({ ...u, nome: 'Caio' }))
```

| Método | O que faz |
| --- | --- |
| `get()` | Valor atual. `undefined` se ninguém deu valor |
| `set(valor)` | Troca o valor |
| `update(fn)` | Troca a partir do valor atual |
| `subscribe(fn)` | Chama agora e a cada mudança. Devolve a função que cancela |

| Opção de `provide` | Padrão | O que faz |
| --- | --- | --- |
| `writable` | `true` | `false`: só o dono altera. Outro `set` lança [`SHARED_READONLY`](/erros/SHARED_READONLY) em desenvolvimento |

O primeiro `provide` de uma chave é o dono. Um segundo `provide` da mesma chave não grava nada.

## Em cada framework

| Framework | Como ler |
| --- | --- |
| React, Preact | `useShared('usuario', (u) => u?.nome)` |
| Vue | `useShared('tema')`, um ref gravável |
| Solid | `useShared('usuario')`, um accessor |
| Angular | `injectShared('usuario')`, um `Signal` |
| Svelte | `$tema`, com `const tema = shared('tema')` |
| Lit | `new SharedController(this, 'usuario')` |

Com seletor, o componente só re-renderiza quando o resultado muda.

Dentro do remote, `ctx.shared` é o mesmo `shared`, mas as assinaturas feitas por ele são canceladas no unmount.

## Tipos

Declare uma vez, no host e em cada remote:

```ts
declare module 'vitral' {
  interface Shared {
    usuario: { id: number; nome: string } | null
    tema: 'claro' | 'escuro'
  }
}
```

## Várias mudanças de uma vez

```ts
import { batch } from 'vitral'

batch(() => {
  usuario.set(novo)
  carrinho.set([])
}) // cada chave notifica uma vez, no fim
```

## Guardar no navegador e espelhar entre abas

```ts
import { persist, provide, syncTabs } from 'vitral'

const carrinho = syncTabs(persist(provide('carrinho', []), { version: 1 }))
```

| Opção de `persist` | Padrão | O que faz |
| --- | --- | --- |
| `storage` | `'local'` | `'local'` ou `'session'` |
| `version` | `1` | Versão do formato. Suba ao mudar o formato do valor |

`syncTabs` espelha as mudanças entre abas da mesma origem. Chame no dono.

Para levar valores do servidor ao cliente, veja [SSR](./ssr).
