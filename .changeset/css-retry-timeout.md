---
"vitral": patch
---

CSS que falha (HTTP de erro, rede, hash diferente) não fica mais preso no cache: a próxima montagem baixa de novo. O `timeout` do `configure` agora vale também para o CSS: um CSS que não responde não segura a montagem além desse prazo.
