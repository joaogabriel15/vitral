import { reactRender } from 'vitral/react-server'
import Contador from './remote.jsx'

// SSR do remote para o host Next (`remoteProps` com `ssr`). O estado vai com o
// HTML e o navegador começa dele, sem buscar de novo.
export const render = reactRender(Contador, { state: async () => ({ inicio: 5 }) })
