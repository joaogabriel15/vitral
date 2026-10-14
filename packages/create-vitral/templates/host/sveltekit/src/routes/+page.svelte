<!-- A action monta o remote só no navegador; no servidor fica a div vazia. -->
<script>
  import { remote } from 'vitral/svelte'
</script>

<main>
  <h1>Host SvelteKit</h1>
  <div use:remote={{ src: '__SRC__', props: { nome: 'host' } }}></div>
</main>
