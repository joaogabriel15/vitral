<!-- O plugin vitral embrulha o export default: não precisa de adaptador. -->
<script>
  let { nome = 'mundo' } = $props()
  let cliques = $state(0)
</script>

<section>
  <h2>Olá, {nome}</h2>
  <button onclick={() => cliques++}>Cliques: {cliques}</button>
</section>
