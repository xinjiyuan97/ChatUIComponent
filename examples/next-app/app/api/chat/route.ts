import type { A2UINode, ChatEvent } from '@xinjiyuan97/chat-core'

export const runtime = 'nodejs'
/* Nothing here is cacheable — it's a stream. */
export const dynamic = 'force-dynamic'

/**
 * The proxy endpoint.
 *
 * In a real app this is where you'd call the upstream provider and forward its SSE:
 *
 *   const upstream = await fetch('https://api.anthropic.com/v1/messages', {
 *     method: 'POST',
 *     headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY!, ... },
 *     body: JSON.stringify({ ...body, stream: true }),
 *   })
 *   return new Response(upstream.body, { headers: SSE_HEADERS })
 *
 * The key stays in `process.env` on the server. It must never reach the browser: a key
 * shipped to the client is a published key — it lands in the bundle, in DevTools and in
 * the user's cache, and stays usable until it is revoked.
 *
 * This example streams a scripted reply instead, so the smoke test needs no credentials.
 */
export async function POST(request: Request) {
  const { messages } = (await request.json()) as { messages?: Array<{ parts?: unknown[] }> }
  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ChatEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
      }
      const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

      const emitText = async (text: string, chunk = 6, delay = 24) => {
        for (let i = 0; i < text.length; i += chunk) {
          send({ type: 'text-delta', delta: text.slice(i, i + chunk) })
          await wait(delay)
        }
      }

      try {
        send({ type: 'message-start', id: `assistant-${(messages?.length ?? 0) + 1}` })

        send({ type: 'reasoning-start' })
        for (const piece of REASONING) {
          send({ type: 'reasoning-delta', delta: piece })
          await wait(40)
        }
        send({ type: 'reasoning-end' })

        send({ type: 'tool-input-start', toolCallId: 'call_1', name: 'read_file' })
        for (const piece of ['{"path":', '"src/auth', '.ts"}']) {
          send({ type: 'tool-input-delta', toolCallId: 'call_1', delta: piece })
          await wait(60)
        }
        send({
          type: 'tool-input-available',
          toolCallId: 'call_1',
          input: { path: 'src/auth.ts' },
        })
        send({ type: 'tool-executing', toolCallId: 'call_1' })
        await wait(500)
        send({
          type: 'tool-output',
          toolCallId: 'call_1',
          output: { lines: 80, language: 'typescript' },
        })

        await emitText(ANSWER)

        send({ type: 'a2ui', surfaceId: 'surface-1', spec: CONFIRM_CARD })
        send({ type: 'message-end', finishReason: 'stop' })
      } catch (error) {
        send({ type: 'error', error: error instanceof Error ? error.message : String(error) })
      } finally {
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Proxies that buffer will make the stream arrive all at once, which looks like a hang.
      'X-Accel-Buffering': 'no',
    },
  })
}

const REASONING = [
  '这是一个服务端流式的冒烟测试。',
  '先确认 SSE 能穿过 Next.js 的 route handler，',
  '再确认组件在 SSR 之后 hydrate 不报 mismatch。',
]

const ANSWER = `## 服务端流式跑通了

这条回复是 \`app/api/chat/route.ts\` 逐块吐出来的，走的是本库原生的 \`ChatEvent\` 格式：

\`\`\`ts
const transport = createSSETransport({ url: '/api/chat' })
\`\`\`

上面的思考过程和工具调用同样来自这个流。真实场景里，把 \`route.ts\` 换成转发上游 SSE 就行 —— **凭证留在服务端**。
`

const CONFIRM_CARD: A2UINode = {
  type: 'Card',
  props: { title: '一切正常', subtitle: '这张卡片由 a2ui 事件渲染' },
  children: [
    {
      type: 'Column',
      props: { gap: 'md' },
      children: [
        { type: 'Alert', props: { tone: 'success', text: 'SSR、hydration、流式解析都没问题。' } },
        {
          type: 'Row',
          props: { gap: 'sm', justify: 'end' },
          children: [
            {
              type: 'Button',
              props: { label: '知道了', variant: 'primary', onClick: { action: 'ack' } },
            },
          ],
        },
      ],
    },
  ],
}
