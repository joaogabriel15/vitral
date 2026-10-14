// @vitest-environment happy-dom
import { flushSync } from 'svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { register } from '../src/index'
import { remote, svelteRemote } from '../src/svelte'
import { mockRemote } from '../src/testing'
import Card from './fixtures/Card.svelte'
import { cleanup, flush, serveManifest } from './helpers'

afterEach(cleanup)

describe('Svelte', () => {
  it('svelteRemote: renderiza, mantém estado ao atualizar props e recebe o contexto', async () => {
    register('card', { module: svelteRemote(Card) })
    const node = document.body.appendChild(document.createElement('div'))
    const action = remote(node, { name: 'card', props: { msg: 'oi' } })
    await flush()
    expect(node.textContent).toContain('oi (card) cliques=0')
    node.querySelector('button')!.click()
    flushSync()
    action.update({ name: 'card', props: { msg: 'tchau' } })
    flushSync()
    expect(node.textContent).toContain('tchau (card) cliques=1')
    action.destroy()
    expect(node.textContent).toBe('')
  })

  it('action use:remote troca de remote e repassa status', async () => {
    mockRemote('a', (el) => (el.textContent = 'A'))
    mockRemote('b', (el) => (el.textContent = 'B'))
    const node = document.body.appendChild(document.createElement('div'))
    const status: string[] = []
    const action = remote(node, { name: 'a', onStatus: (s) => status.push(s) })
    await flush()
    expect(node.textContent).toBe('A')
    action.update({ name: 'b' })
    await flush()
    expect(node.textContent).toBe('B')
    expect(status).toEqual(['loading', 'ready', 'loading', 'ready'])
  })
})

describe('Svelte: use:remote com src', () => {
  it('monta pela URL do manifesto e troca de src', async () => {
    serveManifest((url) => url.split('/')[3])
    const node = document.body.appendChild(document.createElement('div'))
    const action = remote(node, { src: 'https://cdn.exemplo.com/a/vitral.json', props: { n: 1 } })
    await vi.waitFor(() => expect(node.textContent).toBe('a:1'))
    action.update({ src: 'https://cdn.exemplo.com/b/vitral.json', props: { n: 2 } })
    await vi.waitFor(() => expect(node.textContent).toBe('b:2'))
  })
})
