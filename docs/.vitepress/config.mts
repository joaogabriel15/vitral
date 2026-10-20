import { readdirSync, readFileSync } from 'node:fs'
import { defineConfig, type DefaultTheme } from 'vitepress'
import { BASE, REPO, SITE } from './site.mjs'

// Uma página por código de erro, na ordem alfabética. Código novo em
// docs/erros/ entra no menu sem mexer aqui.
const erros = readdirSync(new URL('../erros', import.meta.url))
  .filter((f) => /^[A-Z_]+\.md$/.test(f) && f !== 'README.md')
  .map((f) => f.slice(0, -3))
  .sort()

// Menu da referência, gerado pelo TypeDoc em docs/api (pnpm --dir docs api).
let api: DefaultTheme.SidebarItem[] = []
try {
  api = JSON.parse(readFileSync(new URL('../api/typedoc-sidebar.json', import.meta.url), 'utf8'))
} catch {}

const aprender: DefaultTheme.SidebarItem[] = [
  {
    text: 'Começar',
    items: [
      { text: 'Por que o vitral', link: '/por-que' },
      { text: 'Configurar host e remote', link: '/aprender/configurar' },
      { text: 'Início rápido', link: '/aprender/' },
      { text: 'Instalação', link: '/aprender/instalacao' },
      { text: 'Seu primeiro remote', link: '/aprender/primeiro-remote' },
      { text: 'Seu primeiro host', link: '/aprender/primeiro-host' },
    ],
  },
  {
    text: 'Usar',
    items: [
      { text: 'Props e eventos', link: '/aprender/props-eventos' },
      { text: 'Contexto compartilhado', link: '/aprender/contexto' },
      { text: 'Estilos', link: '/aprender/estilos' },
      { text: 'Carregamento', link: '/aprender/carregamento' },
      { text: 'Erros', link: '/aprender/erros' },
      { text: 'Testes', link: '/aprender/testes' },
      { text: 'Contratos entre host e remote', link: '/aprender/contratos' },
      { text: 'Deploy', link: '/aprender/deploy' },
      { text: 'Local e Docker', link: '/aprender/local-e-docker' },
      { text: 'Vários repositórios', link: '/aprender/varios-repositorios' },
      { text: 'Registro e agentes', link: '/aprender/registro' },
    ],
  },
  {
    text: 'Mais recursos',
    collapsed: true,
    items: [
      { text: 'SRI e origens', link: '/aprender/seguranca' },
      { text: 'Rotas', link: '/aprender/rotas' },
      { text: 'Iframe', link: '/aprender/iframe' },
      { text: 'Reframe', link: '/aprender/reframe' },
      { text: 'MCP App', link: '/aprender/mcp-app' },
      { text: 'Widget em site de terceiros', link: '/aprender/terceiros' },
      { text: 'Exposes e loadModule', link: '/aprender/exposes' },
      { text: 'Dedupe de dependências', link: '/aprender/dedupe' },
      { text: 'Atualização sem reload', link: '/aprender/atualizacoes' },
      { text: 'Canary e rollback', link: '/aprender/canary' },
      { text: 'Dicionários de compressão', link: '/aprender/dicionarios' },
      { text: 'SSR', link: '/aprender/ssr' },
      { text: 'Desenvolvimento e HMR', link: '/aprender/desenvolvimento' },
      { text: 'Benchmark contra MF e Multi-Zones', link: '/aprender/benchmark' },
    ],
  },
  {
    text: 'Frameworks',
    collapsed: true,
    items: [
      { text: 'React', link: '/frameworks/react' },
      { text: 'Next.js', link: '/frameworks/next' },
      { text: 'Vue', link: '/frameworks/vue' },
      { text: 'Nuxt', link: '/frameworks/nuxt' },
      { text: 'Angular', link: '/frameworks/angular' },
      { text: 'Svelte', link: '/frameworks/svelte' },
      { text: 'Solid', link: '/frameworks/solid' },
      { text: 'Preact', link: '/frameworks/preact' },
      { text: 'Lit e Web Components', link: '/frameworks/lit' },
      { text: 'JS e TS puro', link: '/frameworks/javascript' },
    ],
  },
  {
    text: 'Migração',
    collapsed: true,
    items: [
      { text: 'Module Federation', link: '/migracao/module-federation' },
      { text: 'single-spa', link: '/migracao/single-spa' },
      { text: 'qiankun', link: '/migracao/qiankun' },
      { text: 'Next.js Multi-Zones', link: '/migracao/multi-zones' },
    ],
  },
]

const referencia: DefaultTheme.SidebarItem[] = [
  { text: 'Visão geral', link: '/referencia/' },
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
    ].map(([text, p]) => ({ text, link: `/referencia/vitral/${p}` })),
  },
  {
    text: 'vitral/react',
    items: [
      { text: '<Remote>', link: '/referencia/react/remote' },
      { text: 'reactRemote', link: '/referencia/react/react-remote' },
      { text: 'Hooks', link: '/referencia/react/hooks' },
    ],
  },
  {
    text: 'Outros frameworks',
    items: ['vue', 'angular', 'svelte', 'solid', 'preact', 'element'].map((p) => ({ text: `vitral/${p}`, link: `/referencia/${p}` })),
  },
  {
    text: 'Ferramentas',
    items: [
      ...['vite', 'routes', 'prefetch', 'iframe', 'testing', 'devtools', 'single-spa', 'federation', 'edge'].map((p) => ({ text: `vitral/${p}`, link: `/referencia/${p}` })),
      { text: 'vitral/sentry e vitral/otel', link: '/referencia/monitoramento' },
      { text: 'vitral/vitals', link: '/referencia/vitals' },
      { text: 'CLI', link: '/referencia/cli' },
    ],
  },
  { text: 'TypeDoc (todos os tipos)', link: '/api/' },
]

