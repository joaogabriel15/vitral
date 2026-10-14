<script>
  import { onDestroy } from 'svelte'
  import { events } from 'vitral'
  import { remote } from 'vitral/svelte'

  const REMOTES = ['react', 'vue', 'svelte', 'solid', 'preact', 'angular', 'lit', 'vanilla']
  let mensagem = $state('olá')
  let ping = $state('-')
  let erro = $state(false)
  let quebrado
  onDestroy(events.on('ping', (fw) => (ping = fw)))
</script>

<h1>Host Svelte</h1>
<input id="mensagem" bind:value={mensagem} />
<p>Último ping: <span id="ultimo-ping">{ping}</span></p>
{#each REMOTES as n (n)}
  <section data-remote={n}>
    <div use:remote={{ name: n, props: { mensagem } }}></div>
  </section>
{/each}
<section data-remote="quebrado">
  {#if erro}<p class="erro">indisponível <button onclick={() => quebrado.retry()}>tentar de novo</button></p>{/if}
  <vitral-remote name="quebrado" bind:this={quebrado} onvitral-error={() => (erro = true)}></vitral-remote>
</section>
