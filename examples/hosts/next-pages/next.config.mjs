import { withVitral } from 'vitral/next-config'

// Host Next com Pages Router no lugar das zonas. O remote fica em public/ns-remote
// (copiado no prebuild): o build lê o vitral.json para o preload no HTML.
export default withVitral({}, {
  remotes: {
    ns: { url: '/ns-remote/vitral.json', basePath: '/ns' },
  },
})
