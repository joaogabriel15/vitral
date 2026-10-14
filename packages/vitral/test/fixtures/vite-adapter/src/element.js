// Web Component sem elementRemote(): o plugin registra a tag e embrulha.
export default class Saudacao extends HTMLElement {
  set nome(v) {
    this.textContent = `oi ${v}`
  }
}
