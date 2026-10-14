import { mount } from 'svelte'
import { configure } from 'vitral'
import { defineVitralElement } from 'vitral/element'
import App from './App.svelte'

configure({ remotes: '/remotes.json' })
defineVitralElement()
mount(App, { target: document.getElementById('app') })
