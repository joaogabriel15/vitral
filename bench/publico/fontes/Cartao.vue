<script setup>
// Remote Vue do benchmark público. O mesmo componente entra no build do
// vitral e no do Module Federation; só a entrada muda.
import { ref } from 'vue'

defineProps({ nome: String, mensagem: String })
const cliques = ref(0)
</script>

<template>
  <div class="cartao" :data-nome="nome">
    <h3>Vue {{ nome }}</h3>
    <p>{{ mensagem }}</p>
    <button @click="cliques++">cliques: {{ cliques }}</button>
  </div>
</template>
