---
'@xinjiyuan97/chat-core': minor
'@xinjiyuan97/chat-ui': minor
---

引用：引用块 / 提示框、行内角标、引用回复

- Markdown 的 `>` 引用重新设计，并支持 GitHub 的 `[!NOTE]` / `[!TIP]` / `[!IMPORTANT]` / `[!WARNING]` / `[!CAUTION]` 提示框。不认识的标记退回普通引用且文字原样保留；五个等级的图标形状各不相同，不依赖颜色区分。
- 消息里有 `source` part 时，正文中的 `[1]`、`[1,2]` 变成上标角标，点击展开来源列表并高亮对应行。编号作用域限于单条消息；行内代码和越界编号不改写。
- 新增 `QuotedMessage`、`QuoteButton`、`QuotePreview`：选中回复里的一段带到输入框上方，`PromptInput` 的 `quote` / `onQuoteRemove` 控制，引用随 `onSubmit` 的 `options.quote` 原样回传。

引用文本按纯文本渲染，不解析 Markdown —— 它是模型输出，被引用的 `#` 或图片不该在输入框里变成真的元素。
