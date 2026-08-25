import type { ConversationGroupKey } from '@agent-chat/core'

export type ChatLocale = {
  /** BCP-47 tag, used for `Intl` formatting. */
  code: string

  thinking: string
  thoughtFor: (duration: string) => string
  reasoning: string

  toolRunning: string
  toolSucceeded: string
  toolFailed: string
  toolArguments: string
  toolResult: string

  /** Accessible name of the approval menu. */
  permissionMenu: string
  /** Card title when the request carries no `title` of its own. */
  permissionTitle: (tool: string) => string
  permissionAllowOnce: string
  permissionAllowAlways: string
  permissionDeny: string
  /** Second line under each built-in option. */
  permissionAllowOnceHint: string
  permissionAllowAlwaysHint: string
  permissionDenyHint: string
  permissionReasonLabel: string
  permissionReasonPlaceholder: string
  permissionSubmit: string
  /** Risk tags on the card header. `low` is intentionally unlabelled. */
  permissionRiskMedium: string
  permissionRiskHigh: string
  /** Read-back once decided. */
  permissionAllowedOnce: string
  permissionAllowedAlways: string
  permissionDenied: string

  todos: string
  /** Counter in the todo header, e.g. 「3/7」. */
  todoProgress: (completed: number, total: number) => string
  todoPending: string
  todoInProgress: string
  todoCompleted: string
  todoCancelled: string
  todoAllDone: string
  todoEmpty: string
  /** Accessible name of a checkable todo row. */
  todoToggle: (title: string) => string

  copy: string
  copied: string
  wrapLines: string
  /** Code block: runs the snippet through the host's `onRunCode`. */
  run: string
  running: string
  runOutput: string
  runFailed: string
  clearOutput: string
  /** Mermaid: the rendered diagram and its fallbacks. */
  diagram: string
  diagramError: string
  showSource: string
  showDiagram: string
  regenerate: string
  edit: string
  save: string
  cancel: string
  like: string
  dislike: string
  share: string
  retry: string
  more: string
  /** Message action: pulls the selected passage into the composer. */
  quote: string

  send: string
  stop: string
  attach: string
  model: string
  inputPlaceholder: string
  /** Shown under the input as a hint. */
  submitHint: string

  /** Title of the strip above the composer, when the quote has no author. */
  quoteReply: string
  removeQuote: string

  attachImage: string
  removeAttachment: (name: string) => string
  dropToAttach: string
  uploading: string
  /** Why a file was refused. Keys match `useAttachments`' error codes. */
  attachmentTooLarge: (limit: string) => string
  attachmentWrongType: string
  attachmentTooMany: (limit: number) => string

  voiceStart: string
  voiceStop: string
  voiceListening: string
  voiceTranscribing: string
  voiceCancel: string
  /** Shown when the mic is blocked or the recogniser fails. */
  voiceError: (reason: string) => string

  emptyTitle: string
  emptySubtitle: string
  scrollToBottom: string
  sources: string
  /** Prefix of an inline citation marker's accessible name, e.g. "Source 3". */
  citation: string
  /** Callout titles, keyed by GitHub's alert levels. */
  calloutNote: string
  calloutTip: string
  calloutImportant: string
  calloutWarning: string
  calloutCaution: string
  showMore: string
  showLess: string
  streamError: string

  newChat: string
  conversations: string
  searchPlaceholder: string
  noConversations: string
  noResults: string
  rename: string
  delete: string
  confirmDelete: string
  pin: string
  unpin: string
  collapseSidebar: string
  expandSidebar: string
  conversationOptions: string
  groups: Record<ConversationGroupKey, string>

  agents: string
  unassignedAgent: string
  /** Screen-reader count on a section header. */
  agentConversations: (count: number) => string
  collapseAgent: (name: string) => string
  expandAgent: (name: string) => string
  newChatIn: (name: string) => string
  /** Subtitle on a flattened search result, naming its owning agent. */
  inAgent: (name: string) => string

  a2uiUnknownComponent: (type: string) => string
  a2uiTruncated: string
  a2uiError: string
  a2uiSubmitted: string
}

