/*
 * Fixtures for the preview stories, shared with the end-to-end workspace so both show the
 * same repository — the transcript there says it read `src/auth.ts`, and the file the panel
 * opens under that name is the one the reply is about.
 *
 * The three base64 blobs below are real files, generated small on purpose.
 */

import type { FileNode, PreviewFile } from '@xinjiyuan97/chat-core'

/** A four-page PDF with page numbers, so paging and zoom have something to act on. */
export const PDF_BASE64 =
  'JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5' +
  'cGUgL1BhZ2VzIC9LaWRzIFsgNSAwIFIgNyAwIFIgOSAwIFIgMTEgMCBSIF0gL0NvdW50IDQgPj4KZW5kb2JqCjMgMCBvYmoK' +
  'PDwgL1R5cGUgL0ZvbnQgL1N1YnR5cGUgL1R5cGUxIC9CYXNlRm9udCAvSGVsdmV0aWNhID4+CmVuZG9iago0IDAgb2JqCjw8' +
  'IC9MZW5ndGggMTk4ID4+CnN0cmVhbQpCVCAvRjEgNDIgVGYgNjQgNzIwIFRkIChQYWdlIDEgb2YgNCkgVGogRVQKQlQgL0Yx' +
  'IDE0IFRmIDY0IDY2MCBUZCAoQ2hhdFVJQ29tcG9uZW50IHByZXZpZXcgZml4dHVyZS4gU2Nyb2xsIGZvciBtb3JlIHBhZ2Vz' +
  'LikgVGogRVQKMiB3IDY0IDgwIG0gNTMxIDgwIGwgUwpCVCAvRjEgMTAgVGYgNjQgNTYgVGQgKGZpeHR1cmUucGRmIC0gMSkg' +
  'VGogRVQKZW5kc3RyZWFtCmVuZG9iago1IDAgb2JqCjw8IC9UeXBlIC9QYWdlIC9QYXJlbnQgMiAwIFIgL01lZGlhQm94IFsw' +
  'IDAgNTk1IDg0Ml0gL1Jlc291cmNlcyA8PCAvRm9udCA8PCAvRjEgMyAwIFIgPj4gPj4gL0NvbnRlbnRzIDQgMCBSID4+CmVu' +
  'ZG9iago2IDAgb2JqCjw8IC9MZW5ndGggMTk4ID4+CnN0cmVhbQpCVCAvRjEgNDIgVGYgNjQgNzIwIFRkIChQYWdlIDIgb2Yg' +
  'NCkgVGogRVQKQlQgL0YxIDE0IFRmIDY0IDY2MCBUZCAoQ2hhdFVJQ29tcG9uZW50IHByZXZpZXcgZml4dHVyZS4gU2Nyb2xs' +
  'IGZvciBtb3JlIHBhZ2VzLikgVGogRVQKMiB3IDY0IDgwIG0gNTMxIDgwIGwgUwpCVCAvRjEgMTAgVGYgNjQgNTYgVGQgKGZp' +
  'eHR1cmUucGRmIC0gMikgVGogRVQKZW5kc3RyZWFtCmVuZG9iago3IDAgb2JqCjw8IC9UeXBlIC9QYWdlIC9QYXJlbnQgMiAw' +
  'IFIgL01lZGlhQm94IFswIDAgNTk1IDg0Ml0gL1Jlc291cmNlcyA8PCAvRm9udCA8PCAvRjEgMyAwIFIgPj4gPj4gL0NvbnRl' +
  'bnRzIDYgMCBSID4+CmVuZG9iago4IDAgb2JqCjw8IC9MZW5ndGggMTk4ID4+CnN0cmVhbQpCVCAvRjEgNDIgVGYgNjQgNzIw' +
  'IFRkIChQYWdlIDMgb2YgNCkgVGogRVQKQlQgL0YxIDE0IFRmIDY0IDY2MCBUZCAoQ2hhdFVJQ29tcG9uZW50IHByZXZpZXcg' +
  'Zml4dHVyZS4gU2Nyb2xsIGZvciBtb3JlIHBhZ2VzLikgVGogRVQKMiB3IDY0IDgwIG0gNTMxIDgwIGwgUwpCVCAvRjEgMTAg' +
  'VGYgNjQgNTYgVGQgKGZpeHR1cmUucGRmIC0gMykgVGogRVQKZW5kc3RyZWFtCmVuZG9iago5IDAgb2JqCjw8IC9UeXBlIC9Q' +
  'YWdlIC9QYXJlbnQgMiAwIFIgL01lZGlhQm94IFswIDAgNTk1IDg0Ml0gL1Jlc291cmNlcyA8PCAvRm9udCA8PCAvRjEgMyAw' +
  'IFIgPj4gPj4gL0NvbnRlbnRzIDggMCBSID4+CmVuZG9iagoxMCAwIG9iago8PCAvTGVuZ3RoIDE5OCA+PgpzdHJlYW0KQlQg' +
  'L0YxIDQyIFRmIDY0IDcyMCBUZCAoUGFnZSA0IG9mIDQpIFRqIEVUCkJUIC9GMSAxNCBUZiA2NCA2NjAgVGQgKENoYXRVSUNv' +
  'bXBvbmVudCBwcmV2aWV3IGZpeHR1cmUuIFNjcm9sbCBmb3IgbW9yZSBwYWdlcy4pIFRqIEVUCjIgdyA2NCA4MCBtIDUzMSA4' +
  'MCBsIFMKQlQgL0YxIDEwIFRmIDY0IDU2IFRkIChmaXh0dXJlLnBkZiAtIDQpIFRqIEVUCmVuZHN0cmVhbQplbmRvYmoKMTEg' +
  'MCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCA1OTUgODQyXSAvUmVzb3VyY2VzIDw8' +
  'IC9Gb250IDw8IC9GMSAzIDAgUiA+PiA+PiAvQ29udGVudHMgMTAgMCBSID4+CmVuZG9iagp4cmVmCjAgMTIKMDAwMDAwMDAw' +
  'MCA2NTUzNSBmIAowMDAwMDAwMDA5IDAwMDAwIG4gCjAwMDAwMDAwNTggMDAwMDAgbiAKMDAwMDAwMDEzNiAwMDAwMCBuIAow' +
  'MDAwMDAwMjA2IDAwMDAwIG4gCjAwMDAwMDA0NTUgMDAwMDAgbiAKMDAwMDAwMDU4MSAwMDAwMCBuIAowMDAwMDAwODMwIDAw' +
  'MDAwIG4gCjAwMDAwMDA5NTYgMDAwMDAgbiAKMDAwMDAwMTIwNSAwMDAwMCBuIAowMDAwMDAxMzMxIDAwMDAwIG4gCjAwMDAw' +
  'MDE1ODEgMDAwMDAgbiAKdHJhaWxlcgo8PCAvU2l6ZSAxMiAvUm9vdCAxIDAgUiA+PgpzdGFydHhyZWYKMTcwOQolJUVPRgo='

