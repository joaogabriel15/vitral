import { withVitral } from 'vitral/next-config'

// Host Next com Pages Router no lugar das zonas. O remote fica em public/ns-remote
// (copiado no prebuild): o build lê o vitral.json para o preload no HTML.
// transpilePackages: o `render` do SSR vem do código do remote (JSX).
export default withVitral({ transpilePackages: ['remote-react-ns'] }, {
  remotes: {
    ns: { url: '/ns-remote/vitral.json', basePath: '/ns', preload: 'route' },
    // O mesmo remote, com o manifesto lido no servidor a cada requisição (vitral/next-server).
    'ns-servidor': { url: '/ns-remote/vitral.json', basePath: '/ns-servidor', preload: 'route' },
    // E com SSR: o servidor renderiza o remote dentro do NextRemote.
    'ns-ssr': { url: '/ns-remote/vitral.json', basePath: '/ns-ssr', preload: 'route' },
    // E com a tela de erro do host (falha de rede e "tentar de novo").
    'ns-erro': { url: '/ns-remote/vitral.json', basePath: '/ns-erro', preload: 'route' },
    // E com a página que só desenha o remote depois do login.
    'ns-login': { url: '/ns-remote/vitral.json', basePath: '/ns-login', preload: 'route' },
  },
})
