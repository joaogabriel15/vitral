import { createApp } from 'vue'
import { configure } from 'vitral'
import App from './App.vue'

configure({ remotes: '/remotes.json' })
createApp(App).mount('#app')
