// Página da bateria de vazamento: cada adaptador sabe montar e desmontar um
// remote. run.mjs chama window.ciclar(adaptador, n) e mede a memória pelo CDP.
import { configure, createSlot } from 'vitral'
import { defineVitralElement } from 'vitral/element'
import { Remote as PreactRemote } from 'vitral/preact'
import { Remote as ReactRemote } from 'vitral/react'
import { Remote as SolidRemote } from 'vitral/solid'
import { remote as svelteRemote } from 'vitral/svelte'
import { VitralRemote } from 'vitral/vue'
import { h as ph, render as preactRender } from 'preact'
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { createComponent } from 'solid-js'
import { render as solidRender } from 'solid-js/web'
import { createApp, h as vh } from 'vue'

defineVitralElement()
window.vitral = { configure }

const area = document.querySelector('#area')

/** Espera até `cond()` ser verdade (o remote apareceu ou sumiu). */
const ate = (cond) =>
  new Promise((resolve, reject) => {
    const t0 = performance.now()
    const tick = () => {
      if (cond()) return resolve()
      if (performance.now() - t0 > 10_000) return reject(new Error(`não ficou pronto: ${area.innerHTML.slice(0, 200)}`))
      requestAnimationFrame(tick)
    }
    tick()
  })

const pronto = (el) => () => !!el.querySelector('[data-vitral-root]')?.firstElementChild || !!el.querySelector('[data-vitral-slot] > div')?.shadowRoot?.querySelector('[data-vitral-root] > *')

// Adaptadores de host: montam o remote "cartao" e desmontam o componente do host.
const HOSTS = {
  slot(el) {
    const slot = createSlot(el, { name: 'cartao', props: { texto: 'oi' } })
    return () => slot.destroy()
  },
  element(el) {
    const node = el.appendChild(document.createElement('vitral-remote'))
    node.setAttribute('name', 'cartao')
    return () => node.remove()
  },
  react(el) {
    const root = createRoot(el)
    root.render(createElement(ReactRemote, { name: 'cartao', props: { texto: 'oi' } }))
    return () => root.unmount()
  },
  vue(el) {
    const app = createApp({ render: () => vh(VitralRemote, { name: 'cartao', props: { texto: 'oi' } }) })
    app.mount(el)
    return () => app.unmount()
  },
  preact(el) {
    preactRender(ph(PreactRemote, { name: 'cartao', props: { texto: 'oi' } }), el)
    return () => preactRender(null, el)
  },
  solid(el) {
    return solidRender(() => createComponent(SolidRemote, { name: 'cartao', props: { texto: 'oi' } }), el)
  },
  svelte(el) {
    const action = svelteRemote(el, { name: 'cartao', props: { texto: 'oi' } })
    return () => action.destroy()
  },
}

// Controle: vaza de propósito (objeto preso, nó solto e listener por ciclo).
// run.mjs exige que a bateria pegue este vazamento antes de confiar nos outros.
class Preso {}
const presos = []
const controle = {
  vazando(el) {
    const desmontar = HOSTS.slot(el)
    return () => {
      presos.push(new Preso(), el.cloneNode(true))
      window.addEventListener('resize', () => presos.length)
      desmontar()
    }
  },
}

/** Monta e desmonta `n` vezes. Adaptador de host pelo nome; remote como "remote:<fw>". */
window.ciclar = async (adaptador, n) => {
  for (let i = 0; i < n; i++) {
    const el = area.appendChild(document.createElement('div'))
    const montar = adaptador.startsWith('remote:')
      ? (alvo) => {
          const slot = createSlot(alvo, { name: adaptador.slice(7), props: { mensagem: 'oi' } })
          return () => slot.destroy()
        }
      : (HOSTS[adaptador] ?? controle[adaptador])
    const desmontar = montar(el)
    await ate(pronto(el))
    desmontar()
    el.remove()
  }
  // Tudo que sobra montado na página depois dos ciclos.
  return document.querySelectorAll('[data-vitral-root], [data-vitral-slot], vitral-remote').length
}

window.HOSTS = Object.keys(HOSTS)
window.__pronto = true
