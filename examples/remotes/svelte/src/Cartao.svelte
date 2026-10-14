<script>
  import { shared } from 'vitral'

  let { mensagem = '', vitral } = $props()
  let cliques = $state(0)
  const usuario = shared('usuario')
  const carrinho = shared('carrinho')
  function ping() {
    cliques++
    vitral.events.emit('ping', 'Svelte')
  }
  // O carrinho é só leitura: este set é bloqueado (aviso em produção).
  function forcar() {
    try {
      carrinho.set({ itens: [], adicionar() {} })
    } catch (e) {
      console.warn(e.message)
    }
  }
</script>

<div class="cartao">
  <h3 class="fw">Svelte</h3>
  <p class="msg">{mensagem}</p>
  <button class="ping" onclick={ping}>ping <span class="cliques">{cliques}</span></button>
  <p>Usuário: <span class="usuario">{$usuario?.nome ?? '-'}</span> · carrinho: <span class="carrinho">{$carrinho?.itens.length ?? 0}</span></p>
  <button class="comprar" onclick={() => $carrinho?.adicionar('Svelte')}>comprar</button>
  <button class="forcar" onclick={forcar}>esvaziar direto</button>
</div>