/** A .docx with a title, headings and body text, written straight to OOXML. */
export const DOCX_BASE64 =
  'UEsDBAoAAAAIAHFjJ12KUntm+QAAADICAAATAAAAW0NvbnRlbnRfVHlwZXNdLnhtbK2Ru07DMBSGd57C8lolDgwIoaYduIzA' +
  'UB7gyD5JLHyTj1uat+ekgQyowMJo/5fvl73eHr0TB8xkY2jlZd1IgUFHY0PfytfdY3UjBRUIBlwM2MoRSW43F+vdmJAEhwO1' +
  'cigl3SpFekAPVMeEgZUuZg+Fj7lXCfQb9KiumuZa6RgKhlKVqUNy2T12sHdFPBz5fl6S0ZEUd7NzgrUSUnJWQ2FdHYL5hqk+' +
  'ETUnTx4abKIVG6Q6j5iknwlfwWd+nGwNihfI5Qk829R7zEaZqPeeo/XvPWeWxq6zGpf81JZy1EjEr+5dvSgebFj9OYTK6JD+' +
  'f8bcu/DV6cs3H1BLAwQKAAAAAABxYyddAAAAAAAAAAAAAAAABgAAAF9yZWxzL1BLAwQKAAAACABxYyddP63++q8AAAAsAQAA' +
  'CwAAAF9yZWxzLy5yZWxzjc87DsIwDADQnVNE3mlaBoRQQxeE1BWVA0SJm1Y0H8Xh09uTgQEqBkb/nu26edqJ3THS6J2AqiiB' +
  'oVNej84IuHSn9Q4YJem0nLxDATMSNIdVfcZJpjxDwxiIZcSRgCGlsOec1IBWUuEDulzpfbQy5TAaHqS6SoN8U5ZbHj8NWKCs' +
  '1QJiqytg3RzwH9z3/ajw6NXNoks/diw6siyjwSTg4aPm+p0uMgs8n8O/njy8AFBLAwQKAAAAAABxYyddAAAAAAAAAAAAAAAA' +
  'BQAAAHdvcmQvUEsDBAoAAAAAAHFjJ10AAAAAAAAAAAAAAAALAAAAd29yZC9fcmVscy9QSwMECgAAAAgAcWMnXZYLl86tAAAA' +
  'HQEAABwAAAB3b3JkL19yZWxzL2RvY3VtZW50LnhtbC5yZWxzjc9NCsIwEAXgvacIs7dpXYhIYzcidCv1ACGZpsX8kYlib2/A' +
  'jYoLl49hvsdru4ez7I6J5uAFNFUNDL0KevZGwGU4rXfAKEuvpQ0eBSxI0B1W7RmtzOWHpjkSK4gnAVPOcc85qQmdpCpE9OUy' +
  'huRkLjEZHqW6SoN8U9dbnt4N+EJZrwWkXjfAhiXiP3gYx1nhMaibQ59/dHDKiy0D2CCTwSzglaviAC/9/GPV4QlQSwMECgAA' +
  'AAgAcWMnXVjG/4A7AQAAuQIAAA8AAAB3b3JkL3N0eWxlcy54bWytkVFPwyAQx9/9FA3vjha3RZuxxWgWffNhfoAbpSsJBcLh' +
  '6vz0Qtupc1nig2lCuftz/7sfLFbvrc720qOyhpNikpNMGmErZXacvG7W17ckwwCmAm2N5OQgkayWV4uuxHDQErNYb7DsOGlC' +
  'cCWlKBrZAk6skyZqtfUthBj6He2sr5y3QiJG+1ZTludz2oIypHesrHiUNbzpgMsY+hc/hmPU/9bWBMy6ElAoxckDaLX1isRM' +
  'c2/wR4am4/gRhT1oThhLGToa0VN7etr8Cy8Wh4OL2A487Dy4JjXqpeeKk40KWpLUx0Arj52GbN/eDUOjAxGJ44GtjBcS/dg0' +
  'T05QB+njtbN8HG4sGGG/p5/NB8NtvwqrrT9KBaTvF1w/4p85niSkBy/OUJpByIp/xrlhF3FYPZvezS/gHLe4/ARQSwMECgAA' +
  'AAgAcWMnXSkTwMfLAgAAIgUAABEAAAB3b3JkL2RvY3VtZW50LnhtbL1UW08aQRR+91dM9l0QbYwlgi+t8aEmJtr0eYURiMvO' +
  'ZnfLpU/YekUQTK3xAi2oFGq91miR63+pO7PLk3+hZ0BrH1rS+NBks3Pu58w338zwSCQooRBWtQCRXYLD1icgLHuINyD7XMLL' +
  'qdHeIQFpuih7RYnI2CVEsSaMuHuGw04v8bwOYllHUEHWnGGX4Nd1xWm3ax4/DoqajShYBt8MUYOiDqrqs4eJ6lVU4sGaBg2C' +
  'kr2/r2/QHhQDsuCGktPEG23XVrimTKjtZVKPShiFnSFRcglTAV3Cgt09bP8V0P61x3BqiuiBIRUVa1gNYcFNj/dp5TP9XjBL' +
  'q3S9xOIFnqi309VOkYeG3QpZzW22dWqUY0b50NwoGZU1NKkTNTpNyCwyd+aRDfCIIPOgYjRW2eaSUb26rSXMjXPE7b1QKBTA' +
  'YUQzJXaZsorLdLvUWkpYxX32MU2vr1j5G/v0/ib2tst4f8RjDIv8rBz/DonDhljmCMCwmrv0/MMj8aCpC6NRbGX3WLZp5Qut' +
  'etqoLHb23dqbhw3e1nYmno3exObobsNcWQIBvNDYKK8Z1X0zNweWcVGd9ZKwDOLY1PgLWF4BQWB5HvFgCfAzqgWaiv+Oege9' +
  'TiN6cA3Is9x6d9y6bYOdpqC6WUyyXI3WUq13devyjKYTYKS1HLso0cWElS/BKPSkaZSrHQvvms2buyfsrGw1M0Ztiy4sw3B0' +
  'ccGsn3Rc/+Us+23IKK/CsOz4scRm8TiyKYoe4Sy26kcsuWdUiubKF7ZWAIawbAH9iG3Ah9jyulGF80sCielK0vx62qEv4tkc' +
  'odQh22rADWCZJI3nub9+RAt1fjuACpC/2YqlW/nLe0b8BSANe/Q7eHyTbwAceFocjqd9gwLIfpAHhwaGOEY8ACgEVp0oPGbg' +
  'CQ9RAz6//qBOE10nwQddwjP33g7Od/16uNx+gbhw/7q5fwJQSwECFAAKAAAACABxYyddilJ7ZvkAAAAyAgAAEwAAAAAAAAAA' +
  'AAAAAAAAAAAAW0NvbnRlbnRfVHlwZXNdLnhtbFBLAQIUAAoAAAAAAHFjJ10AAAAAAAAAAAAAAAAGAAAAAAAAAAAAEAAAACoB' +
  'AABfcmVscy9QSwECFAAKAAAACABxYyddP63++q8AAAAsAQAACwAAAAAAAAAAAAAAAABOAQAAX3JlbHMvLnJlbHNQSwECFAAK' +
  'AAAAAABxYyddAAAAAAAAAAAAAAAABQAAAAAAAAAAABAAAAAmAgAAd29yZC9QSwECFAAKAAAAAABxYyddAAAAAAAAAAAAAAAA' +
  'CwAAAAAAAAAAABAAAABJAgAAd29yZC9fcmVscy9QSwECFAAKAAAACABxYyddlguXzq0AAAAdAQAAHAAAAAAAAAAAAAAAAABy' +
  'AgAAd29yZC9fcmVscy9kb2N1bWVudC54bWwucmVsc1BLAQIUAAoAAAAIAHFjJ11Yxv+AOwEAALkCAAAPAAAAAAAAAAAAAAAA' +
  'AFkDAAB3b3JkL3N0eWxlcy54bWxQSwECFAAKAAAACABxYyddKRPAx8sCAAAiBQAAEQAAAAAAAAAAAAAAAADBBAAAd29yZC9k' +
  'b2N1bWVudC54bWxQSwUGAAAAAAgACADgAQAAuwcAAAAA'

