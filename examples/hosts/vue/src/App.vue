<script setup>
import { ref } from 'vue'
import { IlhaRemote, useEventValue } from 'arquipelago/vue'

const REMOTES = ['react', 'vue', 'svelte', 'solid', 'preact', 'angular', 'lit', 'vanilla']
const mensagem = ref('olá')
const ping = useEventValue('ping')
</script>

<template>
  <h1>Host Vue</h1>
  <input id="mensagem" v-model="mensagem" />
  <p>Último ping: <span id="ultimo-ping">{{ ping ?? '-' }}</span></p>
  <section v-for="n in REMOTES" :key="n" :data-remote="n">
    <IlhaRemote :name="n" :props="{ mensagem }">
      <template #fallback><p>carregando {{ n }}…</p></template>
    </IlhaRemote>
  </section>
  <section data-remote="quebrado">
    <IlhaRemote name="quebrado">
      <template #error="{ retry }"><p class="erro">indisponível <button @click="retry">tentar de novo</button></p></template>
    </IlhaRemote>
  </section>
</template>
