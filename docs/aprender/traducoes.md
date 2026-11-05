# Traduções (i18n)

Cada remote traz as traduções dele, e a página baixa só a língua aberta. O host não importa as traduções das outras áreas, e nenhum remote baixa as línguas que ninguém está usando.

- O plugin grava um arquivo por língua (e por namespace) com hash, listado no `vitral.json`.
- O remote baixa a língua aberta junto com o JS, e as traduções entram no i18next do host antes de montar.
- No host Next, o HTML já pré-carrega a tradução da língua aberta, como faz com o JS do remote.
- Numa troca de língua, os remotes já carregados baixam a língua nova antes. A tela continua na língua anterior até os arquivos chegarem e troca tudo junto, host e remotes, sem mostrar as chaves.
- O SRI confere cada arquivo, como confere o JS.

## Hoje e com vitral

Exemplo: uma loja em Next.js com a área "Minha conta", feita por outra equipe, em português e inglês. Os dois lados têm os mesmos arquivos, na mesma ordem.

### Hoje, com Multi-Zones

```
loja/    app Next principal
conta/   segundo app Next (a zona), com o próprio i18next
```

```json
// conta/locales/pt-BR.json (en.json igual, em inglês)
{ "titulo": "Minha conta" }
```

```tsx
// conta/pages/index.tsx
import { useTranslation } from 'react-i18next'

export default function Conta() {
  const { t } = useTranslation('conta')
  return <h1>{t('titulo')}</h1>
}
```

```ts
// conta/lib/i18n.ts
// As duas línguas entram no JS da zona, mesmo que a página use uma só.
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import ptBR from '../locales/pt-BR.json'
import en from '../locales/en.json'

i18n.use(initReactI18next).init({ lng: 'pt-BR', fallbackLng: 'en', resources: { 'pt-BR': { conta: ptBR }, en: { conta: en } } })
```

```js
// conta/next.config.js
module.exports = { basePath: '/conta', assetPrefix: '/conta-static' }
```

```js
// loja/next.config.js
module.exports = {
  async rewrites() {
    return [
      { source: '/conta/:path*', destination: `${process.env.CONTA_URL}/conta/:path*` },
      { source: '/conta-static/:path+', destination: `${process.env.CONTA_URL}/conta-static/:path+` },
    ]
  },
}
```

```ts
// loja/lib/i18n.ts
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import ptBR from '../locales/pt-BR.json'
import en from '../locales/en.json'

i18n.use(initReactI18next).init({ lng: 'pt-BR', fallbackLng: 'en', resources: { 'pt-BR': { loja: ptBR }, en: { loja: en } } })

export default i18n
```

```tsx
// loja/pages/_app.tsx
import '../lib/i18n'

export default function App({ Component, pageProps }) {
  return <Component {...pageProps} />
}
```

### Com vitral

```
loja/    app Next (o host), com o i18next
conta/   o mesmo código, buildado com Vite (o remote), sem i18next próprio
```

```json
// conta/locales/pt-BR.json (igual)
{ "titulo": "Minha conta" }
```

```tsx
// conta/pages/index.tsx (igual)
import { useTranslation } from 'react-i18next'

export default function Conta() {
  const { t } = useTranslation('conta')
  return <h1>{t('titulo')}</h1>
}
```

```ts
// conta/lib/i18n.ts (não precisa mais: a conta usa o i18next da loja)
```

```js
// conta/vite.config.js (no lugar do next.config.js)
import react from '@vitejs/plugin-react'
import vitral from 'vitral/vite'

export default {
  plugins: [
    react(),
    vitral({
      name: 'conta',
      entry: 'pages/index.tsx',
      next: { basePath: '/conta' },
      dedupe: ['react', 'i18next', 'react-i18next'],
      i18n: 'locales/{lng}.json',
    }),
  ],
}
```

```js
// loja/next.config.js (withVitral no lugar das rewrites)
const { withVitral } = require('vitral/next-config')

module.exports = withVitral({}, {
  remotes: { conta: { url: 'https://cdn.empresa.com/conta/vitral.json', basePath: '/conta' } },
  share: ['i18next', 'react-i18next'],
})
```

```ts
// loja/lib/i18n.ts (mais o configure)
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { configure } from 'vitral'
import { i18next } from 'vitral/i18n'
import ptBR from '../locales/pt-BR.json'
import en from '../locales/en.json'

i18n.use(initReactI18next).init({ lng: 'pt-BR', fallbackLng: 'en', resources: { 'pt-BR': { loja: ptBR }, en: { loja: en } } })
if (typeof window !== 'undefined') configure({ i18n: i18next(i18n) })

export default i18n
```

```tsx
// loja/pages/_app.tsx (mais o <VitralNext lang>)
import { VitralNext } from 'vitral/next-host'
import i18n from '../lib/i18n'

export default function App({ Component, pageProps }) {
  return <><VitralNext lang={i18n.language} /><Component {...pageProps} /></>
}
```

| | Hoje | Com vitral |
| --- | --- | --- |
| Traduções da conta | As duas línguas no JS da zona | Só a língua aberta, num arquivo à parte |
| i18next | Um por zona | Um só, o da loja |
| Trocar de língua | Cada app troca a sua | A loja troca, a conta baixa a língua nova, e as duas mudam juntas |
| Trocar de área | Recarrega a página | Sem recarregar |

## Opção do plugin

| Opção | Exemplo | O que faz |
| --- | --- | --- |
| `i18n` | `'src/locales/{lng}.json'`, `'src/locales/{lng}/{ns}.json'` | Onde estão as traduções. `{lng}` é obrigatório. Sem `{ns}`, o namespace é o `name` do remote |

Tire do código do remote o import estático das traduções: elas passam a vir do `vitral.json`. No `vite dev`, o remote serve os arquivos da pasta, sem hash.

## No host

- `configure({ i18n: i18next(i18n) })` liga as traduções. Sem ele, o remote monta sem baixá-las.
- O remote precisa usar o i18next do host: `dedupe: ['i18next', 'react-i18next']` no remote, e `share` no `withVitral` (ou `configure({ dedupe })` em outro host). Com uma cópia própria, o `useTranslation` do remote não veria as traduções.
- A língua do remote é a aberta, ou a base dela (`pt` para `pt-BR`), ou uma variante (`pt-PT` para `pt`), ou a primeira do `fallbackLng` que o remote tiver.
- `<VitralNext lang>` e `<NextRemote lang>` dizem ao HTML qual língua pré-carregar. O padrão é o `locale` do roteador do Next.
- O `i18n.changeLanguage(lng)` de sempre (no botão de língua, por exemplo) espera os arquivos da nova língua dos remotes abertos e só então troca. Se um arquivo não baixa, a troca acontece assim mesmo.
- Se uma tradução não baixa, o remote monta assim mesmo e avisa no console.

Outra biblioteca de i18n funciona com um objeto no lugar do `i18next(i18n)`. Para a troca esperar as traduções dos remotes, chame `languageReady` antes de trocar:

```ts
import { configure } from 'vitral'
import { languageReady } from 'vitral/i18n'

async function trocar(lng: string) {
  await languageReady(lng) // baixa a língua nova de cada remote aberto
  idioma.trocar(lng)
}

configure({
  i18n: {
    language: () => idioma.atual,
    add: (lng, ns, data) => idioma.adicionar(lng, ns, data),
    onChange: (fn) => idioma.aoTrocar(fn), // devolve a função que para de ouvir
    refresh: () => idioma.redesenhar(),
  },
})
```
