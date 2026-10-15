# Comparação

O vitral reúne carregamento remoto, adaptadores, estilos e estados de carregamento numa API de composição de interfaces. A escolha depende de como suas equipes publicam e integram aplicações.

## O que comparar

| Necessidade | Como o vitral atende | Limite |
| --- | --- | --- |
| Deploy por área | O host conhece a URL de um manifesto | As equipes ainda precisam manter contratos compatíveis |
| Host com pouca configuração | Registro por URL, sem plugin de build do vitral no host | Os remotes precisam de uma entrada compatível |
| Frameworks diferentes | Adaptadores e raízes separadas | Providers e contextos dos frameworks não atravessam automaticamente |
| Estilos | Escopo de seletores ou Shadow DOM | Regras globais e herança exigem cuidado |
| Falhas de carregamento | Fallback, erro e retry por área | Não captura toda exceção nem isola JavaScript |
| Integridade | Verificação quando há hashes | A confiança no manifesto e na origem continua necessária |
| Renderização no servidor | Fallback do host | Conteúdo do remote monta no cliente |

## Module Federation

Module Federation oferece registro e carregamento por plugin ou por runtime. O modo runtime **também pode funcionar sem plugin de build no host**. Avalie compartilhamento de módulos, dependências, tipos e integrações com o seu framework.

No vitral, o ponto de partida é uma interface montável, com ciclo de vida e estilos. Não se trata de uma substituição direta para todo uso de módulos federados.

Referência: [Runtime Access](https://module-federation.io/guide/runtime/).

## single-spa

single-spa organiza aplicações por ciclos de vida e rotas. Também possui tratamento de erros: uma aplicação quebrada pode ser isolada enquanto as outras continuam.

O vitral oferece componentes de host, manifesto e plugin de remote como um caminho integrado. Compare o trabalho necessário para o seu cenário, não apenas a quantidade de conceitos.

Referência: [Applications API](https://single-spa.js.org/docs/api/).

## Tamanho e velocidade

Os [benchmarks](/benchmarks) medem o tamanho das entradas escolhidas e um cenário de carregamento do vitral. Eles não demonstram que o vitral é mais rápido que todas as alternativas.

Para decidir, compare a mesma aplicação, incluindo os frameworks transferidos, CSS, cache e recursos de isolamento usados.

## Antes de migrar

Teste uma área pequena, confirme sessão e navegação e faça um deploy independente. Se a solução atual atende bem, a migração precisa justificar seu custo.

Veja [Quando não usar](/quando-nao-usar) e os guias de migração para [Module Federation](/migracao/module-federation), [single-spa](/migracao/single-spa) e [qiankun](/migracao/qiankun).
