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
      { text: 'Guia', link: '/guia/' },
      { text: 'Receitas', link: '/receitas/tailwind' },
      { text: 'Migração', link: '/migracao/module-federation' },
      { text: 'Erros', link: '/erros/' },
      { text: 'API', link: '/api/' },
      { text: 'npm', link: 'https://www.npmjs.com/package/vitral' },
    ],
    sidebar: {
      '/api/': [{ text: 'Referência da API', link: '/api/' }, ...api],
      '/': [
        {
          text: 'Guia',
          items: [
            { text: 'Começo rápido', link: '/guia/' },
            { text: 'Conectar repositórios', link: '/guia/repositorios' },
            { text: 'Rotas entre aplicações', link: '/receitas/rotas' },
            { text: 'Login e usuário', link: '/receitas/autenticacao' },
            { text: 'Publicar', link: '/guia/publicacao' },
          ],
        },
        {
          text: 'Uso e referência',
          collapsed: true,
          items: [
            { text: 'Host', link: '/guia/host' },
            { text: 'Remote', link: '/guia/remote' },
            { text: 'Comunicação e contexto', link: '/guia/contexto' },
            { text: 'Estilos', link: '/guia/estilos' },
            { text: 'Performance', link: '/guia/performance' },
            { text: 'Segurança', link: '/guia/seguranca' },
            { text: 'Testes', link: '/guia/testes' },
            { text: 'Configuração', link: '/guia/configuracao' },
          ],
        },
        {
          text: 'Receitas',
          items: [
            { text: 'Tailwind', link: '/receitas/tailwind' },
            { text: 'Autenticação', link: '/receitas/autenticacao' },
            { text: 'Idioma (i18n)', link: '/receitas/i18n' },
            { text: 'Rotas', link: '/receitas/rotas' },
            { text: 'Design system', link: '/receitas/design-system' },
          ],
        },
        {
          text: 'Migração',
          items: [
            { text: 'Module Federation', link: '/migracao/module-federation' },
            { text: 'single-spa', link: '/migracao/single-spa' },
            { text: 'qiankun', link: '/migracao/qiankun' },
            { text: 'Quando não usar o vitral', link: '/quando-nao-usar' },
          ],
        },
        {
          text: 'Erros',
          collapsed: true,
          items: [{ text: 'Todos os códigos', link: '/erros/' }, ...erros.map((code) => ({ text: code, link: `/erros/${code}` }))],
        },
        {
          text: 'Projeto',
          items: [
            { text: 'Comparação', link: '/comparacao' },
            { text: 'Benchmarks', link: '/benchmarks' },
            { text: 'Problemas resolvidos', link: '/PROBLEMAS' },
            { text: 'Referência da API', link: '/api/' },
          ],
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
