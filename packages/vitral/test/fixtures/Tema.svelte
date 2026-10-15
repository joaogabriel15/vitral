<script>
  import { shared } from '../../src/index'
  const tema = shared('tema')
</script>

<p>{$tema}</p>
<button onclick={() => tema.set('escuro')}>trocar</button>
