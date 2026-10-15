import { defineConfig } from 'vite'

import vitral from 'vitral/vite'

// Um remote com várias partes: o default (a loja), um componente pequeno e um
// módulo sem UI. Tudo num arquivo só, com um hash SRI.
export default defineConfig({
  base: './',
  plugins: [
    vitral({
      entry: 'src/remote.ts',
      name: 'loja',
      exposes: { './MiniCarrinho': 'src/mini-carrinho.ts', './api': 'src/api.ts' },
    }),
  ],
})
