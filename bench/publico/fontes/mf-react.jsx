// Entrada exposta pelo remote React no Module Federation: `mount` no mesmo
// formato do vitral, para o host montar sem saber o framework.
import { createRoot } from 'react-dom/client'
import Cartao from './Cartao.jsx'

export function mount(el, props) {
  const root = createRoot(el)
  root.render(<Cartao {...props} />)
  return { unmount: () => root.unmount() }
}
