import { mount } from 'svelte'
import { configure } from 'ilha'
import { defineIlhaElement } from 'ilha/element'
import App from './App.svelte'

configure({ remotes: '/remotes.json' })
defineIlhaElement()
mount(App, { target: document.getElementById('app') })
