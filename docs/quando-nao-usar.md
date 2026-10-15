# Quando não usar o vitral

Use o vitral quando deploys independentes resolvem uma necessidade do produto ou das equipes. Ter vários repositórios, sozinho, não obriga a usar micro-frontends.

## Uma equipe publica tudo junto

Se as partes têm o mesmo ciclo de entrega, pacotes compartilhados ou uma aplicação modular costumam exigir menos configuração.

## Você precisa do HTML do remote no servidor

O host pode renderizar o fallback no servidor, mas o remote monta no cliente. Isso não oferece SSR do conteúdo remoto nem transfere automaticamente recursos de servidor do Next/Nuxt.

Se SEO ou a primeira resposta HTML dependem desse conteúdo, avalie composição no servidor antes de escolher esta arquitetura.

## Você precisa executar código não confiável

O modo padrão e o Shadow DOM não isolam JavaScript. O modo opt-in por iframe existe, mas muda a comunicação e exige revisar as permissões. Ele não torna automaticamente qualquer aplicação legada compatível. Veja [Segurança](/guia/seguranca).

## Cada área já é uma página independente

Se navegar entre aplicações completas atende ao produto, o servidor pode escolher a aplicação por caminho. Não é necessário compor todas elas no navegador.

## Você precisa de garantias automáticas entre deploys

O vitral gera tipos para entradas JS/TS e permite baixá-los no host com `npx vitral types`. Entradas `.vue` e `.svelte` ainda não geram esses tipos.

Tipos ajudam no desenvolvimento, mas não impedem um deploy incompatível depois que o host foi compilado. Combine contratos, testes de integração e uma estratégia de rollback.

Veja [Comparação](/comparacao) para avaliar as diferenças de proposta.
