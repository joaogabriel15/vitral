// Teste de tipos (tsc, sem rodar): com o `vitral-env.d.ts` gerado por
// `npx vitral types` ao lado, prop errada não compila. Cada
// `@ts-expect-error` que deixar de dar erro quebra o `pnpm typecheck`.
import { Remote } from 'vitral/react'
import { Remote as PreactRemote } from 'vitral/preact'
import { Remote as SolidRemote } from 'vitral/solid'
import type { PropsOf } from 'vitral'

export const certo = <Remote name="carrinho" props={{ userId: 1, cupom: 'x' }} />

// @ts-expect-error userId precisa ser number
export const tipoErrado = <Remote name="carrinho" props={{ userId: '1' }} />

// @ts-expect-error falta userId
export const faltando = <Remote name="carrinho" props={{ cupom: 'x' }} />

// Nome fora de Remotes e src seguem aceitando qualquer objeto.
export const livre = <Remote name="outro" props={{ qualquer: true }} />
export const porSrc = <Remote src="https://cdn.exemplo.com/x/vitral.json" props={{ qualquer: true }} />

export const preactCerto = PreactRemote({ name: 'carrinho', props: { userId: 1 } })
// @ts-expect-error userId precisa ser number
export const preactErrado = PreactRemote({ name: 'carrinho', props: { userId: '1' } })

export const solidCerto = SolidRemote({ name: 'carrinho', props: { userId: 1 } })
// @ts-expect-error userId precisa ser number
export const solidErrado = SolidRemote({ name: 'carrinho', props: { userId: '1' } })

export const props: PropsOf<'carrinho'> = { userId: 1 }
// @ts-expect-error userId precisa ser number
export const propsErradas: PropsOf<'carrinho'> = { userId: '1' }
