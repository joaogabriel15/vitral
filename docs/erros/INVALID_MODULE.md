# INVALID_MODULE

O arquivo baixou, mas não tem o formato esperado.

## Causas

- O JS do remote não exporta `mount()` (nem `export default { mount }` nem `export function mount`).
- O `vitral.json` não tem o campo `entry`.
- O `vitral.json` ou o `remotes.json` não é um JSON válido. Um caso comum: o servidor devolveu a página HTML de fallback no lugar do arquivo.

## Como corrigir

No remote, exporte com `defineRemote()` ou com um adaptador:

```ts
import { defineRemote } from 'vitral'

export default defineRemote({
  mount(el, props) {
    el.textContent = props.msg
    return { unmount: () => el.replaceChildren() }
  },
})
```

Abra a URL do manifesto no navegador e confira se ela devolve JSON.
