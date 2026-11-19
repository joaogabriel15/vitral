# Translations (i18n)

Each remote brings its own translations, and the page downloads only the open language. The host doesn't import the translations of the other areas, and no remote downloads languages nobody is using.

- The plugin writes one hashed file per language (and per namespace), listed in `vitral.json`.
- The remote downloads the open language together with the JS, and the translations go into the host's i18next before mounting.
- In the Next host, the HTML already preloads the open language's translation, as it does with the remote's JS.
- On a language switch, the remotes already loaded download the new language first. The screen stays in the previous language until the files arrive and then switches everything together, host and remotes, without showing the keys.
- SRI checks each file, as it checks the JS.

## Today and with vitral

Example: a Next.js shop with the "My account" area, built by another team, in Portuguese and English. Both sides have the same files, in the same order.

### Today, with Multi-Zones

```
shop/      main Next app
account/   second Next app (the zone), with its own i18next
```

```json
// account/locales/en.json (pt-BR.json is the same, in Portuguese)
{ "title": "My account" }
```

```tsx
// account/pages/index.tsx
import { useTranslation } from 'react-i18next'

export default function Account() {
  const { t } = useTranslation('account')
  return <h1>{t('title')}</h1>
}
```

```ts
// account/lib/i18n.ts
// Both languages go into the zone's JS, even if the page uses only one.
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from '../locales/en.json'
import ptBR from '../locales/pt-BR.json'

i18n.use(initReactI18next).init({ lng: 'en', fallbackLng: 'en', resources: { en: { account: en }, 'pt-BR': { account: ptBR } } })
```

```js
// account/next.config.js
module.exports = { basePath: '/account', assetPrefix: '/account-static' }
```

```js
// shop/next.config.js
module.exports = {
  async rewrites() {
    return [
      { source: '/account/:path*', destination: `${process.env.ACCOUNT_URL}/account/:path*` },
      { source: '/account-static/:path+', destination: `${process.env.ACCOUNT_URL}/account-static/:path+` },
    ]
  },
}
```

```ts
// shop/lib/i18n.ts
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from '../locales/en.json'
import ptBR from '../locales/pt-BR.json'

i18n.use(initReactI18next).init({ lng: 'en', fallbackLng: 'en', resources: { en: { shop: en }, 'pt-BR': { shop: ptBR } } })

export default i18n
```

```tsx
// shop/pages/_app.tsx
import '../lib/i18n'

export default function App({ Component, pageProps }) {
  return <Component {...pageProps} />
}
```

### With vitral

```
shop/      Next app (the host), with i18next
account/   the same code, built with Vite (the remote), with no i18next of its own
```

```json
// account/locales/en.json (same)
{ "title": "My account" }
```

```tsx
// account/pages/index.tsx (same)
import { useTranslation } from 'react-i18next'

export default function Account() {
  const { t } = useTranslation('account')
  return <h1>{t('title')}</h1>
}
```

```ts
// account/lib/i18n.ts (not needed anymore: the account uses the shop's i18next)
```

```js
// account/vite.config.js (instead of next.config.js)
import react from '@vitejs/plugin-react'
import vitral from 'vitral/vite'

export default {
  plugins: [
    react(),
    vitral({
      name: 'account',
      entry: 'pages/index.tsx',
      next: { basePath: '/account' },
      dedupe: ['react', 'i18next', 'react-i18next'],
      i18n: 'locales/{lng}.json',
    }),
  ],
}
```

```js
// shop/next.config.js (withVitral instead of the rewrites)
const { withVitral } = require('vitral/next-config')

module.exports = withVitral({}, {
  remotes: { account: { url: 'https://cdn.example.com/account/vitral.json', basePath: '/account' } },
  share: ['i18next', 'react-i18next'],
})
```

```ts
// shop/lib/i18n.ts (plus configure)
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { configure } from 'vitral'
import { i18next } from 'vitral/i18n'
import en from '../locales/en.json'
import ptBR from '../locales/pt-BR.json'

i18n.use(initReactI18next).init({ lng: 'en', fallbackLng: 'en', resources: { en: { shop: en }, 'pt-BR': { shop: ptBR } } })
if (typeof window !== 'undefined') configure({ i18n: i18next(i18n) })

export default i18n
```

```tsx
// shop/pages/_app.tsx (plus <VitralNext lang>)
import { VitralNext } from 'vitral/next-host'
import i18n from '../lib/i18n'

export default function App({ Component, pageProps }) {
  return <><VitralNext lang={i18n.language} /><Component {...pageProps} /></>
}
```

| | Today | With vitral |
| --- | --- | --- |
| Account translations | Both languages in the zone's JS | Only the open language, in a separate file |
| i18next | One per zone | Just one, the shop's |
| Switching language | Each app switches its own | The shop switches, the account downloads the new language, and both change together |
| Switching areas | Full page reload | No reload |

## Plugin option

| Option | Example | What it does |
| --- | --- | --- |
| `i18n` | `'src/locales/{lng}.json'`, `'src/locales/{lng}/{ns}.json'` | Where the translations are. `{lng}` is required. Without `{ns}`, the namespace is the remote's `name` |

Remove the static import of the translations from the remote's code: they now come from `vitral.json`. In `vite dev`, the remote serves the folder's files, without a hash.

## In the host

- `configure({ i18n: i18next(i18n) })` turns translations on. Without it, the remote mounts without downloading them.
- The remote must use the host's i18next: `dedupe: ['i18next', 'react-i18next']` in the remote, and `share` in `withVitral` (or `configure({ dedupe })` in another host). With its own copy, the remote's `useTranslation` wouldn't see the translations.
- The remote's language is the open one, or its base (`pt` for `pt-BR`), or a variant (`pt-PT` for `pt`), or the first in `fallbackLng` the remote has.
- `<VitralNext lang>` and `<NextRemote lang>` tell the HTML which language to preload. The default is the Next router's `locale`.
- The usual `i18n.changeLanguage(lng)` (in the language button, for example) waits for the new language files of the open remotes and only then switches. If a file doesn't download, the switch happens anyway.
- If a translation doesn't download, the remote mounts anyway and warns in the console.

Another i18n library works with an object instead of `i18next(i18n)`. For the switch to wait for the remotes' translations, call `languageReady` before switching:

```ts
import { configure } from 'vitral'
import { languageReady } from 'vitral/i18n'

async function switchTo(lng: string) {
  await languageReady(lng) // downloads the new language of each open remote
  lang.switch(lng)
}

configure({
  i18n: {
    language: () => lang.current,
    add: (lng, ns, data) => lang.add(lng, ns, data),
    onChange: (fn) => lang.onSwitch(fn), // returns the function that stops listening
    refresh: () => lang.redraw(),
  },
})
```
