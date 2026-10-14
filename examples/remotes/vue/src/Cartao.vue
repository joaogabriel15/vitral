<script setup>
import { ref } from 'vue'
import { shared } from 'vitral'
import { useShared, useVitral } from 'vitral/vue'

defineProps({ mensagem: String })
const vitral = useVitral()
const cliques = ref(0)
const usuario = useShared('usuario', (u) => u?.nome ?? '-')
const itens = useShared('carrinho', (c) => c?.itens.length ?? 0)
function ping() {
  cliques.value++
  vitral.events.emit('ping', 'Vue')
}
const comprar = () => shared('carrinho').get()?.adicionar('Vue')
</script>

<template>
  <div class="cartao">
    <h3 class="fw">Vue</h3>
    <p class="msg">{{ mensagem }}</p>
    <button class="ping" @click="ping">ping <span class="cliques">{{ cliques }}</span></button>
    <p>Usuário: <span class="usuario">{{ usuario }}</span> · carrinho: <span class="carrinho">{{ itens }}</span></p>
    <button class="comprar" @click="comprar">comprar</button>
  </div>
</template>
