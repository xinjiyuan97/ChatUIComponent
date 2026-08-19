import type { A2UIComponent, A2UIRegistry } from './types'

/**
 * Case-insensitive lookup over a registry.
 *
 * Models are inconsistent about casing — the same prompt yields `Button`, `button` and
 * occasionally `BUTTON`. Normalising here costs nothing and removes a whole class of
 * "the card renders as an unknown node" bug reports.
 */
export function createRegistryLookup(registry: A2UIRegistry) {
  const normalised = new Map<string, A2UIComponent>()
  for (const [name, component] of Object.entries(registry)) {
    normalised.set(name.toLowerCase(), component)
  }

  return function lookup(type: string): A2UIComponent | undefined {
    return registry[type] ?? normalised.get(type.toLowerCase())
  }
}

/** Shallow merge, with later registries overriding earlier ones. */
export function mergeRegistries(...registries: Array<A2UIRegistry | undefined>): A2UIRegistry {
  return Object.assign({}, ...registries.filter(Boolean)) as A2UIRegistry
}
