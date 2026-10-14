<script setup>
import { computed } from 'vue'
import { events } from 'vitral/vue'

const props = defineProps({ moeda: { type: String, default: 'BRL' } })

const produtos = [
  { nome: 'Teclado', preco: 249.9 },
  { nome: 'Mouse', preco: 89.5 },
  { nome: 'Monitor', preco: 1199 },
]
const fmt = computed(() => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: props.moeda }))

function adicionar(p) {
  events.emit('carrinho:adicionar', p)
}
</script>

<template>
  <section class="catalogo">
    <h2>Catálogo <small>(Vue)</small></h2>
    <button v-for="p in produtos" :key="p.nome" class="produto" @click="adicionar(p)">
      {{ p.nome }} · {{ fmt.format(p.preco) }}
    </button>
  </section>
</template>

<style>
.catalogo { border: 2px solid #42b883; border-radius: 8px; padding: 12px 16px; font-family: system-ui; }
.catalogo h2 { margin: 0 0 8px; font-size: 18px; }
/* Regra genérica de propósito: com isolate="shadow" ela não vaza para o host. */
button { background: #42b883; color: white; border: 0; border-radius: 6px; padding: 8px 12px; margin: 4px; cursor: pointer; }
</style>
