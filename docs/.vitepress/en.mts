import type { DefaultTheme, LocaleSpecificConfig } from 'vitepress'
import { BASE, REPO } from './site.mjs'

// English version of the site, served under /en/. The pages live in docs/en/
// with the same file names as the Portuguese ones, so the language switch
// opens the same page in the other language.

export const DESCRIPTION_EN = 'Micro-frontends from any framework on one page, with no build config on the host.'

const learn: DefaultTheme.SidebarItem[] = [
  {
    text: 'Start',
    items: [
      { text: 'Why vitral', link: '/en/por-que' },
      { text: 'Set up host and remote', link: '/en/aprender/configurar' },
      { text: 'Quick start', link: '/en/aprender/' },
      { text: 'Installation', link: '/en/aprender/instalacao' },
      { text: 'Your first remote', link: '/en/aprender/primeiro-remote' },
      { text: 'Your first host', link: '/en/aprender/primeiro-host' },
    ],
  },
  {
    text: 'Use',
    items: [
      { text: 'Props and events', link: '/en/aprender/props-eventos' },
      { text: 'Shared context', link: '/en/aprender/contexto' },
      { text: 'Styles', link: '/en/aprender/estilos' },
      { text: 'Loading', link: '/en/aprender/carregamento' },
      { text: 'Errors', link: '/en/aprender/erros' },
      { text: 'Testing', link: '/en/aprender/testes' },
      { text: 'Contracts between host and remote', link: '/en/aprender/contratos' },
      { text: 'Deploy', link: '/en/aprender/deploy' },
      { text: 'Local and Docker', link: '/en/aprender/local-e-docker' },
      { text: 'Multiple repositories', link: '/en/aprender/varios-repositorios' },
      { text: 'Registry and agents', link: '/en/aprender/registro' },
    ],
  },
  {
    text: 'More features',
    collapsed: true,
    items: [
      { text: 'SRI and origins', link: '/en/aprender/seguranca' },
      { text: 'Routes', link: '/en/aprender/rotas' },
      { text: 'Iframe', link: '/en/aprender/iframe' },
      { text: 'Reframe', link: '/en/aprender/reframe' },
      { text: 'MCP App', link: '/en/aprender/mcp-app' },
      { text: 'Widget on third-party sites', link: '/en/aprender/terceiros' },
      { text: 'Exposes and loadModule', link: '/en/aprender/exposes' },
      { text: 'Dependency dedupe', link: '/en/aprender/dedupe' },
      { text: 'Translations (i18n)', link: '/en/aprender/traducoes' },
      { text: 'Updates without reload', link: '/en/aprender/atualizacoes' },
      { text: 'Canary and rollback', link: '/en/aprender/canary' },
      { text: 'Compression dictionaries', link: '/en/aprender/dicionarios' },
      { text: 'SSR', link: '/en/aprender/ssr' },
      { text: 'Development and HMR', link: '/en/aprender/desenvolvimento' },
      { text: 'Benchmark vs MF and Multi-Zones', link: '/en/aprender/benchmark' },
    ],
  },
  {
    text: 'Frameworks',
    collapsed: true,
    items: [
      { text: 'React', link: '/en/frameworks/react' },
      { text: 'Next.js', link: '/en/frameworks/next' },
      { text: 'Vue', link: '/en/frameworks/vue' },
      { text: 'Nuxt', link: '/en/frameworks/nuxt' },
      { text: 'Angular', link: '/en/frameworks/angular' },
      { text: 'Svelte', link: '/en/frameworks/svelte' },
      { text: 'Solid', link: '/en/frameworks/solid' },
      { text: 'Preact', link: '/en/frameworks/preact' },
      { text: 'Lit and Web Components', link: '/en/frameworks/lit' },
      { text: 'Plain JS and TS', link: '/en/frameworks/javascript' },
    ],
  },
  {
    text: 'Migration',
    collapsed: true,
    items: [
      { text: 'Module Federation', link: '/en/migracao/module-federation' },
      { text: 'single-spa', link: '/en/migracao/single-spa' },
      { text: 'qiankun', link: '/en/migracao/qiankun' },
      { text: 'Next.js Multi-Zones', link: '/en/migracao/multi-zones' },
    ],
  },
]

