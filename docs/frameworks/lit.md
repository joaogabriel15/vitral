# Lit e Web Components

Lit, Stencil ou qualquer Custom Element. Import: `vitral/element`.

## Hoje e com vitral

Exemplo: uma loja que mostra o carrinho de outra equipe, feito em Lit.

### Hoje, com o elemento num script

O carrinho publica um script que registra a tag. A loja carrega o script e usa a tag.

```js
// carrinho/src/index.js
import { Carrinho } from './Carrinho'

customElements.define('meu-carrinho', Carrinho)
```

```html
<!-- loja -->
<script type="module" src="https://cdn.empresa.com/carrinho/index.js"></script>

<meu-carrinho user-id="42"></meu-carrinho>
```

Duas lojas, ou dois carrinhos em versões diferentes, não podem registrar a mesma tag na página. O CSS e a versão do Lit também não ficam isolados.

### Com vitral

```js
// carrinho/src/remote.js (a classe, sem customElements.define)
import { Carrinho } from './Carrinho'

export default Carrinho
```

```js
// carrinho/vite.config.js
import vitral from 'vitral/vite'

export default { plugins: [vitral({ entry: 'src/remote.js' })] }
```

```html
<!-- loja -->
<script type="module" src="https://cdn.jsdelivr.net/npm/vitral/dist/auto.js"></script>

<vitral-remote src="https://cdn.empresa.com/carrinho/vitral.json" props='{"userId": 42}'>
  <p slot="fallback">Carregando…</p>
</vitral-remote>
```

O plugin registra a tag num registro só do remote. Duas versões do carrinho podem estar na mesma página.

## Host

Use `<vitral-remote>`. Ele funciona dentro de um componente Lit como em qualquer HTML:

```js
import { LitElement, html } from 'lit'
import { configure } from 'vitral'
import { defineVitralElement } from 'vitral/element'

configure({ remotes: { carrinho: 'https://cdn.empresa.com/carrinho/vitral.json' } })
defineVitralElement()

class Pagina extends LitElement {
  render() {
    return html`
      <vitral-remote name="carrinho" .props=${{ userId: 42 }}>
        <p slot="fallback">Carregando…</p>
      </vitral-remote>
    `
  }
}
```

Atributos, propriedades e eventos estão em [JS/TS puro](./javascript#host).

## Remote

Com o plugin, basta exportar a classe. O plugin registra a tag:

```js
// src/remote.js
import { LitElement, html } from 'lit'

export default class Carrinho extends LitElement {
  static properties = { userId: {} }
  render() {
    return html`<button @click=${() => this.vitral.events.emit('carrinho:abrir')}>Carrinho de ${this.userId}</button>`
  }
}
```

```js
// vite.config.js
import vitral from 'vitral/vite'

export default { plugins: [vitral({ entry: 'src/remote.js' })] }
```

Ou registre a tag você mesmo e use `elementRemote`. O `setup` recebe o registro de custom elements do remote:

```js
import { elementRemote } from 'vitral/element'

export default elementRemote('meu-carrinho', (registry) => {
  if (!registry.get('meu-carrinho')) registry.define('meu-carrinho', Carrinho)
  if (!registry.get('ds-button')) registry.define('ds-button', DsButton)
})
```

No Shadow DOM, com suporte do navegador, esse registro é só do remote: outro remote pode ter um `<ds-button>` de outra versão. O plugin também define a classe exportada nele. Uma classe com `@customElement` já foi para o registro global quando o módulo carregou. Veja [Custom elements de cada remote](/aprender/estilos#custom-elements-de-cada-remote).

As props viram propriedades do elemento. O `ctx` fica em `this.vitral`.

## Estado compartilhado

```js
import { SharedController } from 'vitral/element'

class Perfil extends LitElement {
  usuario = new SharedController(this, 'usuario')
  render() {
    return html`${this.usuario.value?.nome}`
  }
}
```

`SharedController(host, chave, seletor?)` assina enquanto o elemento está conectado. Veja [Contexto compartilhado](/aprender/contexto).
