// Função que devolve html``, sem component(): o plugin embrulha.
import { html } from 'vitral'

export default ({ nome }) => html`<p>oi ${nome}</p>`
