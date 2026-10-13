<script setup>
import { ref } from 'vue'
import { IlhaRemote, useEventValue } from 'ilha/vue'

const total = useEventValue('carrinho:total')
const titulo = ref('Carrinho do host Vue')
</script>

<template>
  <main style="font-family: system-ui; max-width: 720px; margin: 24px auto; display: grid; gap: 16px">
    <header style="display: flex; gap: 12px; align-items: center">
      <h1 style="margin: 0; flex: 1">Host Vue</h1>
      <span id="badge">🛒 {{ total ?? 0 }}</span>
      <input id="titulo" v-model="titulo" />
    </header>

    <IlhaRemote name="catalogo" isolate="shadow">
      <template #fallback><p>Carregando catálogo…</p></template>
    </IlhaRemote>
    <IlhaRemote name="carrinho" :props="{ titulo }">
      <template #fallback><p>Carregando carrinho…</p></template>
    </IlhaRemote>
    <IlhaRemote name="quebrado">
      <template #error="{ error, retry }">
        <p id="erro" style="color: crimson">Remote indisponível ({{ error.code }}). <button @click="retry">Tentar de novo</button></p>
      </template>
    </IlhaRemote>
  </main>
</template>