/** A three-sheet workbook: formulas, percentages, currency, dates, a boolean. */
export const XLSX_BASE64 =
  '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'

// ---------------------------------------------------------------------------
// The files themselves
// ---------------------------------------------------------------------------

function bytes(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const buffer = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) buffer[i] = binary.charCodeAt(i)
  return buffer.buffer
}

/** The file the demo transcript reads: one refresh in flight, however many callers notice. */
const AUTH_TS = `import { createServer } from 'node:http'

/** Refreshes the token at most once, however many requests notice it expired. */
let inflight: Promise<string> | null = null

export async function accessToken(): Promise<string> {
  if (!expired()) return current
  inflight ??= refresh().finally(() => {
    inflight = null
  })
  return inflight
}

createServer(async (request, response) => {
  const token = await accessToken()
  response.setHeader('authorization', \`Bearer \${token}\`)
  response.end('ok')
}).listen(3000)
`

/** One of the three call sites the transcript's `grep` turns up. */
const CLIENT_TS = `import { accessToken } from '../auth'

export async function request(path: string, init: RequestInit = {}) {
  const response = await fetch(path, {
    ...init,
    headers: { ...init.headers, authorization: \`Bearer \${await accessToken()}\` },
  })
  if (response.status === 401) throw new Unauthorized(path)
  return response
}
`

