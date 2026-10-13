<script>
  let { msg = '', ilha } = $props()
  let cliques = $state(0)
</script>

<p>{msg} ({ilha?.name}) cliques={cliques}</p>
<button onclick={() => cliques++}>+</button>
