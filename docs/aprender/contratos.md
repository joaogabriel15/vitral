# Contratos entre host e remote

O host grava o que passa para cada remote. O remote reproduz essa gravação no próprio CI. Assim o time do remote descobre a quebra antes do deploy, e não pelo host em produção.

```
host (testes)                         remote (CI)
record() ─► carrinho.contract.json ─► npx vitral test --contract
```

## Quando usar

Quando host e remote ficam em repositórios ou times diferentes e um deploy do remote pode quebrar o host.

## 1. Testar o remote sozinho

`harness` monta o remote com um `ctx` simulado, sem host:

```ts
// @vitest-environment happy-dom
import { harness } from 'vitral/testing'
import remote from '../src/remote'

test('emite a compra', async () => {
  const h = await harness(remote, { props: { itens: 2 }, shared: { usuario: { id: 1 } } })
  expect(h.el.textContent).toContain('2 itens')
  h.emit('tema', 'escuro')                        // como se fosse o host
  h.el.querySelector('button')!.click()
  expect(h.events).toContainEqual({ type: 'carrinho:compra', payload: { total: 10 } })
  h.update({ itens: 3 })
  h.unmount()
})
```

| Opção | O que faz |
| --- | --- |
| `props` | Props do mount |
| `name` | `ctx.name`. Padrão `'remote'` |
| `shadow` | Monta dentro de um shadow root |
| `shared` | Valores iniciais de `ctx.shared` |
| `last` | Valores iniciais de `ctx.events.last` |
| `ctx` | Campos que substituem os do `ctx` simulado |
| `target` | Onde montar. Padrão: um `<div>` novo no `body` |

O retorno tem `el`, `ctx`, `events` (o que o remote emitiu), `errors` (`reportError` e handlers que lançaram), `navigations`, `listens()`, `emit()`, `update()`, `activate()`, `deactivate()` e `unmount()`.

## 2. Gravar no host

Nos testes do host (unitários ou e2e), chame `record()` antes de montar os remotes e de assinar eventos:

```ts
import { record } from 'vitral/testing'

const rec = record({ host: 'loja' })
// ... os testes montam <Remote name="carrinho" props={{ itens: 2 }} /> ...
afterAll(() => rec.save('contracts'))       // contracts/carrinho.contract.json
```

Para cada remote, o contrato guarda:

| Campo | O que é |
| --- | --- |
| `props` e `updates` | O que o host passou no mount e em cada update |
| `inputs` | Eventos que o host emitiu e o remote escutava |
| `shared` e `last` | O que o remote leu de `ctx.shared` e de `ctx.events.last` |
| `emits` | Eventos do remote que o host escuta, e quando saíram (`mount`, `update`, `input` ou `later`) |
| `listens` | Eventos que o remote assinou |

Funções nas props viram `{ "$fn": true }`. Casos iguais entram uma vez só (até 50 por remote; mude com `max`). Schema: [`vitral-contract.json`](/schema/vitral-contract.json).

Num e2e no navegador, `save` não existe (não há disco). Exponha os contratos e grave pelo Playwright:

```ts
// no host, só em teste
import { record } from 'vitral/testing'
const rec = record({ host: 'loja' })
;(window as any).__contracts = () => rec.contracts()
```

```ts
// no teste do Playwright
const contratos = await page.evaluate(() => (window as any).__contracts())
for (const [nome, c] of Object.entries(contratos)) writeFileSync(`contracts/${nome}.contract.json`, JSON.stringify(c, null, 2))
```

Publique a pasta `contracts/` onde o CI do remote consiga ler (um artefato, um pacote ou um commit no repositório do remote).

## 3. Reproduzir no CI do remote

```yaml
- run: npm run build
- run: npx vitral test --contract contracts/ --since https://cdn.exemplo.com/carrinho/vitral.json
```

`--contract` monta `dist/` em happy-dom, sem navegador, com cada caso gravado. Falha quando:

- o mount, um update ou o unmount lança erro, ou o remote chama `ctx.reportError`;
- um evento que o host escuta e que saiu no mount, num update ou em resposta a um evento do host não sai mais;
- um evento que o host escuta e que saiu depois (num clique) não aparece mais no código do build;
- as props gravadas não batem com o `Props` do `vitral.d.ts` local (prop obrigatória nova, tipo que mudou).

Avisa, sem falhar, quando o host emite um evento que o remote não escuta mais, ou passa uma prop que o remote não declara.

`--since` compara o `Props` do `vitral.d.ts` publicado com o do build:

```
✗ quebra: prop obrigatória nova: moeda: string
✗ quebra: prop removida: cupom: string (o host que ainda passa cupom não compila)
✓ compatível: tipo de tema aceita mais valores: "claro" → "claro" | "escuro"
```

Quebra: prop obrigatória nova, opcional que virou obrigatória, prop removida e tipo que não aceita mais o valor antigo.

## Limites

- O remote precisa usar `ctx.events` e `ctx.shared`. Um remote que importa `events` de `'vitral'` direto tem os eventos contados como do host.
- Remotes em `isolate: 'iframe'` e partes (`carrinho/Mini`) não são gravados.
- O replay roda em happy-dom: o que depende de layout ou de rede no mount precisa de dublê no próprio remote.

[Opções completas da CLI](/referencia/cli#vitral-test) · [vitral/testing](/referencia/testing)
