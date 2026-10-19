# CONTRACT_MISMATCH

O host declarou `contract` e o `vitral.json` do remote não atende. O JS do remote não é baixado nem executado, e `mount()` não é chamado.

## Causas

- A versão do contrato do remote está fora da faixa do host. Ex.: o host aceita `^2` e o remote publicou `contract: { version: '3.0.0' }`.
- O host oferece uma dependência com `dedupe` numa versão fora da faixa que o remote espera. Ex.: o remote foi feito com `dedupe: ['react']` e React 19 (`^19.0.0`), e o host oferece React 18.3.1.

A mensagem traz o nome do remote, a faixa esperada e a versão encontrada:

```
[vitral] carrinho: o host aceita contrato ^2, o remote publica 3.0.0
[vitral] carrinho: o remote espera react ^19.0.0, o host oferece 18.3.1
```

## O que não é conferido

- Remote sem `contract` no `vitral.json` (manifesto antigo ou URL direta do JS).
- Host sem `contract` no `configure` nem na entrada do remote.
- Dependência que o host não oferece: o remote usa a própria cópia.

## Como corrigir

- Publique o remote com uma versão de contrato que o host aceita, ou atualize a faixa no host (`contract: '^3'`) depois de adaptar o host.
- Para dependências, alinhe a versão do host e a do remote, ou tire a dependência do `dedupe` do remote.

Veja [Contrato entre host e remote](/aprender/deploy#contrato-entre-host-e-remote).
