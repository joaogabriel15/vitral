/**
 * Ajustes de cascata no CSS do remote para conviver com o CSS do host.
 */
import type { ChildNode, Container, Root } from 'postcss'

/**
 * `layers: 'flatten'`: tira os `@layer` mantendo a ordem da cascata.
 *
 * No modo escopo, CSS do host sem camada (Tailwind v3, CSS legado) vence
 * qualquer regra em camada do remote, e as camadas do remote se fundem com as
 * do host de mesmo nome. Sem camadas, o seletor escopado decide.
 *
 * O conteúdo de cada camada vai para a posição da camada na ordem em que ela
 * apareceu primeiro, e o CSS que já estava sem camada fica no fim, como na
 * cascata original. `@charset`, `@import` e comentários do início ficam no topo.
 */
export function flattenLayers(root: Root): void {
  flatten(root)
}

function flatten(container: Container): void {
  const head: ChildNode[] = []
  const layers = new Map<string, ChildNode[]>()
  const rest: ChildNode[] = []
  let anonymous = 0
  const layer = (name: string) => {
    let nodes = layers.get(name)
    if (!nodes) layers.set(name, (nodes = []))
    return nodes
  }
  for (const node of [...container.nodes!]) {
    const at = node.type === 'atrule' ? node : null
    if (at?.name.toLowerCase() === 'layer') {
      if (!at.nodes) {
        // `@layer a, b;` só declara a ordem.
        for (const name of at.params.split(',')) layer(name.trim())
      } else {
        flatten(at)
        layer(at.params.trim() || `\0${anonymous++}`).push(...at.nodes)
      }
    } else if (!layers.size && !rest.length && (node.type === 'comment' || /^(?:charset|import)$/i.test(at?.name ?? ''))) {
      head.push(node)
    } else {
      if (at?.nodes) flatten(at)
      rest.push(node)
    }
  }
  if (!layers.size) return
  container.removeAll()
  container.append(...head, ...[...layers.values()].flat(), ...rest)
}

/**
 * `renameRegisteredProperties`: renomeia as propriedades `--tw-*`
 * registradas com `@property` para `--tw-<escopo>-*`, no registro e em cada
 * uso. O registro de `@property` vale para a página toda, e o Tailwind v4
 * registra `--tw-gradient-from` e outras como `<color>`: com um host em
 * Tailwind v3 na mesma página, os gradientes do v3 param de funcionar.
 */
export function renameRegisteredProperties(root: Root, scope: string): void {
  const names: string[] = []
  root.walkAtRules(/^property$/i, (rule) => {
    const name = rule.params.trim()
    if (name.startsWith('--tw-')) names.push(name.slice(5).replace(/[\\^$.*+?()[\]{}|]/g, '\\$&'))
  })
  if (!names.length) return
  const re = new RegExp(`(?<![\\w-])--tw-(${names.join('|')})(?![\\w-])`, 'g')
  const to = `--tw-${scope}-$1`
  root.walk((node) => {
    if (node.type === 'decl') {
      node.prop = node.prop.replace(re, to)
      node.value = node.value.replace(re, to)
    } else if (node.type === 'atrule') {
      node.params = node.params.replace(re, to)
    }
  })
}
