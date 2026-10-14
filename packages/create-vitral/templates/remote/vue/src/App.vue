<!-- O plugin vitral embrulha o export default: não precisa de adaptador. -->
<script setup>
import { ref } from 'vue'

defineProps({ nome: { type: String, default: 'mundo' } })
const cliques = ref(0)
</script>

<template>
  <section>
    <h2>Olá, {{ nome }}</h2>
    <button @click="cliques++">Cliques: {{ cliques }}</button>
  </section>
</template>
