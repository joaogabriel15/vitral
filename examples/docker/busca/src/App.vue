<script setup>
import { ref } from 'vue'

const termo = ref('')
</script>

<template>
  <div class="busca">
    <input v-model="termo" placeholder="Buscar produtos" aria-label="Buscar produtos" />
    <p v-if="termo">Buscando por "{{ termo }}"</p>
  </div>
</template>

<style>
.busca {
  padding: 16px;
  border-left: 6px solid #059669;
  background: #ecfdf5;
}
</style>
