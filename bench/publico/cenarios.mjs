// Cenários do benchmark público. Cada cenário diz qual host e quais remotes
// a página usa. Os remotes de cada cenário são construídos à parte, em
// `out/<id>/<nome>/`.
//
// Ponto de extensão. Um cenário novo (dicionário de compressão, prefetch
// preditivo) entra como um item a mais nesta lista, com os ganchos opcionais:
//
//   build(ferramenta, opcoes)  devolve as opções do plugin do remote
//                              (ex.: { ...opcoes, dict: true })
//   query                      parâmetros a mais na URL do host
//                              (ex.: { prefetch: '1' }); o host lê com URLSearchParams
//   servidor(req, arquivo)     devolve { headers?, body? }: cabeçalhos a mais e,
//                              se quiser, outro corpo para a resposta
//                              (ex.: Use-As-Dictionary, ou Content-Encoding: dcb).
//                              Vale para os arquivos dos remotes do cenário e
//                              para o HTML do host; os assets do host são comuns
//   antes(page, url)           roda antes de cada visita medida
//                              (ex.: visitar a rota anterior para o prefetch agir)
//
// O run.mjs chama os ganchos sem saber o que eles fazem: um cenário novo
// não muda o run.mjs.

/** @typedef {{ id: string, rotulo: string, host: 'vitral' | 'mf', ferramenta: 'vitral' | 'mf', compartilha: boolean, build?: Function, query?: Record<string, string>, servidor?: Function, antes?: Function }} Cenario */

/** @type {Cenario[]} */
export const cenarios = [
  { id: 'vitral', rotulo: 'vitral, sem dedupe', host: 'vitral', ferramenta: 'vitral', compartilha: false },
  { id: 'vitral-dedupe', rotulo: 'vitral, com dedupe', host: 'vitral', ferramenta: 'vitral', compartilha: true },
  { id: 'vitral-salvo', rotulo: 'vitral, dedupe e maxStale', host: 'vitral', ferramenta: 'vitral', compartilha: true, query: { stale: '300' } },
  { id: 'mf', rotulo: 'MF, sem shared', host: 'mf', ferramenta: 'mf', compartilha: false },
  { id: 'mf-shared', rotulo: 'MF, shared singleton', host: 'mf', ferramenta: 'mf', compartilha: true },
  // Passo 18 (dicionário) e passo 22 (prefetch) entram aqui.
]
