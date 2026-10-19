// Entrada exposta pelo remote Vue no Module Federation: `mount` no mesmo
// formato do vitral, para o host montar sem saber o framework.
import { createApp, h } from 'vue'
import Cartao from './Cartao.vue'

export function mount(el, props) {
  const app = createApp({ render: () => h(Cartao, props) })
  app.mount(el)
  return { unmount: () => app.unmount() }
}
