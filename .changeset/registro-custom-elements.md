---
'vitral': minor
---

`ctx.customElements`: no Shadow DOM, cada remote recebe um `CustomElementRegistry` próprio quando o navegador tem Scoped Custom Element Registries (Chrome e Edge 146+, Safari 26+). O shadow root e o elemento do mount são criados com ele, então dois remotes podem definir `<ds-button>` de versões diferentes. Sem suporte, e fora do Shadow DOM, é o registro global: um `define` de tag que outro remote já definiu não lança mais, fica a primeira definição, com aviso em dev. `elementRemote(tag, setup)` passa o registro para `setup`, cria o elemento com ele e aceita uma tag devolvida por `setup`; o plugin define a classe exportada no registro do remote.
