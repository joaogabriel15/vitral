---
"vitral": patch
---

`checkUpdates` e `watchUpdates` deixam de revalidar remotes que já foram desmontados. Montar o mesmo remote várias vezes não acumula mais entradas `performance.measure` na página: fica a última de cada remote e etapa.
