import { Chat } from './chat'

/**
 * A server component. Nothing from `@agent-chat/*` is imported here — the client boundary
 * is `./chat`, which the packages' own `"use client"` banner would enforce anyway. If the
 * banner ever goes missing from a build, this page fails to compile, which is exactly the
 * signal this example exists to produce.
 */
export default function Page() {
  return (
    <main className="mx-auto flex h-dvh max-w-3xl flex-col px-4">
      <header className="shrink-0 border-b border-cc-border py-4">
        <h1 className="text-cc-body font-medium text-cc-fg">Next.js App Router 冒烟测试</h1>
        <p className="mt-1 text-cc-xs text-cc-faint">
          这个页面是服务端渲染的；组件来自 node_modules 里的构建产物，不是源码别名。 `/api/chat`
          是一个由服务端持有凭证的代理端点 —— key 不会出现在浏览器里。
        </p>
      </header>

      <Chat />
    </main>
  )
}
