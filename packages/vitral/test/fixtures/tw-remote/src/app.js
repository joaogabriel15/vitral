// Classes que dependem do tema: cor e fonte próprias, cores e espaçamento do
// Tailwind, sombra, ring, gradiente, dark mode e valores arbitrários.
const html = `
  <button class="botao bg-marca text-white font-sans px-4 py-2 rounded-lg shadow-lg ring-2 ring-marca/50 hover:bg-sky-500 dark:bg-black">ok</button>
  <div class="gradiente bg-linear-to-r from-marca via-sky-500 to-pink-500 h-[37px] w-[123px] text-sm/6 tracking-tight"></div>
  <p class="texto text-zinc-700 dark:text-zinc-100 font-mono md:text-lg leading-tight translate-x-2 rotate-3 blur-sm transition"></p>
`

export default {
  mount(el) {
    el.innerHTML = html
    return { unmount: () => el.replaceChildren() }
  },
}
