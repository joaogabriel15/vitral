<script setup lang="ts">
import { ref } from 'vue'
import { VitralRemote, useEventValue } from 'vitral/vue'

const REMOTES = ['react', 'vue', 'svelte', 'solid', 'preact', 'angular', 'lit', 'vanilla']
const mensagem = ref('olá')
const ping = useEventValue<string>('ping')
</script>

<template>
  <main>
    <h1>Host Nuxt</h1>
    <input id="mensagem" aria-label="Mensagem" v-model="mensagem" />
    <p>Último ping: <span id="ultimo-ping">{{ ping ?? '-' }}</span></p>
    <section v-for="n in REMOTES" :key="n" :data-remote="n">
      <VitralRemote :name="n" :props="{ mensagem }">
        <template #fallback><p>carregando {{ n }}…</p></template>
      </VitralRemote>
    </section>
    <section data-remote="quebrado">
      <VitralRemote name="quebrado">
        <template #error="{ retry }"><p class="erro">indisponível <button @click="retry">tentar de novo</button></p></template>
      </VitralRemote>
    </section>
  </main>
</template>
