/* `tsc` never loads `vitest.setup.ts` — the test runner does. Without this reference the
 * jest-dom matchers (`toBeInTheDocument`, `toHaveTextContent`, …) are present at runtime but
 * missing from `Assertion`, so every `.tsx` test fails to type-check. Each package includes
 * this file so the augmentation lands in its program. */
import '@testing-library/jest-dom/vitest'