export const zhCN: ChatLocale = {
  code: 'zh-CN',

  thinking: '思考中',
  thoughtFor: (duration) => `思考 ${duration}`,
  reasoning: '思考过程',

  toolRunning: '执行中',
  toolSucceeded: '完成',
  toolFailed: '失败',
  toolArguments: '参数',
  toolResult: '结果',

  permissionMenu: '审批操作',
  permissionTitle: (tool) => `${tool} 请求执行权限`,
  permissionAllowOnce: '允许这一次',
  permissionAllowAlways: '本次会话都允许',
  permissionDeny: '拒绝',
  permissionAllowOnceHint: '只放行这一次，下次还会再问',
  permissionAllowAlwaysHint: '这个会话内不再询问同类操作',
  permissionDenyHint: '告诉它换一种做法',
  permissionReasonLabel: '拒绝原因',
  permissionReasonPlaceholder: '为什么不能这么做？（会发回给模型）',
  permissionSubmit: '提交',
  permissionRiskMedium: '需留意',
  permissionRiskHigh: '高风险',
  permissionAllowedOnce: '已允许',
  permissionAllowedAlways: '已允许（本次会话）',
  permissionDenied: '已拒绝',

  todos: '任务清单',
  todoProgress: (completed, total) => `${completed}/${total}`,
  todoPending: '待办',
  todoInProgress: '进行中',
  todoCompleted: '已完成',
  todoCancelled: '已取消',
  todoAllDone: '全部完成',
  todoEmpty: '暂无任务',
  todoToggle: (title) => `切换「${title}」的完成状态`,

  copy: '复制',
  copied: '已复制',
  wrapLines: '自动换行',
  run: '运行',
  running: '运行中',
  runOutput: '运行结果',
  runFailed: '运行失败',
  clearOutput: '清除结果',
  diagram: '图表',
  diagramError: '图表语法有误',
  showSource: '查看源码',
  showDiagram: '查看图表',
  regenerate: '重新生成',
  edit: '编辑',
  save: '保存',
  cancel: '取消',
  like: '有帮助',
  dislike: '没帮助',
  share: '分享',
  retry: '重试',
  more: '更多',
  quote: '引用',

  send: '发送',
  stop: '停止',
  attach: '添加附件',
  model: '模型',
  inputPlaceholder: '输入消息…',
  submitHint: 'Enter 发送，Shift + Enter 换行',

  quoteReply: '引用回复',
  removeQuote: '取消引用',

  attachImage: '添加图片',
  removeAttachment: (name) => `移除 ${name}`,
  dropToAttach: '松开即可添加',
  uploading: '上传中',
  attachmentTooLarge: (limit) => `超过 ${limit}`,
  attachmentWrongType: '不支持的类型',
  attachmentTooMany: (limit) => `最多 ${limit} 个附件`,

  voiceStart: '语音输入',
  voiceStop: '结束并转写',
  voiceListening: '正在聆听',
  voiceTranscribing: '转写中',
  voiceCancel: '取消录音',
  voiceError: (reason) => `语音输入失败：${reason}`,

  emptyTitle: '开始一段新对话',
  emptySubtitle: '问我任何问题，我可以调用工具来帮你完成任务。',
  scrollToBottom: '回到底部',
  sources: '参考来源',
  citation: '来源',
  calloutNote: '说明',
  calloutTip: '提示',
  calloutImportant: '重点',
  calloutWarning: '注意',
  calloutCaution: '警告',
  showMore: '展开',
  showLess: '收起',
  streamError: '生成中断',

  newChat: '新建对话',
  conversations: '对话列表',
  searchPlaceholder: '搜索对话',
  noConversations: '还没有对话',
  noResults: '没有匹配的对话',
  rename: '重命名',
  delete: '删除',
  confirmDelete: '确认删除？',
  pin: '置顶',
  unpin: '取消置顶',
  collapseSidebar: '收起侧栏',
  expandSidebar: '展开侧栏',
  conversationOptions: '对话操作',
  groups: {
    pinned: '置顶',
    today: '今天',
    yesterday: '昨天',
    last7Days: '近 7 天',
    last30Days: '近 30 天',
    older: '更早',
  },

  agents: 'Agent',
  unassignedAgent: '未分配',
  agentConversations: (count) => `${count} 个对话`,
  collapseAgent: (name) => `收起 ${name}`,
  expandAgent: (name) => `展开 ${name}`,
  newChatIn: (name) => `在 ${name} 下新建对话`,
  inAgent: (name) => `属于 ${name}`,

  a2uiUnknownComponent: (type) => `未注册的组件：${type}`,
  a2uiTruncated: '内容过长，已截断显示',
  a2uiError: '此卡片渲染失败',
  a2uiSubmitted: '已提交',
}

