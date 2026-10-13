import { createApp } from 'vue'
import { configure } from 'ilha'
import App from './App.vue'

configure({ remotes: '/remotes.json' })
createApp(App).mount('#app')
