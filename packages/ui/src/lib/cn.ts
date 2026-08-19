import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * `tailwind-merge` needs to know about the custom scales declared in `tokens.css`,
 * otherwise `text-cc-sm` and `text-cc-body` are treated as unrelated classes and both
 * survive a merge — which silently breaks every `className` override a consumer passes.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['cc-body', 'cc-sm', 'cc-xs', 'cc-code'] }],
      rounded: [{ rounded: ['cc-xs', 'cc-sm', 'cc-md', 'cc-lg', 'cc-bubble', 'cc-full'] }],
      shadow: [{ shadow: ['cc-card', 'cc-raised', 'cc-overlay'] }],
    },
  },
})

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
