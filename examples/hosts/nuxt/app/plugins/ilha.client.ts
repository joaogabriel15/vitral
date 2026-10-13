// Só no cliente: configura os remotes uma vez.
import { configure } from 'arquipelago'

export default defineNuxtPlugin(() => {
  configure({ remotes: '/remotes.json' })
})
