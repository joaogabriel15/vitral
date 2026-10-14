import { component, html } from 'vitral'

// Remote sem framework: component() já tem mount/update/unmount.
export default component({
  state: { cliques: 0 },
  render: ({ nome = 'mundo' }, state) => html`
    <section>
      <h2>Olá, ${nome}</h2>
      <button onclick=${() => state.cliques++}>Cliques: ${state.cliques}</button>
    </section>
  `,
})
