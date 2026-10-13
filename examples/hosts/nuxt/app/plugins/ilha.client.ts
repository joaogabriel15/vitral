// Só no cliente: configura os remotes uma vez.
import { configure } from 'ilha'

export default defineNuxtPlugin(() => {
  configure({ remotes: '/remotes.json' })
})
