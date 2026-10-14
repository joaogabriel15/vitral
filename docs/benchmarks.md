<script setup>
import tamanho from '../bench/tamanho.json'

const data = (iso) => iso.split('-').reverse().join('/')
const kb = (n) => n.toFixed(1).replace('.', ',')
</script>

# Benchmarks

Cada número tem data, versões e máquina. Os scripts estão em [`bench/`](https://github.com/joaogabriel15/vitral/tree/main/bench) para qualquer pessoa repetir.

## Tamanho do código de host

Só a API que um host usa, empacotada e minificada com esbuild e comprimida com brotli nível 11. Menor é melhor.

![Tamanho do código de host](/tamanho-host.svg)

<table>
  <thead>
    <tr><th>Ferramenta</th><th>Versão</th><th>Entrada medida</th><th>Minificado</th><th>Brotli</th></tr>
  </thead>
  <tbody>
    <tr v-for="r in tamanho.resultados" :key="r.nome">
      <td>{{ r.nome }}</td>
      <td><code>{{ r.pacote }}</code></td>
      <td><code>{{ r.entrada }}</code></td>
      <td>{{ kb(r.minKB) }} kB</td>
      <td><strong>{{ kb(r.brotliKB) }} kB</strong></td>
    </tr>
  </tbody>
</table>

- **Data:** {{ data(tamanho.data) }}
- **Método:** {{ tamanho.metodo }}
- **Máquina:** {{ tamanho.maquina.cpu }}, {{ tamanho.maquina.nucleos }} núcleos, {{ tamanho.maquina.so }}, Node {{ tamanho.maquina.node }}
- **Dados:** [`bench/tamanho.json`](https://github.com/joaogabriel15/vitral/blob/main/bench/tamanho.json)

Para repetir:

```bash
pnpm install && pnpm build
node bench/tamanho.mjs
```

O tamanho mede só o código de host. Não mede o tempo de carregamento nem o que cada ferramenta faz a mais (sandbox de JS no qiankun, no wujie e no micro-app; compartilhamento de dependências no Module Federation).

## Carregamento do vitral

Host com 3 remotes React e 1 Vue (os de `examples/remotes`), no Chromium, com a rede "Slow 4G" do Lighthouse (150 ms de RTT, 1,6 Mbps). Mediana de 5 execuções.

| Métrica | Valor | O que mede |
| --- | --- | --- |
| Pronto, cache vazio | 1.970,7 ms | Tempo até os 4 remotes prontos na primeira visita |
| Pronto, cache cheio | 645,9 ms | O mesmo na segunda visita |
| JS transferido | 218,9 kB | JS da primeira visita, comprimido |
| Heap após 100 ciclos | 227,8 kB | Memória a mais depois de 100 ciclos de desmontar e montar |

- **Data:** 14/10/2026
- **Versões:** vitral 0.1.0 (base da fase 0), React 19.3.0, Vue 3.5.44, Vite 8.3.4, Playwright 1.56.1, Chromium 141.0.7390.37
- **Máquina:** Intel Xeon @ 2,10 GHz, 4 núcleos, Linux 6.18, Node 22.22.0

Para repetir:

```bash
pnpm install && pnpm build
pnpm --filter remote-react --filter remote-vue build
node bench/run.mjs --out resultado.json
```

O CI roda o mesmo cenário em cada PR, contra a `main`, e falha se alguma métrica piorar mais de 10%.

::: info Em breve
O mesmo cenário com single-spa, Module Federation, qiankun, wujie e micro-app, cada um com a configuração que a própria documentação recomenda. Até lá, esta página não compara tempo de carregamento.
:::