export const enUS: ChatLocale = {
  code: 'en-US',

  thinking: 'Thinking',
  thoughtFor: (duration) => `Thought for ${duration}`,
  reasoning: 'Reasoning',

  toolRunning: 'Running',
  toolSucceeded: 'Done',
  toolFailed: 'Failed',
  toolArguments: 'Arguments',
  toolResult: 'Result',

  permissionMenu: 'Approve this action',
  permissionTitle: (tool) => `${tool} wants permission`,
  permissionAllowOnce: 'Allow once',
  permissionAllowAlways: 'Allow for this session',
  permissionDeny: 'Deny',
  permissionAllowOnceHint: 'Just this one time — you will be asked again',
  permissionAllowAlwaysHint: 'Stop asking about this kind of action in this chat',
  permissionDenyHint: 'Tell it to do something else instead',
  permissionReasonLabel: 'Reason',
  permissionReasonPlaceholder: 'Why not? (sent back to the model)',
  permissionSubmit: 'Submit',
  permissionRiskMedium: 'Review',
  permissionRiskHigh: 'High risk',
  permissionAllowedOnce: 'Allowed',
  permissionAllowedAlways: 'Allowed for this session',
  permissionDenied: 'Denied',

  todos: 'Tasks',
  todoProgress: (completed, total) => `${completed}/${total}`,
  todoPending: 'To do',
  todoInProgress: 'In progress',
  todoCompleted: 'Done',
  todoCancelled: 'Cancelled',
  todoAllDone: 'All done',
  todoEmpty: 'Nothing planned',
  todoToggle: (title) => `Toggle “${title}”`,

  copy: 'Copy',
  copied: 'Copied',
  wrapLines: 'Wrap lines',
  run: 'Run',
  running: 'Running',
  runOutput: 'Output',
  runFailed: 'Run failed',
  clearOutput: 'Clear output',
  diagram: 'Diagram',
  diagramError: 'Invalid diagram syntax',
  showSource: 'Show source',
  showDiagram: 'Show diagram',
  regenerate: 'Regenerate',
  edit: 'Edit',
  save: 'Save',
  cancel: 'Cancel',
  like: 'Helpful',
  dislike: 'Not helpful',
  share: 'Share',
  retry: 'Retry',
  more: 'More',
  quote: 'Quote',

  send: 'Send',
  stop: 'Stop',
  attach: 'Attach files',
  model: 'Model',
  inputPlaceholder: 'Send a message…',
  submitHint: 'Enter to send, Shift + Enter for a new line',

  quoteReply: 'Replying to',
  removeQuote: 'Remove quote',

  attachImage: 'Add an image',
  removeAttachment: (name) => `Remove ${name}`,
  dropToAttach: 'Drop to attach',
  uploading: 'Uploading',
  attachmentTooLarge: (limit) => `Larger than ${limit}`,
  attachmentWrongType: 'Unsupported type',
  attachmentTooMany: (limit) => `At most ${limit} attachments`,

  voiceStart: 'Voice input',
  voiceStop: 'Stop and transcribe',
  voiceListening: 'Listening',
  voiceTranscribing: 'Transcribing',
  voiceCancel: 'Discard recording',
  voiceError: (reason) => `Voice input failed: ${reason}`,

  emptyTitle: 'Start a new conversation',
  emptySubtitle: 'Ask anything — I can call tools to get things done.',
  scrollToBottom: 'Scroll to bottom',
  sources: 'Sources',
  citation: 'Source',
  calloutNote: 'Note',
  calloutTip: 'Tip',
  calloutImportant: 'Important',
  calloutWarning: 'Warning',
  calloutCaution: 'Caution',
  showMore: 'Show more',
  showLess: 'Show less',
  streamError: 'Generation interrupted',

  newChat: 'New chat',
  conversations: 'Conversations',
  searchPlaceholder: 'Search chats',
  noConversations: 'No conversations yet',
  noResults: 'No matching conversations',
  rename: 'Rename',
  delete: 'Delete',
  confirmDelete: 'Delete this chat?',
  pin: 'Pin',
  unpin: 'Unpin',
  collapseSidebar: 'Collapse sidebar',
  expandSidebar: 'Expand sidebar',
  conversationOptions: 'Conversation options',
  groups: {
    pinned: 'Pinned',
    today: 'Today',
    yesterday: 'Yesterday',
    last7Days: 'Previous 7 days',
    last30Days: 'Previous 30 days',
    older: 'Older',
  },

  agents: 'Agents',
  unassignedAgent: 'Unassigned',
  agentConversations: (count) => `${count} conversation${count === 1 ? '' : 's'}`,
  collapseAgent: (name) => `Collapse ${name}`,
  expandAgent: (name) => `Expand ${name}`,
  newChatIn: (name) => `New chat in ${name}`,
  inAgent: (name) => `in ${name}`,

  a2uiUnknownComponent: (type) => `Unregistered component: ${type}`,
  a2uiTruncated: 'Content was truncated',
  a2uiError: 'This card failed to render',
  a2uiSubmitted: 'Submitted',
}

export const locales = { 'zh-CN': zhCN, 'en-US': enUS } as const

export type LocaleName = keyof typeof locales
