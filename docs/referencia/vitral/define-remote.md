# defineRemote

Declara um remote escrito à mão, sem adaptador de framework. Só adiciona tipos.

```ts
defineRemote<P>(remote: RemoteModule<P>): RemoteModule<P>
```

## Uso

```ts
import { defineRemote } from 'vitral'

export default defineRemote<{ nome: string }>({
  mount(el, props, ctx) {
    el.textContent = `Olá, ${props.nome}`
    return {
      update(next) {
        el.textContent = `Olá, ${next.nome}`
      },
      unmount() {
        el.textContent = ''
      },
    }
  },
})
```

## Parâmetros

`mount(el, props, ctx)` recebe:

| Parâmetro | O que é |
| --- | --- |
| `el` | Elemento onde o remote desenha |
| `props` | Props passadas pelo host |
| `ctx` | Contexto do remote. Veja abaixo |

`mount` devolve `{ update?, unmount }`, ou uma Promise com esse objeto.

## Retorno

O mesmo objeto recebido.

## `ctx`

| Campo | O que é |
| --- | --- |
| `name` | Nome com que o host registrou o remote |
| `baseUrl` | URL base de onde o remote foi carregado. Use para assets |
| `events` | O [barramento de eventos](./events). Assinaturas canceladas no unmount |
| `shared` | O mesmo [`shared`](./shared). Assinaturas canceladas no unmount |
| `shadowRoot` | Shadow root com `isolate: 'shadow'`, senão `null` |
| `portalContainer` | Destino de [portais](/aprender/estilos#portais-radix-headless-ui-mui). No Shadow DOM, um elemento dentro do shadow root; senão, `document.body` |
| `customElements` | Registro de custom elements do remote. No Shadow DOM, com suporte do navegador, um registro só dele. Veja [Custom elements de cada remote](/aprender/estilos#custom-elements-de-cada-remote) |
| `navigate(url, { replace? })` | Igual a [`navigate`](./navigate) |
| `reportError(erro)` | Mostra o erro no host |
| `onActivate(fn)`, `onDeactivate(fn)` | Com keep-alive: volta e saída da página |
| `mcp` | Só no [MCP App](/aprender/mcp-app): `request`, `notify` e `hostContext()` do host MCP |

## Observações

- Sem `update`, o host remonta a cada mudança de props.
- `onActivate`, `onDeactivate`, `shared` e `customElements` podem faltar em hosts antigos. Use `ctx.onActivate?.(fn)` e `ctx.customElements ?? customElements`.
