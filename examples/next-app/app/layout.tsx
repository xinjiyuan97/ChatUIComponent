import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import './globals.css'

export const metadata: Metadata = {
  title: 'Agent Chat — Next.js smoke test',
  description: 'Server-rendered App Router page consuming the published bundles.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="h-full">{children}</body>
    </html>
  )
}
