import type { CodeRunResult } from '@agent-chat/ui'

/**
 * A fake code runner for the stories.
 *
 * It does not execute anything — not `eval`, not a Worker. Snippets in a transcript are
 * model output, and the point of the `onRunCode` seam is that the *host* decides where
 * they may run (a sandboxed iframe, a backend container, nowhere). A demo that quietly
 * called `eval` would teach exactly the wrong thing.
 *
 * What it does instead is produce a plausible result for each language so the result
 * panel — success, failure, empty output, long scrolling output — can be looked at.
 */
export async function mockRunCode(
  code: string,
  language: string | undefined,
): Promise<CodeRunResult> {
  const started = performance.now()
  await new Promise((resolve) => setTimeout(resolve, 450 + code.length * 0.4))
  const durationMs = performance.now() - started

  /* An explicit `throw` in the snippet is the escape hatch for looking at the error
   * styling without editing this file. */
  if (/\bthrow\b/.test(code)) {
    return {
      status: 'error',
      durationMs,
      output: [
        'Error: refresh token rotated before the retry landed',
        '    at refresh (src/auth.ts:42:11)',
        '    at async getToken (src/auth.ts:28:10)',
        '    at async fetchWithAuth (src/api/client.ts:17:18)',
      ].join('\n'),
    }
  }

  const lines = code.split('\n').length

  if (language === 'shellscript' || language === 'bash' || language === 'sh') {
    return {
      status: 'ok',
      durationMs,
      output: 'PASS  src/auth.test.ts\n\nTests  14 passed (14)\n  Time  1.92s',
    }
  }

  if (language === 'sql') {
    return {
      status: 'ok',
      durationMs,
      output:
        ' id | status  | count \n----+---------+-------\n  1 | ok      |  1284 \n  2 | expired |    17 \n(2 rows)',
    }
  }

  /* No output is a real outcome — a snippet that only defines a function prints nothing.
   * The panel still shows, so the run reads as "done" rather than as "nothing happened". */
  if (!/\b(console\.log|print|println|echo|return)\b/.test(code)) {
    return { status: 'ok', durationMs }
  }

  return {
    status: 'ok',
    durationMs,
    output: `▸ token { value: 'at_9f21…', expiresIn: 3600 }\n▸ 1 refresh shared by 4 callers\n\n(evaluated ${lines} lines)`,
  }
}
