<script>
  let { mensagem = '', ilha } = $props()
  let cliques = $state(0)
  function ping() {
    cliques++
    ilha.events.emit('ping', 'Svelte')
  }
</script>

<div class="cartao">
  <h3 class="fw">Svelte</h3>
  <p class="msg">{mensagem}</p>
  <button class="ping" onclick={ping}>ping <span class="cliques">{cliques}</span></button>
</div>
