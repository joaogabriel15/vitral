---
'vitral': minor
---

`vitral/prefetch`: cadeia de Markov de ordens 1 a 3 (usa o contexto mais longo com suporte e confiança); `prior` com as transições da população para a primeira visita (`vitral prior` gera de sessões agregadas); prefetch só quando probabilidade × tempo poupado passa o custo dos bytes na rede de agora (`byteCost`); `pointerdown` em link baixa os remotes da rota na hora; `speculate` põe Speculation Rules na rota prevista sem remote. O `threshold` padrão passa de 0.4 para 0.1, porque a conta de custo decide.
