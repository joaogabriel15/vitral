// `render` do remote no gateway: o mesmo Cartao, em HTML, para o SSR da rota.
import { reactRender } from 'vitral/react-server'
import Cartao from '../../Cartao.jsx'

export const render = reactRender(Cartao)
