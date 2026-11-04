// `import * as React` com o namespace usado como valor: o build mantém todos os nomes.
import * as React from 'react'
import { createRoot } from 'react-dom/client'

export default {
  ns: React,
  mount(el) {
    const root = createRoot(el)
    root.render(React.createElement('p', null, 'loja'))
    return { unmount: () => root.unmount() }
  },
}
