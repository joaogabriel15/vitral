<script setup>
import { ref } from 'vue'
import { useIlha } from 'arquipelago/vue'

defineProps({ mensagem: String })
const ilha = useIlha()
const cliques = ref(0)
function ping() {
  cliques.value++
  ilha.events.emit('ping', 'Vue')
}
</script>

<template>
  <div class="cartao">
    <h3 class="fw">Vue</h3>
    <p class="msg">{{ mensagem }}</p>
    <button class="ping" @click="ping">ping <span class="cliques">{{ cliques }}</span></button>
  </div>
</template>
