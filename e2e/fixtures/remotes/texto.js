// Remote com component() e html``: mostra as props como texto e atributo.
// `confiavel` entra por unsafeHTML (opt-in explícito de HTML).
import { component, html, unsafeHTML } from 'http://localhost:4400/libs/atual/index.js'

export default component({
  render: ({ texto, confiavel }) => html`
    <p class="texto" title="${texto}">${texto}</p>
    <div class="confiavel">${confiavel ? unsafeHTML(confiavel) : ''}</div>
  `,
})