const README = `# 取数路径重构

把三处各自 fetch 的逻辑收拢到一个 \`useResource\` 里。

## 为什么

- 三份缓存互相看不见，同一个 id 会被取三次
- 失败重试的退避策略每处都不一样

## 结论

| 指标 | 之前 | 之后 |
| --- | ---: | ---: |
| 首屏请求数 | 11 | 4 |
| P95 | 820ms | 310ms |

> 剩下的一处在 \`legacy/\` 下，等那块下线一起删。
`

/**
 * Deliberately hostile HTML.
 *
 * Both payloads are the standard first things anyone tries — an inline `<script>` and an
 * `onerror` handler on a broken image. Neither runs, because the frame is `sandbox=""` with
 * `allow-scripts` absent. If a change ever loosens that attribute, the HTML story is where it
 * shows up: an alert box appears.
 */
const HTML = `<!doctype html>
<html lang="zh">
  <head>
    <meta charset="utf-8" />
    <style>
      body { font: 15px/1.7 system-ui, sans-serif; margin: 2rem; color: #1f2937; }
      h1 { font-size: 1.6rem; margin: 0 0 .25rem; }
      .tag { display: inline-block; background: #ecfdf5; color: #047857;
             border-radius: 999px; padding: .1rem .6rem; font-size: .8rem; }
      table { border-collapse: collapse; margin-top: 1rem; }
      td, th { border: 1px solid #e5e7eb; padding: .35rem .7rem; text-align: left; }
    </style>
  </head>
  <body>
    <h1>构建报告</h1>
    <p class="tag">通过</p>
    <table>
      <tr><th>包</th><th>产物</th><th>gzip</th></tr>
      <tr><td>chat-core</td><td>48.2 kB</td><td>14.1 kB</td></tr>
      <tr><td>chat-ui</td><td>196.4 kB</td><td>52.7 kB</td></tr>
    </table>

    <!-- 下面两行是故意放的：sandbox 里它们都不会执行 -->
    <script>alert('XSS: script executed')</script>
    <img src="x" onerror="alert('XSS: onerror executed')" alt="" />
  </body>
</html>
`

