# Dedupe de dependências

Faz o remote usar o React ou o Vue que já está na página, em vez de baixar outra cópia.

## Quando usar

Quando vários remotes usam o mesmo framework e você quer baixá-lo uma vez só. Sem `dedupe`, cada remote leva a própria cópia e nunca há conflito de versão.

## Código

```js
// vite.config.js do remote
import react from '@vitejs/plugin-react'
import vitral from 'vitral/vite'

export default { plugins: [react(), vitral({ dedupe: ['react'] })] }
```

- O remote usa a cópia da página quando a versão serve: `^` da versão instalada no remote.
- Quando não serve, ou não há cópia na página, baixa a própria.
- `<Remote>` de `vitral/react` oferece o React do host sem configuração.
- `['react']` cobre o grupo inteiro: `react`, `react-dom`, `react-dom/client` e o JSX runtime.

- `'pacote/*'` cobre o pacote e cada subpath do `exports` dele. Serve para um pacote publicado como código-fonte (uma biblioteca de componentes da empresa): os imports que chegam a um arquivo do pacote por alias ou `paths` do tsconfig também usam a cópia da página, se o arquivo sai por algum export dele. O build avisa os arquivos que não saem; esses ficam com cópia própria.

| Opção | Exemplo | O que faz |
| --- | --- | --- |
| `dedupe` | `['react']`, `['vue']`, `['@empresa/ui/*']` | Dependências que o remote pega da página quando a versão serve |
| `shared` (obsoleta) | `['react', 'react-dom/client']` | Tira do bundle e espera um import map no host. Prefira `dedupe` |

O host oferece outras dependências com `configure({ dedupe })`. Com uma função em `modules`, elas só são carregadas quando um remote pede, e não pesam no bundle inicial:

```ts
configure({
  dedupe: {
    i18next: { version: '25.1.0', modules: () => import('i18next').then((m) => ({ i18next: m })) },
  },
})
```

Num host Next, `share` do [`withVitral`](/frameworks/next#host-next-no-lugar-das-zonas) gera isso com as versões instaladas.

O manifesto do remote lista, em `uses`, os nomes que ele lê de cada especificador. Os nomes são os do build de produção de cada pacote. Se a oferta do host não tem um deles, o remote usa a cópia própria daquele grupo e avisa no console (`a oferta de X não tem ...`). No grupo do React, o remote só avisa e fica com o React do host, porque duas cópias na página quebram hooks e contexto.

Cuidado com um `import()` do pacote inteiro numa oferta: para o webpack, ele marca como usados todos os exports dos barrels do pacote. Assim, o que a tela não usa (os gráficos de uma biblioteca de componentes, por exemplo) entra nas páginas que importam o pacote. No host Next, o `withVitral` evita isso no build (veja [Ofertas só com os nomes usados](/frameworks/next#ofertas-so-com-os-nomes-usados)).

## Uma versão para todos os remotes

No navegador, cada remote pega a primeira oferta que serve, na ordem em que chega. Com um remote em `^1.0.0` (cópia 1.2) e outro em `^1.3.0` (cópia 1.4), quando o primeiro chega antes, a página baixa as duas, embora a 1.4 sirva aos dois.

Com os manifestos de todos os remotes, `planDedupe` escolhe para cada grupo o menor conjunto de versões que atende todas as faixas: a oferta do host primeiro, depois as mais novas. Cada remote recebe a cópia que deve usar, mesmo que ela venha de outro remote:

```ts
import { configure, planDedupe } from 'vitral'

const { plan, notes } = planDedupe(
  { a: { url: '/a/vitral.json', manifest: manifestoA }, b: { url: '/b/vitral.json', manifest: manifestoB } },
  { react: '19.2.0' }, // o que o host oferece
)
configure({ dedupePlan: plan })
```

- `notes` explica, em texto, cada grupo em que as faixas não têm uma versão em comum e quantas cópias a página vai baixar.
- O plano leva o hash de cada cópia, e o SRI confere como sempre.
- Cada entrada vale só para a faixa e a versão do build em que foi calculada. Se o remote publica outra versão, ele volta a usar a própria cópia até o plano ser refeito.
- No host Next, o `withVitral` calcula o plano no build, com os manifestos que acha (em `public/` ou `manifestFile`), e avisa os conflitos no terminal.
