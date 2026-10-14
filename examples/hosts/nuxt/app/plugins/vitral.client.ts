// Só no cliente: configura os remotes uma vez.
import { configure } from 'vitral'

export default defineNuxtPlugin(() => {
  configure({ remotes: '/remotes.json' })
})