export default defineConfig({
  lang: 'pt-BR',
  title: 'vitral',
  description: 'Micro-frontends de qualquer framework numa página só, sem configuração de build no host.',
  base: BASE,
  cleanUrls: true,
  // docs/erros/README.md aparece no GitHub ao abrir a pasta; no site vira /erros/.
  rewrites: { 'erros/README.md': 'erros/index.md' },
  srcExclude: ['**/node_modules/**'],
  sitemap: { hostname: SITE },
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: `${BASE}logo.svg` }],
    ['meta', { name: 'theme-color', content: '#161b26' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: 'vitral' }],
    ['meta', { property: 'og:locale', content: 'pt_BR' }],
    ['meta', { property: 'og:image', content: `${SITE}marca/og.png` }],
    ['meta', { property: 'og:image:width', content: '1200' }],
    ['meta', { property: 'og:image:height', content: '630' }],
    ['meta', { property: 'og:image:alt', content: 'vitral. Micro-frontends de qualquer framework numa página só.' }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:image', content: `${SITE}marca/og.png` }],
  ],

  // Título e descrição da página em cada link compartilhado.
  transformPageData(page) {
    const title = page.frontmatter.title ?? page.title
    const description = page.frontmatter.description ?? page.description
    page.frontmatter.head ??= []
    page.frontmatter.head.push(
      ['meta', { property: 'og:title', content: title ? `${title} | vitral` : 'vitral' }],
      ['meta', { property: 'og:description', content: description || 'Micro-frontends de qualquer framework numa página só, sem configuração de build no host.' }],
      ['meta', { property: 'og:url', content: SITE + page.relativePath.replace(/(^|\/)index\.md$/, '$1').replace(/\.md$/, '') }],
    )
  },

  markdown: {
    container: { tipLabel: 'Nota', warningLabel: 'Atenção', dangerLabel: 'Perigo', infoLabel: 'Info', detailsLabel: 'Detalhes' },
  },

  themeConfig: {
    logo: '/logo.svg',
    nav: [
      { text: 'Por que', link: '/por-que' },
      { text: 'Aprender', link: '/aprender/configurar', activeMatch: '^/(aprender|frameworks|migracao)/' },
      { text: 'Referência', link: '/referencia/', activeMatch: '^/(referencia|api)/' },
      { text: 'Erros', link: '/erros/', activeMatch: '^/erros/' },
      { text: 'Benchmark', link: '/aprender/benchmark' },
      { text: 'npm', link: 'https://www.npmjs.com/package/vitral' },
    ],
    sidebar: {
      '/aprender/': aprender,
      '/frameworks/': aprender,
      '/migracao/': aprender,
      '/por-que': aprender,
      '/referencia/': referencia,
      '/api/': [{ text: 'Referência', link: '/referencia/' }, { text: 'TypeDoc', link: '/api/' }, ...api],
      '/erros/': [
        {
          text: 'Erros',
          items: [{ text: 'Todos os códigos', link: '/erros/' }, ...erros.map((code) => ({ text: code, link: `/erros/${code}` }))],
        },
      ],
    },
    socialLinks: [{ icon: 'github', link: REPO }],
    editLink: { pattern: `${REPO}/edit/main/docs/:path`, text: 'Editar esta página no GitHub' },
    search: {
      provider: 'local',
      options: {
        translations: {
          button: { buttonText: 'Buscar', buttonAriaLabel: 'Buscar' },
          modal: {
            noResultsText: 'Nada encontrado para',
            resetButtonTitle: 'Limpar',
            displayDetails: 'Mostrar detalhes',
            footer: { selectText: 'abrir', navigateText: 'navegar', closeText: 'fechar' },
          },
        },
      },
    },
    footer: { message: `Licença MIT · <a href="${BASE}marca">Marca</a> · Feito por <a href="https://pacheco.dev.br/">Pacheco Codes</a>`, copyright: 'Feito de partes. Visto como um todo.' },
    outline: { label: 'Nesta página' },
    docFooter: { prev: 'Anterior', next: 'Próximo' },
    darkModeSwitchLabel: 'Tema',
    lightModeSwitchTitle: 'Usar tema claro',
    darkModeSwitchTitle: 'Usar tema escuro',
    sidebarMenuLabel: 'Menu',
    returnToTopLabel: 'Voltar ao topo',
    langMenuLabel: 'Idioma',
    externalLinkIcon: true,
    notFound: {
      title: 'Página não encontrada',
      quote: 'O endereço não existe ou mudou de lugar.',
      linkText: 'Ir para o início',
    },
  },
})