const reference: DefaultTheme.SidebarItem[] = [
  { text: 'Overview', link: '/en/referencia/' },
  {
    text: 'vitral',
    items: [
      ['configure', 'configure'],
      ['register', 'register'],
      ['defineRemote', 'define-remote'],
      ['mountRemote', 'mount-remote'],
      ['createSlot', 'create-slot'],
      ['loadModule', 'load-module'],
      ['events', 'events'],
      ['navigate', 'navigate'],
      ['provide', 'provide'],
      ['shared', 'shared'],
      ['persist', 'persist'],
      ['component', 'component'],
      ['watchUpdates', 'updates'],
      ['RemoteError', 'remote-error'],
    ].map(([text, p]) => ({ text, link: `/en/referencia/vitral/${p}` })),
  },
  {
    text: 'vitral/react',
    items: [
      { text: '<Remote>', link: '/en/referencia/react/remote' },
      { text: 'reactRemote', link: '/en/referencia/react/react-remote' },
      { text: 'Hooks', link: '/en/referencia/react/hooks' },
    ],
  },
  {
    text: 'Other frameworks',
    items: ['vue', 'angular', 'svelte', 'solid', 'preact', 'element'].map((p) => ({ text: `vitral/${p}`, link: `/en/referencia/${p}` })),
  },
  {
    text: 'Tools',
    items: [
      ...['vite', 'routes', 'prefetch', 'iframe', 'testing', 'devtools', 'single-spa', 'federation', 'edge'].map((p) => ({ text: `vitral/${p}`, link: `/en/referencia/${p}` })),
      { text: 'vitral/sentry and vitral/otel', link: '/en/referencia/monitoramento' },
      { text: 'vitral/vitals', link: '/en/referencia/vitals' },
      { text: 'CLI', link: '/en/referencia/cli' },
    ],
  },
  { text: 'TypeDoc (all types, Portuguese)', link: '/api/' },
]

export function en(erros: string[]): LocaleSpecificConfig<DefaultTheme.Config> & { label: string; link: string } {
  return {
    label: 'English',
    lang: 'en-US',
    link: '/en/',
    description: DESCRIPTION_EN,
    themeConfig: {
      nav: [
        { text: 'Why', link: '/en/por-que' },
        { text: 'Learn', link: '/en/aprender/configurar', activeMatch: '^/en/(aprender|frameworks|migracao)/' },
        { text: 'Reference', link: '/en/referencia/', activeMatch: '^/en/referencia/' },
        { text: 'Errors', link: '/en/erros/', activeMatch: '^/en/erros/' },
        { text: 'Benchmark', link: '/en/aprender/benchmark' },
        { text: 'npm', link: 'https://www.npmjs.com/package/vitral' },
      ],
      sidebar: {
        '/en/aprender/': learn,
        '/en/frameworks/': learn,
        '/en/migracao/': learn,
        '/en/por-que': learn,
        '/en/referencia/': reference,
        '/en/erros/': [
          {
            text: 'Errors',
            items: [{ text: 'All codes', link: '/en/erros/' }, ...erros.map((code) => ({ text: code, link: `/en/erros/${code}` }))],
          },
        ],
      },
      editLink: { pattern: `${REPO}/edit/main/docs/:path`, text: 'Edit this page on GitHub' },
      footer: {
        message: `MIT License · <a href="${BASE}en/marca">Brand</a> · Made by <a href="https://pacheco.dev.br/">Pacheco Codes</a>`,
        copyright: 'Made of parts. Seen as a whole.',
      },
      outline: { label: 'On this page' },
      docFooter: { prev: 'Previous', next: 'Next' },
      darkModeSwitchLabel: 'Theme',
      lightModeSwitchTitle: 'Switch to light theme',
      darkModeSwitchTitle: 'Switch to dark theme',
      sidebarMenuLabel: 'Menu',
      returnToTopLabel: 'Back to top',
      langMenuLabel: 'Language',
      notFound: {
        title: 'Page not found',
        quote: 'This address does not exist or has moved.',
        linkText: 'Go to the home page',
        link: '/en/',
      },
    },
  }
}
