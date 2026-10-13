import { mount } from 'svelte'
import { configure } from 'arquipelago'
import { defineIlhaElement } from 'arquipelago/element'
import App from './App.svelte'

configure({ remotes: '/remotes.json' })
defineIlhaElement()
mount(App, { target: document.getElementById('app') })
