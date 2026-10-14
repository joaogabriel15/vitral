<script>
  let { msg = '', vitral } = $props()
  let cliques = $state(0)
</script>

<p>{msg} ({vitral?.name}) cliques={cliques}</p>
<button onclick={() => cliques++}>+</button>
