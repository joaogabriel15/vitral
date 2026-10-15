<script setup>
import { VitralRemote } from 'vitral/vue'
</script>

<template>
  <main>
    <h1>Host Vue</h1>
    <VitralRemote src="__SRC__" :props="{ nome: 'host' }">
      <template #fallback><p>Carregando…</p></template>
    </VitralRemote>
  </main>
</template>