const PHOTO =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="900">
       <defs>
         <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
           <stop offset="0" stop-color="#0f172a"/><stop offset="1" stop-color="#334155"/>
         </linearGradient>
       </defs>
       <rect width="1400" height="900" fill="url(#sky)"/>
       <circle cx="1120" cy="190" r="70" fill="#fbbf24"/>
       <path d="M0 640 L320 400 L560 640 L760 470 L1080 700 L1400 520 L1400 900 L0 900 Z" fill="#0b1220"/>
       <g fill="#e2e8f0" font-family="monospace" font-size="26">
         <text x="60" y="90">1400 × 900</text>
         <text x="60" y="130">滚轮缩放 · 拖拽平移 · 双击复位</text>
       </g>
       <g fill="#38bdf8">
         ${Array.from({ length: 24 }, (_, i) => `<circle cx="${60 + i * 55}" cy="820" r="4"/>`).join('')}
       </g>
     </svg>`,
  )

export const FILES = {
  pdf: {
    name: '季度报告.pdf',
    mediaType: 'application/pdf',
    content: bytes(PDF_BASE64),
  },
  docx: {
    name: '工程周报.docx',
    mediaType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    content: bytes(DOCX_BASE64),
  },
  xlsx: {
    name: '销售明细.xlsx',
    mediaType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    content: bytes(XLSX_BASE64),
  },
  code: { name: 'auth.ts', content: AUTH_TS },
  client: { name: 'client.ts', content: CLIENT_TS },
  markdown: { name: 'README.md', content: README },
  html: { name: 'report.html', mediaType: 'text/html', content: HTML },
  image: { name: '架构图.svg', mediaType: 'image/svg+xml', url: PHOTO },
} satisfies Record<string, PreviewFile>

/** Slides, as the only form we accept them in: already converted, page by page. */
export const SLIDES: PreviewFile = {
  name: '发布评审.pptx',
  mediaType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  converted: {
    kind: 'pdf',
    file: { name: '发布评审.pdf', mediaType: 'application/pdf', content: bytes(PDF_BASE64) },
  },
}

/** Paths match the ones the demo transcript reads and greps. */
export const TREE: FileNode[] = [
  {
    id: 'src',
    name: 'src',
    type: 'dir',
    children: [
      {
        id: 'src/api',
        name: 'api',
        type: 'dir',
        children: [{ id: 'src/api/client.ts', name: 'client.ts', type: 'file', file: FILES.client }],
      },
      // No `children` and `onExpand` is provided: expandable, loaded on demand.
      { id: 'src/generated', name: 'generated', type: 'dir' },
      { id: 'src/auth.ts', name: 'auth.ts', type: 'file', file: FILES.code },
      { id: 'src/README.md', name: 'README.md', type: 'file', file: FILES.markdown },
      { id: 'src/report.html', name: 'report.html', type: 'file', file: FILES.html },
    ],
  },
  {
    id: 'docs',
    name: 'docs',
    type: 'dir',
    children: [
      { id: 'docs/quarterly.pdf', name: '季度报告.pdf', type: 'file', file: FILES.pdf },
      { id: 'docs/weekly.docx', name: '工程周报.docx', type: 'file', file: FILES.docx },
      { id: 'docs/sales.xlsx', name: '销售明细.xlsx', type: 'file', file: FILES.xlsx },
      { id: 'docs/review.pptx', name: '发布评审.pptx', type: 'file', file: SLIDES },
      { id: 'docs/arch.svg', name: '架构图.svg', type: 'file', file: FILES.image },
    ],
  },
  {
    id: 'design.psd',
    name: '设计稿.psd',
    type: 'file',
    file: { name: '设计稿.psd', size: 18_400_000 },
  },
]

/** Fills in a lazy directory after a beat, so the row's loading state is visible. */
export const lazyExpand = (node: FileNode) =>
  node.id === 'src/generated'
    ? new Promise<void>((resolve) => {
        setTimeout(() => {
          node.children = [
            {
              id: 'src/generated/schema.json',
              name: 'schema.json',
              type: 'file',
              file: { name: 'schema.json', content: '{\n  "version": 3\n}\n' },
            },
            {
              id: 'src/generated/types.d.ts',
              name: 'types.d.ts',
              type: 'file',
              file: {
                name: 'types.d.ts',
                content: 'export type Id = string & { readonly brand: unique symbol }\n',
              },
            },
          ]
          resolve()
        }, 600)
      })
    : undefined
