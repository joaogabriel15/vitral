<!-- <VitralRemote> renderiza o fallback no servidor e monta no cliente. -->
<script setup>
import { VitralRemote } from 'vitral/vue'
</script>

<template>
  <main>
    <h1>Host Nuxt</h1>
    <VitralRemote src="__SRC__" :props="{ nome: 'host' }">
      <template #fallback><p>Carregando…</p></template>
    </VitralRemote>
  </main>
</template>
