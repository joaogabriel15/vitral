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
  head: [['link', { rel: 'icon', type: 'image/svg+xml', href: `${BASE}logo.svg` }]],

  themeConfig: {
    logo: '/logo.svg',
    nav: [
      { text: 'Começo rápido', link: '/comecar' },
      { text: 'Frameworks', link: '/frameworks/react' },
      { text: 'Funcionalidades', link: '/funcionalidades/props-eventos' },
      { text: 'Migração', link: '/migracao/module-federation' },
      { text: 'Erros', link: '/erros/' },
      { text: 'API', link: '/api/' },
      { text: 'npm', link: 'https://www.npmjs.com/package/vitral' },
    ],
    sidebar: {
      '/api/': [{ text: 'Referência da API', link: '/api/' }, ...api],
      '/': [
        { text: 'Começo rápido', link: '/comecar' },
        {
          text: 'Frameworks',
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
          text: 'Funcionalidades',
          items: [
            { text: 'Props e eventos', link: '/funcionalidades/props-eventos' },
            { text: 'Contexto compartilhado', link: '/funcionalidades/contexto' },
            { text: 'Estilos, Tailwind e tema', link: '/funcionalidades/estilos' },
            { text: 'Lazy, prefetch e keep-alive', link: '/funcionalidades/carregamento' },
            { text: 'Dedupe de dependências', link: '/funcionalidades/dedupe' },
            { text: 'SRI e origens', link: '/funcionalidades/seguranca' },
            { text: 'Rotas', link: '/funcionalidades/rotas' },
            { text: 'Iframe', link: '/funcionalidades/iframe' },
            { text: 'Exposes e loadModule', link: '/funcionalidades/exposes' },
            { text: 'Atualização sem reload', link: '/funcionalidades/atualizacoes' },
            { text: 'SSR', link: '/funcionalidades/ssr' },
            { text: 'Desenvolvimento e HMR', link: '/funcionalidades/desenvolvimento' },
            { text: 'Tratamento de erros', link: '/funcionalidades/erros' },
            { text: 'Testes', link: '/funcionalidades/testes' },
            { text: 'Configuração', link: '/funcionalidades/configuracao' },
          ],
        },
        {
          text: 'Migração',
          items: [
            { text: 'Module Federation', link: '/migracao/module-federation' },
            { text: 'single-spa', link: '/migracao/single-spa' },
            { text: 'qiankun', link: '/migracao/qiankun' },
          ],
        },
        {
          text: 'Erros',
          collapsed: true,
          items: [{ text: 'Todos os códigos', link: '/erros/' }, ...erros.map((code) => ({ text: code, link: `/erros/${code}` }))],
        },
        { text: 'Referência da API', link: '/api/' },
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
    footer: { message: 'Licença MIT', copyright: 'Feito de partes. Visto como um todo.' },
    outline: { label: 'Nesta página' },
    docFooter: { prev: 'Anterior', next: 'Próxima' },
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
