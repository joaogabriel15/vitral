---
'vitral': minor
---

Carregamento mais rápido. O código de dedupe baixa junto com o primeiro manifesto, e não depois dele: a cópia do framework começa uma ida e volta antes. Uma query com a palavra `vitral` (ex.: `?utm_source=vitral`) não baixa mais o módulo de overrides antes do manifesto: só `?vitral=` liga os overrides. Opção nova `configure({ maxStale })`: na visita de volta, usa o `vitral.json` salvo há até N segundos sem esperar a rede e baixa o novo por trás. Opção nova `vitral({ compileHints: true })` no plugin: o compile hint do V8 nos arquivos que rodam ao montar, para CPU lenta.
