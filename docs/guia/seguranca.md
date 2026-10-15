# Segurança

Carregue remotes de quem você confia como confia no próprio código. No modo padrão e no Shadow DOM, eles executam com os privilégios da página.

## Origens permitidas

Registre as URLs no host e, para uma lista explícita, use:

```ts
import { configure } from 'vitral'

configure({
  remotes: { produtos: 'https://cdn.empresa.com/produtos/vitral.json' },
  allowedOrigins: ['https://cdn.empresa.com'],
})
```

Sem `allowedOrigins`, o vitral aceita a origem da página e as origens registradas. A origem da entrada JavaScript também é conferida.

A prop `src` dos componentes de host é tratada como URL confiável e adiciona sua origem às permitidas. Use URLs definidas pela aplicação, não valores arbitrários enviados por usuários. O atributo `src` de `<vitral-remote>` respeita a lista explícita.

## Integridade

O plugin gera hashes no manifesto. Quando há hash, o vitral confere o conteúdo antes de executá-lo. **Sem hash, o carregamento de JavaScript ainda é permitido.**

Se manifesto e código vêm do mesmo CDN, alguém que altere os dois pode trocar também o hash. Para fixar a versão confiável, forneça o hash no host:

```ts
configure({
  remotes: {
    produtos: {
      url: 'https://cdn.empresa.com/produtos/vitral.json',
      integrity: 'sha384-…',
    },
  },
})
```

Atualize esse valor ao aprovar um novo build. O hash do host prevalece sobre o do manifesto. O CSS também é conferido quando seu hash está no manifesto; falhas de CSS podem deixar a área sem estilo sem impedir a montagem.

## CSP

Permita a origem do remote nas diretivas necessárias:

- `connect-src`: manifesto, JavaScript e CSS baixados por fetch;
- `script-src`: execução dos módulos;
- `style-src`: folhas de estilo.

O carregamento com integridade usa os recursos disponíveis no navegador: import map com integridade, modulepreload com SRI ou verificação dos bytes e execução via `blob:`. Esse último caminho exige `blob:` em `script-src`. A lib repassa o nonce de um script da página ao import map.

Não adicione permissões sem necessidade: teste a política nos navegadores suportados pela aplicação. Os detalhes dos caminhos e dos hashes estão em [INTEGRITY](/erros/INTEGRITY).

## Limites do isolamento

Shadow DOM separa estilos, não JavaScript. Ele não impede acesso ao DOM do host, ao localStorage ou a cookies acessíveis por JavaScript.

Para uma fronteira de execução separada, existe o modo opt-in `vitral/iframe`, com restrições de comunicação. Veja [Isolar por iframe](/formas-de-usar). Revise as permissões e as pontes que você expõe antes de carregar código de terceiros.

Em `component()`, interpolações de texto são escapadas. `unsafeHTML()` desliga esse escape: use apenas conteúdo confiável.
