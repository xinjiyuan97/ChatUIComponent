---
'@xinjiyuan97/core': minor
'@xinjiyuan97/ui': minor
---

多模态输入：附件上传与语音输入

- 新增 `useAttachments`：选择 / 拖拽 / 粘贴三种入口，大小与类型校验，object URL 生命周期管理，逐文件的上传取消。不传 `onUpload` 时文件被读成 data URL 直接进 `message.parts`，传了则先上传再把返回的 URL 放进 parts。
- 新增 `useVoiceInput`：默认走浏览器原生 `SpeechRecognition`（边说边出字），传 `transcribe(blob)` 则切到 `MediaRecorder` 录音 + 自定义转写服务。能力检测在 effect 里做，SSR 首屏不会出现两端不一致的 DOM。
- `PromptInput` 接入以上两个 controller，并新增 `attachments` / `voice` / `showImageButton` 三个 prop；`AttachmentList` 支持图片缩略图和上传中 / 失败状态。

**破坏性变更**：`PromptInput` 的 `onSubmit` 签名由 `(value: string) => void` 改为 `(value: string, options: { parts: FilePart[] }) => void`。原有单参数的调用仍然可用（多出的参数被忽略），但要拿到附件必须读第二个参数：

```tsx
onSubmit={(text, { parts }) => chat.send(text, { parts })}
```
