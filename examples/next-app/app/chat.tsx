'use client'

import { useMemo } from 'react'

import { createSSETransport, useAttachments, useChat, useVoiceInput } from '@xinjiyuan97/core'
import {
  ChatContainer,
  ChatEmptyState,
  ChatMessageList,
  ChatThemeProvider,
  ChatViewport,
  Message,
  PromptInput,
  SuggestionChips,
} from '@xinjiyuan97/ui'
import { defaultA2UIRegistry } from '@xinjiyuan97/ui/a2ui-registry'

const SUGGESTIONS = ['介绍一下这个组件库', '流式输出是怎么做的', '给我看一张 A2UI 卡片']

export function Chat() {
  /* Points at this app's own route handler. The route holds the credentials and forwards
   * the upstream stream — see `app/api/chat/route.ts`. */
  const transport = useMemo(() => createSSETransport({ url: '/api/chat' }), [])
  const chat = useChat({ transport })

  /* Inline mode: files become data URLs and travel in the request body. That is the right
   * default for screenshots and short logs; point `onUpload` at your own storage before
   * anyone drops a video in here. */
  const attachments = useAttachments({
    accept: 'image/*,application/pdf,text/plain,text/markdown,.md,.log,.json',
    maxSize: 5 * 1024 * 1024,
  })

  /* No `transcribe` given, so this uses the browser's own SpeechRecognition. Note that in
   * Chrome that is not local — the audio goes to Google's servers. Pass `transcribe` to
   * record locally and send the blob to a service you control instead. The mic button
   * renders nothing at all in browsers without either API. */
  const voice = useVoiceInput({ lang: 'zh-CN' })

  return (
    <ChatThemeProvider
      locale="zh-CN"
      a2uiRegistry={defaultA2UIRegistry}
      onA2UIAction={(action, message) => {
        chat.resolveA2UISurface(message.id, action.surfaceId)
        void chat.send(`确认：${action.action}`, { body: { formData: action.formData } })
      }}
      asFragment
    >
      <ChatContainer className="min-h-0 flex-1">
        <ChatViewport
          footer={
            chat.messages.length === 0 ? (
              <SuggestionChips
                suggestions={SUGGESTIONS}
                onSelect={(text) => void chat.send(text)}
              />
            ) : undefined
          }
        >
          {chat.messages.length === 0 ? (
            <ChatEmptyState
              title="试着问点什么"
              subtitle="回复由本地的 mock 路由生成，不会调用任何外部服务。"
            />
          ) : (
            <ChatMessageList busy={chat.isLoading}>
              {chat.messages.map((message) => (
                <Message
                  key={message.id}
                  message={message}
                  hideActions={message.status === 'streaming'}
                  onRegenerate={() => void chat.regenerate()}
                  onRetry={() => void chat.regenerate()}
                />
              ))}
            </ChatMessageList>
          )}
        </ChatViewport>

        <div className="shrink-0 border-t border-cc-border px-4 pb-4 pt-3 sm:px-6">
          <div className="mx-auto w-full max-w-cc-measure">
            <PromptInput
              onSubmit={(text, options) => void chat.send(text, { parts: options.parts })}
              onStop={chat.stop}
              streaming={chat.isLoading}
              attachments={attachments}
              voice={voice}
              showImageButton
              placeholder="问点什么…也可以拖张截图进来"
              showHint
            />
          </div>
        </div>
      </ChatContainer>
    </ChatThemeProvider>
  )
}
