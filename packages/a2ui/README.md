# @xinjiyuan97/chat-a2ui

把 agent 写出来的一段 **JSON spec** 渲染成 React 组件，用户的操作再作为 action 回传。渲染器本身不带任何组件 —— 组件由你注册，默认组件集在 [`@xinjiyuan97/chat-ui/a2ui-registry`](../ui)。

完整文档在[仓库根 README](../../README.md)。

```bash
pnpm add @xinjiyuan97/chat-a2ui
```

Peer：React 18.2+ 或 19。依赖 `@xinjiyuan97/chat-core`（只用它的类型）。

---

## 用法

```tsx
import { A2UIRenderer, type A2UIComponentProps } from '@xinjiyuan97/chat-a2ui'

const registry = {
  Card: ({ children }: A2UIComponentProps) => <div className="card">{children}</div>,
  Text: ({ props }: A2UIComponentProps) => <p>{String(props.text ?? '')}</p>,
  Button: ({ props, ctx }: A2UIComponentProps) => (
    <button onClick={() => ctx.emit(props.onClick)}>{String(props.label ?? '')}</button>
  ),
}

<A2UIRenderer
  spec={spec}
  registry={registry}
  data={{ user: { name: '小明' } }}
  onAction={(action) => console.log(action.action, action.formData)}
/>
```

spec 长这样：

```json
{
  "type": "Card",
  "children": [
    { "type": "Text", "props": { "text": "你好 {{user.name}}，确认下单？" } },
    { "type": "Button", "props": { "label": "确认", "onClick": { "action": "confirm" } } }
  ]
}
```

表单状态存在 renderer 内部（`ctx.values` / `ctx.setValue`），`onAction` 时把整个 surface 的 `formData` 一起回传 —— agent 不必逐字段同步。

## spec 是模型输出，按不可信输入处理

这块的约束是硬性的，扩展 registry 时请一并遵守：

- **绝不 eval。** `{{path}}` 只做安全的路径查找（拒绝原型链和继承属性），`when` 只支持 `path` / `!path` / `path == 'literal'` 三种形式，看不懂的一律判 false —— 少渲染一个节点，好过渲染出 agent 没打算要的东西。
- 节点数（`maxNodes`，默认 500）和深度（`maxDepth`，默认 20）都有上限，超了走 `renderTruncated` 提示，**不静默截断**。预算在递归里精确扣减，跑飞的 spec 在进入 reconciler 之前就被拦下。
- props 会被过滤：`dangerouslySetInnerHTML`、`on*` 字符串处理器、`javascript:` 和 `data:text/html` 链接在到达组件之前就被剥掉。
- 未注册的 `type` 走 `renderUnknown`，组件抛错被 ErrorBoundary 拦在 surface 内 —— 一张坏卡片不该带走整条消息。
- 往 registry 里加组件，等于把那个能力交给模型输出。**加之前先想清楚**：能导航、能发请求、能执行代码的组件，就是把这些能力交给了一段生成的 JSON。

## 流式 spec

`parsePartialJSON` 能吃下写到一半的 JSON，所以卡片可以边流边显形，而不是等整段 JSON 收完才「啪」地出现。补不出合法结构时返回 `undefined`，调用方等下一帧即可。

## License

MIT
